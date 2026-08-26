/**
 * Parking Layout Lab — deterministic surface-parking layout heuristic.
 *
 * PURE MODULE. No React, no Mapbox map instances, no Zustand, no browser APIs.
 * The only dependencies are Turf (polygon buffering / boolean ops / validity)
 * and the local geometry helpers in ./geo. It can therefore be driven from a
 * map adapter, a Web Worker, or from plain fixtures in tests.
 *
 * Scope (M1): surface parking with stalls placed AROUND the plot perimeter
 * (following the outline, including concave edges) and the reclaimed interior
 * filled with straight double/single-loaded rows. One boundary, zero or more
 * exclusions, one access point.
 *
 * Scope (M2, all opt-in via SolverInput fields — absent means M1 behaviour):
 * simplified manoeuvring validation (approachability, dead-end turning bays,
 * one-way loop circulation, gate queue throat, visibility keepouts) and
 * accessible bay designation.
 *
 * NON-GOALS: structured parking, angled stalls, multiple vehicle entrances,
 * rigorous swept-path/AutoTURN-grade validation, fire routes, gradients,
 * drainage, landscaping, or any claim of optimality or regulatory compliance.
 * The output is a CONCEPTUAL feasibility/yield estimate.
 */

import buffer from '@turf/buffer';
import booleanValid from '@turf/boolean-valid';
import difference from '@turf/difference';
import intersect from '@turf/intersect';
import { polygon as turfPolygon, featureCollection } from '@turf/helpers';

import type {
  AccessiblePolicy,
  CandidateLayout,
  DriveAisle,
  LngLat,
  Orientation,
  OrientationSummary,
  ParkingRow,
  PolygonInput,
  SolverInput,
  SolverOutput,
  SolverWarning,
  Stall,
  Vehicle,
} from './types';
import {
  bboxLocal,
  closeRing,
  createProjection,
  dist,
  dropClosing,
  dropClosingLocal,
  polygonAreaLocal,
  pointInRing,
  pointToSegment,
  projectRing,
  ringCentroidLngLat,
  rotate,
  signedArea,
  unprojectRing,
  type LocalPoint,
  type LocalProjection,
  type LocalRing,
} from './geo';

// ---------------------------------------------------------------------------
// Safety limits — keep generation bounded and interactive.
// ---------------------------------------------------------------------------
const LIMITS = {
  maxVertices: 2_000, // per input ring
  maxCandidates: 3,
  maxOrientations: 6,
  maxIterations: 2_000_000, // hard cap on the total generation budget (perimeter + all interior candidates)
  minStallDim: 1.0, // metres
  minAisle: 2.0, // metres
  // A run of fewer than this many contiguous stalls is an unrealistic solo/stub
  // and is never emitted (perimeter + interior), and never left behind by an
  // accessible-bay merge. 2 => only true single-stall solos are dropped.
  minStallsPerRun: 2,
};

const EPS = 1e-6;
/** A stall/aisle touching the usable edge within this margin is permitted, not rejected as "outside". */
const EDGE_TOL = 0.05;

/** Shared generation budget: perimeter construction + every interior candidate draw from the same pool. */
type Budget = { used: number; limit: number };

// ---------------------------------------------------------------------------
// Public entry point.
// ---------------------------------------------------------------------------
export function solveParkingLayout(input: SolverInput): SolverOutput {
  const warnings: SolverWarning[] = [];

  // --- 1. Validate & normalise input -------------------------------------
  const validation = validateInput(input);
  if (!validation.ok) {
    return emptyOutput(input.accessPoint, validation.warnings);
  }
  warnings.push(...validation.warnings);

  // --- 2. Local metre projection -----------------------------------------
  const origin = ringCentroidLngLat(input.boundary.ring);
  const proj = createProjection(origin);

  // --- 3. Inset the site boundary by the setback, then canonicalise -------
  const usableRaw = insetBoundary(input.boundary.ring, input.boundarySetback, proj, warnings);
  if (!usableRaw || polygonAreaLocal(usableRaw) < EPS) {
    return {
      snappedAccessPoint: input.accessPoint,
      usableBoundary: null,
      expandedExclusions: [],
      candidates: [],
      warnings: [
        ...warnings,
        {
          code: 'setback-consumes-site',
          message:
            'The boundary setback removes the entire site. No usable area remains for parking.',
        },
      ],
    };
  }
  const usableLocal = canonicalizeRing(usableRaw);
  if (usableLocal.length < 3) {
    return {
      snappedAccessPoint: input.accessPoint,
      usableBoundary: null,
      expandedExclusions: [],
      candidates: [],
      warnings: [
        ...warnings,
        {
          code: 'degenerate-usable-boundary',
          message: 'The usable boundary collapsed to a degenerate shape after preprocessing.',
        },
      ],
    };
  }

  // --- 4. Expand exclusions by their clearance ---------------------------
  const expandedExclusionsLocal = expandExclusions(
    input.exclusions,
    input.exclusionClearance,
    proj,
    warnings,
  );
  // M2: visibility keepouts block placement exactly like exclusions, but
  // aren't buffered (already given as the keepout shape) and aren't rendered
  // as buildings — kept out of `expandedExclusionsLocal` (the OUTPUT field)
  // but merged into everything used for BLOCKING.
  const visibilityKeepoutsLocal = (input.visibilityKeepouts ?? []).map((vk) =>
    ensureCW(projectRing(vk.ring, proj)),
  );
  const blockingExclusionsLocal = [...expandedExclusionsLocal, ...visibilityKeepoutsLocal];

  // --- 5. Snap the access point to the nearest boundary edge -------------
  const accessLocal = proj.toLocal(input.accessPoint);
  const snap = snapToBoundary(accessLocal, usableLocal);
  const snappedLocal = snap.point;

  // --- 6. Reserve a straight access corridor into the site ----------------
  // M2: a configured gate queue extends the corridor depth to reserve
  // throat length for queuing vehicles ahead of the gate.
  const queueDepthM =
    input.vehicle && input.gateQueue ? input.gateQueue.vehicles * input.vehicle.length : 0;
  const corridorLocal = buildAccessCorridor(snappedLocal, snap.inwardNormal, usableLocal, queueDepthM);

  const stallW = input.stall.width;
  const stallL = input.stall.length;
  const aisle = input.aisleWidth;
  const budget: Budget = { used: 0, limit: LIMITS.maxIterations };

  // --- 7. Perimeter stall + aisle modules (shared across all candidates) --
  const perimeter = buildPerimeter(
    usableLocal,
    blockingExclusionsLocal,
    corridorLocal,
    stallW,
    stallL,
    aisle,
    budget,
    warnings,
  );

  // --- 8. Interior region = usable minus accepted perimeter minus exclusions/corridor
  const subtract = [...perimeter.accepted, ...blockingExclusionsLocal, corridorLocal];
  const interiorRegions = computeInteriorRegion(usableLocal, subtract).filter(
    (r) => polygonAreaLocal(r) >= stallW * stallL,
  );

  const longestEdgeAngle = longestEdgeAngleOf(usableLocal);
  const allOrientations = interiorRegions.length > 0 ? deriveOrientations(usableLocal) : [];
  const draft = !!input.draft;
  const orientations = draft
    ? selectDraftOrientations(allOrientations, input.draftOrientationDeg)
    : allOrientations;

  // --- 9. Candidate assembly: shared perimeter, varying interior fill -----
  const rawCandidates: CandidateLayout[] = [];
  let emittedPerimeterOnly = false;

  const m2 = {
    vehicle: input.vehicle,
    oneWay: input.oneWay,
    accessible: input.accessible,
    snappedAccessLocal: snappedLocal,
  };

  if (orientations.length === 0) {
    const candidate = assembleCandidate({
      perimeter,
      interior: null,
      corridorLocal,
      usableLocal,
      exclusionsLocal: blockingExclusionsLocal,
      proj,
      longestEdgeAngle,
      interiorAngleDeg: null,
      stallW,
      stallL,
      aisle,
      draft,
      ...m2,
    });
    if (candidate.stallCount > 0) rawCandidates.push(candidate);
  } else {
    for (const orientation of orientations) {
      if (budget.used > budget.limit) break;
      const alpha = orientation.rowAngleDeg;
      const interiorRows: LocalRowBuild[] = [];
      const interiorAisles: LocalAisleBuild[] = [];
      interiorRegions.forEach((region, ri) => {
        const built = fillInteriorComponent({
          region,
          orientationDeg: alpha,
          stallW,
          stallL,
          aisle,
          exclusions: blockingExclusionsLocal,
          corridor: corridorLocal,
          perimeterAccepted: perimeter.accepted,
          budget,
          idPrefix: `int-${Math.round(alpha)}-${ri}`,
        });
        interiorRows.push(...built.rows);
        interiorAisles.push(...built.aisles);
      });

      const hasInterior = interiorRows.length > 0;
      // Interior collapsing to nothing for every orientation would otherwise
      // produce N near-identical perimeter-only candidates — emit exactly one.
      if (!hasInterior && emittedPerimeterOnly) continue;

      const candidate = assembleCandidate({
        perimeter,
        interior: { rows: interiorRows, aisles: interiorAisles },
        corridorLocal,
        usableLocal,
        exclusionsLocal: blockingExclusionsLocal,
        proj,
        longestEdgeAngle,
        interiorAngleDeg: alpha,
        stallW,
        stallL,
        aisle,
        draft,
        ...m2,
      });
      if (candidate.stallCount === 0) continue;
      if (!hasInterior) emittedPerimeterOnly = true;
      rawCandidates.push(candidate);
    }
  }

  if (budget.used > budget.limit) {
    warnings.push({
      code: 'generation-truncated',
      message: 'Generation hit a safety limit and was truncated.',
    });
  }

  // --- 10. Best, meaningfully-different candidates -------------------------
  const maxCandidates = clamp(
    input.options?.maxCandidates ?? LIMITS.maxCandidates,
    1,
    LIMITS.maxCandidates,
  );
  const candidates = selectDistinct(rawCandidates, maxCandidates);

  if (candidates.length === 0) {
    warnings.push({
      code: 'no-spaces',
      message:
        'No valid parking spaces could be placed. The usable area may be too small or too obstructed.',
    });
  }

  return {
    snappedAccessPoint: proj.toLngLat(snappedLocal),
    usableBoundary: { ring: unprojectRing(usableLocal, proj) },
    expandedExclusions: expandedExclusionsLocal.map((r) => ({ ring: unprojectRing(r, proj) })),
    candidates,
    warnings: dedupeWarnings(warnings),
  };
}

// ---------------------------------------------------------------------------
// 1. Validation
// ---------------------------------------------------------------------------
type ValidationResult =
  | { ok: true; warnings: SolverWarning[] }
  | { ok: false; warnings: SolverWarning[] };

function validateInput(input: SolverInput): ValidationResult {
  const warnings: SolverWarning[] = [];

  if (!input.boundary || !Array.isArray(input.boundary.ring)) {
    return fail('missing-boundary', 'No site boundary was provided.');
  }
  const ring = dropClosing(input.boundary.ring);
  if (ring.length < 3) {
    return fail('degenerate-boundary', 'The site boundary needs at least three points.');
  }
  if (ring.length > LIMITS.maxVertices) {
    return fail(
      'boundary-too-complex',
      `The site boundary has too many vertices (limit ${LIMITS.maxVertices}).`,
    );
  }
  if (!ring.every(isFinitePair)) {
    return fail('invalid-coordinates', 'The site boundary contains invalid coordinates.');
  }

  // Guard against self-intersecting / degenerate rings. We run our own robust
  // edge-crossing test first (Turf's booleanValid does not reliably flag simple
  // bowties in every version), then Turf as a secondary check.
  if (isSelfIntersecting(ring) || !isValidPolygonRing(input.boundary.ring)) {
    return fail(
      'self-intersecting-boundary',
      'The site boundary is self-intersecting or otherwise invalid.',
    );
  }

  // Stall / aisle sanity (do not fail — clamp with a warning so the UI stays usable).
  if (input.stall.width < LIMITS.minStallDim || input.stall.length < LIMITS.minStallDim) {
    return fail('invalid-stall', 'Stall dimensions are too small to be meaningful.');
  }
  if (input.aisleWidth < LIMITS.minAisle) {
    warnings.push({
      code: 'narrow-aisle',
      message: `Aisle width is below ${LIMITS.minAisle} m; results are conceptual only.`,
    });
  }
  if (input.boundarySetback < 0 || input.exclusionClearance < 0) {
    return fail('negative-offset', 'Setback and clearance must be zero or positive.');
  }

  for (const ex of input.exclusions ?? []) {
    const exRing = dropClosing(ex.ring);
    if (exRing.length >= 3 && exRing.length > LIMITS.maxVertices) {
      return fail(
        'exclusion-too-complex',
        `An exclusion polygon has too many vertices (limit ${LIMITS.maxVertices}).`,
      );
    }
  }

  return { ok: true, warnings };

  function fail(code: string, message: string): ValidationResult {
    return { ok: false, warnings: [{ code, message }] };
  }
}

function isFinitePair(p: LngLat): boolean {
  return Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1]);
}

/** True if any pair of non-adjacent edges of the ring cross (bowtie etc.). */
function isSelfIntersecting(ring: LngLat[]): boolean {
  const pts = dropClosing(ring);
  const n = pts.length;
  if (n < 4) return false;
  for (let i = 0; i < n; i++) {
    const a1 = pts[i];
    const a2 = pts[(i + 1) % n];
    for (let j = i + 1; j < n; j++) {
      if (j === i) continue;
      if ((j + 1) % n === i || (i + 1) % n === j) continue;
      const b1 = pts[j];
      const b2 = pts[(j + 1) % n];
      const d1 = crossDir(b1, b2, a1);
      const d2 = crossDir(b1, b2, a2);
      const d3 = crossDir(a1, a2, b1);
      const d4 = crossDir(a1, a2, b2);
      if (
        ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
        ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))
      ) {
        return true;
      }
    }
  }
  return false;
}

function isValidPolygonRing(ring: LngLat[]): boolean {
  try {
    const closed = closeLngLatRing(ring);
    const feat = turfPolygon([closed]);
    return booleanValid(feat);
  } catch {
    return false;
  }
}

function closeLngLatRing(ring: LngLat[]): LngLat[] {
  const open = dropClosing(ring);
  return [...open, open[0]];
}

// ---------------------------------------------------------------------------
// 3/4. Turf-backed polygon offsetting.
// ---------------------------------------------------------------------------
function insetBoundary(
  ring: LngLat[],
  setback: number,
  proj: LocalProjection,
  warnings: SolverWarning[],
): LocalRing | null {
  if (setback <= 0) {
    return ensureCCW(projectRing(ring, proj));
  }
  try {
    const feat = turfPolygon([closeLngLatRing(ring)]);
    const result = buffer(feat, -setback, { units: 'meters' });
    if (!result || !result.geometry) {
      warnings.push({
        code: 'setback-empty',
        message: 'The setback could not be applied cleanly; using the raw boundary.',
      });
      return ensureCCW(projectRing(ring, proj));
    }
    const largest = largestPolygonRing(result.geometry);
    if (!largest) return null;
    return ensureCCW(projectRing(largest, proj));
  } catch {
    warnings.push({
      code: 'setback-failed',
      message: 'Setback geometry operation failed; using the raw boundary.',
    });
    return ensureCCW(projectRing(ring, proj));
  }
}

function expandExclusions(
  exclusions: PolygonInput[] | undefined,
  clearance: number,
  proj: LocalProjection,
  warnings: SolverWarning[],
): LocalRing[] {
  const out: LocalRing[] = [];
  for (const ex of exclusions ?? []) {
    const exRing = dropClosing(ex.ring);
    if (exRing.length < 3 || !exRing.every(isFinitePair)) {
      warnings.push({
        code: 'exclusion-skipped',
        message: 'An exclusion polygon was invalid and was skipped.',
      });
      continue;
    }
    if (clearance <= 0) {
      out.push(ensureCW(projectRing(ex.ring, proj)));
      continue;
    }
    try {
      const feat = turfPolygon([closeLngLatRing(ex.ring)]);
      const result = buffer(feat, clearance, { units: 'meters' });
      if (result && result.geometry) {
        for (const r of allPolygonRings(result.geometry)) {
          out.push(ensureCW(projectRing(r, proj)));
        }
      } else {
        out.push(ensureCW(projectRing(ex.ring, proj)));
      }
    } catch {
      warnings.push({
        code: 'exclusion-buffer-failed',
        message: 'An exclusion buffer failed; using its raw outline.',
      });
      out.push(ensureCW(projectRing(ex.ring, proj)));
    }
  }
  return out;
}

/** Pick the outer ring of the largest-area polygon in a (Multi)Polygon geometry. */
function largestPolygonRing(geom: GeoJSON.Geometry): LngLat[] | null {
  const rings = allPolygonRings(geom);
  if (rings.length === 0) return null;
  let best = rings[0];
  let bestArea = ringAreaLngLat(best);
  for (const r of rings.slice(1)) {
    const a = ringAreaLngLat(r);
    if (a > bestArea) {
      best = r;
      bestArea = a;
    }
  }
  return best;
}

/** All outer rings across Polygon / MultiPolygon (holes ignored — MVP scope). */
function allPolygonRings(geom: GeoJSON.Geometry): [number, number][][] {
  if (geom.type === 'Polygon') {
    return geom.coordinates.length ? [geom.coordinates[0] as [number, number][]] : [];
  }
  if (geom.type === 'MultiPolygon') {
    return geom.coordinates
      .filter((poly) => poly.length > 0)
      .map((poly) => poly[0] as [number, number][]);
  }
  return [];
}

function ringAreaLngLat(ring: LngLat[]): number {
  const pts = dropClosing(ring);
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[(i + 1) % pts.length];
    a += x1 * y2 - x2 * y1;
  }
  return Math.abs(a / 2);
}

// ---------------------------------------------------------------------------
// 5. Snap access point to nearest boundary edge + inward normal.
// ---------------------------------------------------------------------------
function snapToBoundary(
  pt: LocalPoint,
  boundary: LocalRing,
): { point: LocalPoint; inwardNormal: LocalPoint } {
  const pts = dropClosingLocal(boundary);
  let best: LocalPoint = pts[0];
  let bestDist = Infinity;
  let bestA: LocalPoint = pts[0];
  let bestB: LocalPoint = pts[1] ?? pts[0];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    const seg = pointToSegment(pt, a, b);
    if (seg.distance < bestDist) {
      bestDist = seg.distance;
      best = seg.closest;
      bestA = a;
      bestB = b;
    }
  }
  const ex = bestB[0] - bestA[0];
  const ey = bestB[1] - bestA[1];
  const len = Math.hypot(ex, ey) || 1;
  let nx = -ey / len;
  let ny = ex / len;
  const probe: LocalPoint = [best[0] + nx * 0.5, best[1] + ny * 0.5];
  if (!pointInRing(probe, boundary)) {
    nx = -nx;
    ny = -ny;
  }
  return { point: best, inwardNormal: [nx, ny] };
}

// ---------------------------------------------------------------------------
// 6. Access corridor: a straight reserved strip from the snapped point inward.
// ---------------------------------------------------------------------------
function buildAccessCorridor(
  snapped: LocalPoint,
  inward: LocalPoint,
  usable: LocalRing,
  /** M2 gate queue: extra depth reserved for vehicles queuing ahead of the gate. */
  extraDepthM = 0,
): LocalRing {
  const [minX, minY, maxX, maxY] = bboxLocal(usable);
  const extent = Math.hypot(maxX - minX, maxY - minY);
  const depth = clamp(0.4 * extent, 12, 50) + Math.max(0, extraDepthM);
  const halfW = clamp(0.5 * 6, 2, 6);

  const [dx, dy] = inward;
  const px = -dy;
  const py = dx;

  const start = snapped;
  const end: LocalPoint = [snapped[0] + dx * depth, snapped[1] + dy * depth];

  const ring: LocalRing = [
    [start[0] + px * halfW, start[1] + py * halfW],
    [end[0] + px * halfW, end[1] + py * halfW],
    [end[0] - px * halfW, end[1] - py * halfW],
    [start[0] - px * halfW, start[1] - py * halfW],
  ];
  return closeRing(ring);
}

// ---------------------------------------------------------------------------
// 2B. Canonicalise + preprocess the usable boundary.
// ---------------------------------------------------------------------------
/**
 * Rotate the vertex list to a deterministic start and merge near-collinear
 * runs. Doing this ONCE, right after inset, means the rest of the pipeline
 * (which processes edges in array order) is invariant to cyclic reordering,
 * reversed winding, or Turf's arbitrary buffer vertex-start — those are all
 * normalised away here rather than needing order-independent logic downstream.
 */
function canonicalizeRing(ring: LocalRing): LocalRing {
  const merged = mergeCollinear(dropClosingLocal(ring));
  if (merged.length < 3) return merged;
  let startIdx = 0;
  for (let i = 1; i < merged.length; i++) {
    const a = merged[i];
    const b = merged[startIdx];
    if (a[0] < b[0] - EPS || (Math.abs(a[0] - b[0]) <= EPS && a[1] < b[1])) startIdx = i;
  }
  return [...merged.slice(startIdx), ...merged.slice(0, startIdx)];
}

function mergeCollinear(pts: LocalRing): LocalRing {
  if (pts.length < 4) return pts;
  const TURN_TOL_DEG = 5;
  let cur = pts;
  for (let pass = 0; pass < 3; pass++) {
    const out: LocalRing = [];
    const n = cur.length;
    let changed = false;
    for (let i = 0; i < n; i++) {
      const prev = cur[(i - 1 + n) % n];
      const p = cur[i];
      const next = cur[(i + 1) % n];
      if (dist(prev, p) < EPS || dist(p, next) < EPS) {
        changed = true;
        continue;
      }
      const a1 = angleOf(p[0] - prev[0], p[1] - prev[1]);
      const a2 = angleOf(next[0] - p[0], next[1] - p[1]);
      const d = angularDiff(a1, a2);
      if (d < TURN_TOL_DEG) {
        changed = true;
        continue;
      }
      out.push(p);
    }
    if (out.length >= 3) cur = out;
    if (!changed) break;
  }
  return cur;
}

// ---------------------------------------------------------------------------
// 2C/2D. Perimeter stall + aisle modules (built together, one edge at a time).
// ---------------------------------------------------------------------------
type LocalRowBuild = {
  rowId: string;
  aisleId: string;
  orientationDeg: number;
  loading: 'double' | 'single';
  placement: 'perimeter' | 'interior';
  stalls: LocalRing[]; // each entry: 4-point open rect in local metres
};

type LocalAisleBuild = {
  aisleId: string;
  role: 'perimeter' | 'interior' | 'spine' | 'turning';
  ring: LocalRing; // closed
};

function buildPerimeter(
  usable: LocalRing,
  exclusions: LocalRing[],
  corridor: LocalRing,
  stallW: number,
  stallL: number,
  aisle: number,
  budget: Budget,
  warnings: SolverWarning[],
): { rows: LocalRowBuild[]; aisles: LocalAisleBuild[]; accepted: LocalRing[] } {
  const rows: LocalRowBuild[] = [];
  const aisles: LocalAisleBuild[] = [];
  const accepted: LocalRing[] = [];
  const pts = usable;
  const n = pts.length;
  const CORNER_CLEARANCE = aisle / 2;
  const PROBE_STEP = Math.max(0.5, stallW / 3);
  let aisleCounter = 0;
  let rowCounter = 0;
  let sawNarrowEdge = false;

  for (let i = 0; i < n; i++) {
    if (budget.used > budget.limit) break;
    const a = pts[i];
    const b = pts[(i + 1) % n];
    const edgeLen = dist(a, b);
    if (edgeLen < EPS) continue;
    const ex = (b[0] - a[0]) / edgeLen;
    const ey = (b[1] - a[1]) / edgeLen;
    const nx = -ey; // inward normal (usable is CCW; interior lies to the left of a directed edge)
    const ny = ex;

    const tMin = CORNER_CLEARANCE;
    const tMax = edgeLen - CORNER_CLEARANCE;
    if (tMax - tMin < stallW - EPS) {
      sawNarrowEdge = true;
      continue;
    }

    const isValidSlice = (t0: number, t1: number): boolean => {
      const stall = edgeRect(a, ex, ey, nx, ny, t0, t1, 0, stallL);
      const aisleSlice = edgeRect(a, ex, ey, nx, ny, t0, t1, stallL, stallL + aisle);
      return (
        polygonInsideTol(stall, usable, EDGE_TOL) &&
        !exclusions.some((e) => polygonsOverlap(stall, e)) &&
        !polygonsOverlap(stall, corridor) &&
        !accepted.some((p) => polygonsOverlap(stall, p)) &&
        !exclusions.some((e) => polygonsOverlap(aisleSlice, e)) &&
        !polygonsOverlap(aisleSlice, corridor) &&
        !accepted.some((p) => polygonsOverlap(aisleSlice, p))
      );
    };

    const validStarts: number[] = [];
    let t = tMin;
    while (t + stallW <= tMax + EPS) {
      budget.used++;
      if (budget.used > budget.limit) break;
      if (isValidSlice(t, t + stallW)) validStarts.push(t);
      t += PROBE_STEP;
    }

    const groups: number[][] = [];
    let curGroup: number[] = [];
    for (const s of validStarts) {
      if (curGroup.length === 0 || s - curGroup[curGroup.length - 1] <= PROBE_STEP + EPS) {
        curGroup.push(s);
      } else {
        groups.push(curGroup);
        curGroup = [s];
      }
    }
    if (curGroup.length) groups.push(curGroup);

    for (const g of groups) {
      // Stable centred placement: distribute leftover slack evenly at both ends of the free run.
      const runStart = g[0];
      const freeLen = g[g.length - 1] + stallW - runStart;
      const count = Math.floor(freeLen / stallW);
      // Skip solos/stubs: a sub-minimum run is dropped along with its aisle and
      // `accepted` reservation (all committed below this guard), so nothing is
      // stranded and the interior region isn't wrongly reserved for it.
      if (count < LIMITS.minStallsPerRun) continue;
      const offset = (freeLen - count * stallW) / 2;
      const s0 = runStart + offset;
      const s1 = s0 + count * stallW;

      const stallRects: LocalRing[] = [];
      for (let k = 0; k < count; k++) {
        const st = s0 + k * stallW;
        stallRects.push(edgeRect(a, ex, ey, nx, ny, st, st + stallW, 0, stallL));
      }
      const aisleRectRaw = edgeRect(a, ex, ey, nx, ny, s0, s1, stallL, stallL + aisle);
      const clippedAisle = clipRingToBoundary(aisleRectRaw, usable) ?? dropClosingLocal(aisleRectRaw);

      // Individual PROBE_STEP-spaced slices were validated, but the centred
      // run's final extent can fall between probes — re-verify the assembled
      // shapes before committing rather than trusting the sampled coverage.
      const runInvalid =
        exclusions.some((e) => polygonsOverlap(clippedAisle, e) || stallRects.some((s) => polygonsOverlap(s, e))) ||
        polygonsOverlap(clippedAisle, corridor) ||
        stallRects.some((s) => polygonsOverlap(s, corridor));
      if (runInvalid) continue;

      aisleCounter++;
      rowCounter++;
      const aisleId = `perim-aisle-${aisleCounter}`;
      rows.push({
        rowId: `perim-row-${rowCounter}`,
        aisleId,
        orientationDeg: angleOf(ex, ey),
        loading: 'single',
        placement: 'perimeter',
        stalls: stallRects,
      });
      aisles.push({ aisleId, role: 'perimeter', ring: closeRing(clippedAisle) });
      // Push ONE combined rectangle for the whole run rather than each stall
      // individually: the stalls are contiguous (zero gap) so the union is
      // identical, and Turf's difference() is far more robust subtracting a
      // handful of simple rectangles than dozens of edge-touching slivers.
      accepted.push(dropClosingLocal(edgeRect(a, ex, ey, nx, ny, s0, s1, 0, stallL)));
      accepted.push(clippedAisle);
    }
  }

  if (sawNarrowEdge) {
    warnings.push({
      code: 'perimeter-edge-too-narrow',
      message:
        'One or more boundary edges were too short for a full perimeter parking module and were skipped.',
    });
  }

  return { rows, aisles, accepted };
}

/** Rectangle along an edge: [t0,t1] along the edge direction, [d0,d1] along the inward normal. */
function edgeRect(
  origin: LocalPoint,
  ex: number,
  ey: number,
  nx: number,
  ny: number,
  t0: number,
  t1: number,
  d0: number,
  d1: number,
): LocalRing {
  const p = (t: number, d: number): LocalPoint => [origin[0] + ex * t + nx * d, origin[1] + ey * t + ny * d];
  return [p(t0, d0), p(t1, d0), p(t1, d1), p(t0, d1)];
}

// ---------------------------------------------------------------------------
// 2D. Interior region (Turf difference) + band-sweep fill.
// ---------------------------------------------------------------------------
/**
 * Subtract one polygon at a time rather than passing the whole subtract set to
 * a single N-way Turf difference call. The perimeter's accepted stalls/aisles
 * are dozens of mutually-adjacent (edge-touching) rectangles — a "picket
 * fence" pattern that Turf's underlying polygon-clipping routinely throws on
 * when asked to process all of them simultaneously, even though each is a
 * simple rectangle. Pairwise differencing is far more robust. If one pairwise
 * step still fails, keep that ring unmodified rather than discarding the
 * whole result — the perimeter-vs-interior overlap checks downstream are the
 * safety net for whatever area that leaves un-subtracted.
 */
function computeInteriorRegion(usable: LocalRing, subtract: LocalRing[]): LocalRing[] {
  let current: LocalRing[] = [dropClosingLocal(usable)];
  for (const sub of subtract) {
    const next: LocalRing[] = [];
    for (const ring of current) {
      try {
        const a = turfPolygon([closeRing(ring)]);
        const b = turfPolygon([closeRing(sub)]);
        const result = difference(featureCollection([a, b]));
        if (!result || !result.geometry) continue;
        next.push(...allPolygonRings(result.geometry).map(dropClosingLocal));
      } catch {
        next.push(ring);
      }
    }
    current = next;
    if (current.length === 0) break;
  }
  return current;
}

function fillInteriorComponent(args: {
  region: LocalRing;
  orientationDeg: number;
  stallW: number;
  stallL: number;
  aisle: number;
  exclusions: LocalRing[];
  corridor: LocalRing;
  perimeterAccepted: LocalRing[];
  budget: Budget;
  idPrefix: string;
}): { rows: LocalRowBuild[]; aisles: LocalAisleBuild[] } {
  const { region, orientationDeg: alpha, stallW, stallL, aisle, exclusions, corridor, perimeterAccepted, budget, idPrefix } =
    args;
  const rows: LocalRowBuild[] = [];
  const aisles: LocalAisleBuild[] = [];
  if (polygonAreaLocal(region) < stallW * stallL) return { rows, aisles };

  const regionRot = region.map((p) => rotate(p, -alpha));
  const exclusionsRot = exclusions.map((r) => r.map((p) => rotate(p, -alpha)));
  const corridorRot = corridor.map((p) => rotate(p, -alpha));
  const perimRot = perimeterAccepted.map((r) => r.map((p) => rotate(p, -alpha)));

  const SWEEP_EPS = 0.02;
  const [bxMin, byMin, bxMax, byMax] = bboxLocal(regionRot);
  const minX = bxMin + SWEEP_EPS;
  const maxX = bxMax - SWEEP_EPS;
  const minY = byMin + SWEEP_EPS;
  const maxY = byMax - SWEEP_EPS;
  const moduleH = 2 * stallL + aisle;
  const singleH = stallL + aisle;

  let aisleCounter = 0;
  let rowCounter = 0;
  let y = minY;

  while (y + stallL <= maxY + EPS) {
    if (budget.used > budget.limit) break;
    const remaining = maxY - y;
    let bands: { ry: number; loading: 'double' | 'single'; aisleY: number }[];
    let aisleRectRaw: LocalRing;
    if (remaining >= moduleH - EPS) {
      bands = [
        { ry: y, loading: 'double', aisleY: y + stallL },
        { ry: y + stallL + aisle, loading: 'double', aisleY: y + stallL },
      ];
      aisleRectRaw = makeAisleRect(minX, maxX, y + stallL, aisle);
      y += moduleH;
    } else if (remaining >= singleH - EPS) {
      bands = [{ ry: y + aisle, loading: 'single', aisleY: y }];
      aisleRectRaw = makeAisleRect(minX, maxX, y, aisle);
      y += singleH;
    } else {
      break;
    }

    let clippedAisle = clipRingToBoundary(aisleRectRaw, regionRot);
    // Safety net: `region` should already exclude perimeter geometry,
    // exclusions and the corridor (all were subtracted upstream), but if that
    // subtraction silently failed for a particular polygon, re-clip against
    // it here rather than either ignoring the overlap OR discarding the
    // whole band — most of a band is usually still valid.
    if (
      clippedAisle &&
      (perimRot.some((p) => polygonsOverlap(clippedAisle!, p)) ||
        exclusionsRot.some((e) => polygonsOverlap(clippedAisle!, e)) ||
        polygonsOverlap(clippedAisle, corridorRot))
    ) {
      clippedAisle = subtractAll(clippedAisle, [corridorRot, ...exclusionsRot, ...perimRot]);
    }
    if (!clippedAisle || polygonAreaLocal(clippedAisle) < EPS) continue;

    aisleCounter++;
    const aisleId = `${idPrefix}-aisle-${aisleCounter}`;
    let used = false;

    for (const band of bands) {
      const built = sweepRowInterior({
        ry: band.ry,
        aisleY: band.aisleY,
        minX,
        maxX,
        stallW,
        stallL,
        aisle,
        region: regionRot,
        exclusions: exclusionsRot,
        corridor: corridorRot,
        perimeter: perimRot,
        aisleRing: clippedAisle,
      });
      budget.used += built.iterations;
      for (const stallGroup of built.rows) {
        rowCounter++;
        const stallsUnrot = stallGroup.map((r) => r.map((p) => rotate(p, alpha)) as LocalRing);
        rows.push({
          rowId: `${idPrefix}-row-${rowCounter}`,
          aisleId,
          orientationDeg: foldAngle(alpha),
          loading: band.loading,
          placement: 'interior',
          stalls: stallsUnrot,
        });
        used = true;
      }
      if (budget.used > budget.limit) break;
    }
    if (used) {
      aisles.push({
        aisleId,
        role: 'interior',
        ring: closeRing(clippedAisle.map((p) => rotate(p, alpha)) as LocalRing),
      });
    }
  }

  return { rows, aisles };
}

function sweepRowInterior(args: {
  ry: number;
  aisleY: number;
  minX: number;
  maxX: number;
  stallW: number;
  stallL: number;
  aisle: number;
  region: LocalRing;
  exclusions: LocalRing[];
  corridor: LocalRing;
  perimeter: LocalRing[];
  aisleRing: LocalRing;
}): { rows: LocalRing[][]; iterations: number } {
  const { ry, aisleY, minX, maxX, stallW, stallL, aisle, region, exclusions, corridor, perimeter, aisleRing } = args;
  const rows: LocalRing[][] = [];
  let current: LocalRing[] = [];
  let iterations = 0;
  const aisleDir = aisleY < ry ? -1 : 1;
  let x = minX;
  while (x + stallW <= maxX + EPS) {
    iterations++;
    const stall: LocalRing = [
      [x, ry],
      [x + stallW, ry],
      [x + stallW, ry + stallL],
      [x, ry + stallL],
    ];
    const probe: LocalPoint = [x + stallW / 2, aisleDir < 0 ? ry - aisle / 2 : ry + stallL + aisle / 2];
    const valid =
      polygonInside(stall, region) &&
      !exclusions.some((e) => polygonsOverlap(stall, e)) &&
      !polygonsOverlap(stall, corridor) &&
      !perimeter.some((p) => polygonsOverlap(stall, p)) &&
      pointInRing(probe, aisleRing);
    if (valid) {
      current.push(stall);
    } else if (current.length > 0) {
      // Emit the run only if it clears the solo/stub minimum; otherwise discard
      // it (a lone stall stranded between obstructions is unrealistic).
      if (current.length >= LIMITS.minStallsPerRun) rows.push(current);
      current = [];
    }
    x += stallW;
  }
  if (current.length >= LIMITS.minStallsPerRun) rows.push(current);
  return { rows, iterations };
}

function makeAisleRect(minX: number, maxX: number, y0: number, aisle: number): LocalRing {
  return closeRing([
    [minX, y0],
    [maxX, y0],
    [maxX, y0 + aisle],
    [minX, y0 + aisle],
  ]);
}

/** Clip `ring` to lie within `boundary`, via Turf intersect (used for aisle geometry near concave corners). */
/**
 * Subtract each of `subtrahends` from `ring` one at a time (same pairwise
 * robustness rationale as `computeInteriorRegion`), keeping only the largest
 * remaining piece at each step. Used as a targeted re-clip when a band's
 * aisle rectangle still overlaps something `region` should already have
 * excluded.
 */
function subtractAll(ring: LocalRing, subtrahends: LocalRing[]): LocalRing | null {
  let current: LocalRing | null = dropClosingLocal(ring);
  for (const sub of subtrahends) {
    if (!current) break;
    try {
      const a = turfPolygon([closeRing(current)]);
      const b = turfPolygon([closeRing(sub)]);
      const result = difference(featureCollection([a, b]));
      if (!result || !result.geometry) {
        current = null;
        break;
      }
      const rings = allPolygonRings(result.geometry).map(dropClosingLocal);
      if (rings.length === 0) {
        current = null;
        break;
      }
      let best = rings[0];
      let bestArea = polygonAreaLocal(best);
      for (const r of rings.slice(1)) {
        const ar = polygonAreaLocal(r);
        if (ar > bestArea) {
          best = r;
          bestArea = ar;
        }
      }
      current = best;
    } catch {
      // Keep `current` unchanged if this particular subtraction fails.
    }
  }
  return current;
}

function clipRingToBoundary(ring: LocalRing, boundary: LocalRing): LocalRing | null {
  if (polygonInside(ring, boundary)) return dropClosingLocal(ring);
  try {
    const a = turfPolygon([closeRing(ring)]);
    const b = turfPolygon([closeRing(boundary)]);
    const result = intersect(featureCollection([a, b]));
    if (!result || !result.geometry) return null;
    const rings = allPolygonRings(result.geometry).map(dropClosingLocal);
    if (rings.length === 0) return null;
    let best = rings[0];
    let bestArea = polygonAreaLocal(best);
    for (const r of rings.slice(1)) {
      const ar = polygonAreaLocal(r);
      if (ar > bestArea) {
        best = r;
        bestArea = ar;
      }
    }
    return best;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Orientation derivation.
// ---------------------------------------------------------------------------
function edgesOf(ring: LocalRing): { angle: number; length: number }[] {
  const pts = dropClosingLocal(ring);
  const out: { angle: number; length: number }[] = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    out.push({ angle: angleOf(b[0] - a[0], b[1] - a[1]), length: dist(a, b) });
  }
  return out;
}

function longestEdgeAngleOf(ring: LocalRing): number {
  const edges = edgesOf(ring);
  if (edges.length === 0) return 0;
  return edges.reduce((best, e) => (e.length > best.length ? e : best), edges[0]).angle;
}

function deriveOrientations(usable: LocalRing): Orientation[] {
  const edges = [...edgesOf(usable)].sort((e1, e2) => e2.length - e1.length);

  const angles: number[] = [];
  const pushAngle = (deg: number) => {
    const norm = foldAngle(deg);
    if (!angles.some((a) => angularDiff(a, norm) < 8)) angles.push(norm);
  };

  if (edges.length > 0) {
    pushAngle(edges[0].angle);
    pushAngle(edges[0].angle + 90);
  }
  for (const e of edges.slice(1)) {
    if (angles.length >= LIMITS.maxOrientations) break;
    if (angles.every((a) => angularDiff(a, e.angle) > 12)) {
      pushAngle(e.angle);
      pushAngle(e.angle + 90);
    }
  }
  if (angles.length === 0) angles.push(0, 90);

  const longest = edges[0]?.angle ?? 0;
  return angles.slice(0, LIMITS.maxOrientations).map((angle) => ({
    rowAngleDeg: round(angle, 3),
    label: orientationLabel(angle, longest),
  }));
}

/**
 * Draft mode: instead of the full orientation sweep, generate just ONE
 * orientation — whichever is nearest `preferredDeg` (the row angle the user
 * currently has selected, so the live preview doesn't flip orientation mid-
 * drag), or the first 1-2 candidates when no preference is available yet
 * (e.g. before any full solve has run).
 */
function selectDraftOrientations(all: Orientation[], preferredDeg?: number): Orientation[] {
  if (all.length === 0) return all;
  if (preferredDeg === undefined) return all.slice(0, Math.min(2, all.length));
  let best = all[0];
  let bestDiff = angularDiff(all[0].rowAngleDeg, preferredDeg);
  for (const o of all.slice(1)) {
    const d = angularDiff(o.rowAngleDeg, preferredDeg);
    if (d < bestDiff) {
      bestDiff = d;
      best = o;
    }
  }
  return [best];
}

function orientationLabel(angle: number, longestEdgeAngle: number): string {
  const d = angularDiff(angle, longestEdgeAngle);
  if (d < 8) return 'aligned to longest edge';
  if (Math.abs(d - 90) < 8) return 'perpendicular to longest edge';
  return `rows at ${round(angle, 0)}°`;
}

// ---------------------------------------------------------------------------
// 2F. Circulation connectivity.
// ---------------------------------------------------------------------------
/**
 * Interior/perimeter/corridor regions are carved apart via Turf subtraction, so
 * aisles that should connect typically share an exact edge rather than truly
 * overlap. Treat "touching within tolerance" as connected, not just crossing.
 */
const CONNECT_TOL = 0.1;
function polygonsConnected(a: LocalRing, b: LocalRing, tol: number): boolean {
  if (polygonsOverlap(a, b)) return true;
  const ap = dropClosingLocal(a);
  for (const p of ap) {
    if (distanceToRing(p, b) < tol) return true;
  }
  const bp = dropClosingLocal(b);
  for (const p of bp) {
    if (distanceToRing(p, a) < tol) return true;
  }
  return false;
}

function ensureConnectivity(
  aisles: LocalAisleBuild[],
  corridor: LocalRing,
  aisleWidth: number,
  blockers: LocalRing[],
  usable: LocalRing,
): { aisles: LocalAisleBuild[]; reachableIds: Set<string> } {
  // One connector per disconnected component, worst case — perimeter edges
  // are deliberately clipped apart at corners, so this is routinely exercised,
  // not just an edge case. A complex boundary can have dozens of perimeter
  // aisles and hundreds of stall "blockers" to route around, so this search
  // is bounded on every axis: nearest-K candidates per aisle, bbox-prefiltered
  // blocker checks, and a hard cap on total pair evaluations.
  const MAX_EXTRA = 20;
  const MAX_PAIR_EVALS = 3000;
  const NEAREST_K = 6;
  let pairEvals = 0;
  const working = [...aisles];
  let extra = 0;
  const blockerEntries = blockers.map((ring) => ({ ring, box: bboxLocal(ring) }));

  const flood = (): Set<string> => {
    const reached = new Set<string>();
    const queue: LocalAisleBuild[] = [];
    for (const a of working) {
      if (polygonsConnected(a.ring, corridor, CONNECT_TOL)) {
        reached.add(a.aisleId);
        queue.push(a);
      }
    }
    while (queue.length) {
      const cur = queue.pop()!;
      for (const a of working) {
        if (!reached.has(a.aisleId) && polygonsConnected(cur.ring, a.ring, CONNECT_TOL)) {
          reached.add(a.aisleId);
          queue.push(a);
        }
      }
    }
    return reached;
  };

  let reached = flood();
  while (extra < MAX_EXTRA && pairEvals < MAX_PAIR_EVALS) {
    const unreached = working.filter((a) => !reached.has(a.aisleId));
    if (unreached.length === 0) break;
    const reachedAll: LocalRing[] = [corridor, ...working.filter((a) => reached.has(a.aisleId)).map((a) => a.ring)];

    let best: { rings: LocalRing[]; d: number } | null = null;
    for (const u of unreached) {
      const uCentroid = centroidLocal(u.ring);
      const nearest = reachedAll
        .map((r) => ({ r, d: dist(uCentroid, centroidLocal(r)) }))
        .sort((x, y) => x.d - y.d)
        .slice(0, NEAREST_K);
      for (const { r } of nearest) {
        if (pairEvals >= MAX_PAIR_EVALS) break;
        pairEvals++;
        const candidate = bestValidConnector(r, u.ring, blockerEntries, aisleWidth, usable);
        if (candidate && (!best || candidate.d < best.d)) best = candidate;
      }
    }
    // No stall-free, in-boundary connector exists this round — stop rather
    // than route through parked stalls or off the site.
    if (!best) break;
    for (const ring of best.rings) {
      extra++;
      working.push({ aisleId: `spine-${extra}`, role: 'spine', ring });
    }
    reached = flood();
  }

  return { aisles: working, reachableIds: reached };
}

function bboxesNear(a: [number, number, number, number], b: [number, number, number, number], margin: number): boolean {
  return !(a[2] + margin < b[0] || b[2] + margin < a[0] || a[3] + margin < b[1] || b[3] + margin < a[1]);
}

function segmentValid(
  p: LocalPoint,
  q: LocalPoint,
  width: number,
  blockerEntries: { ring: LocalRing; box: [number, number, number, number] }[],
  usable: LocalRing,
): LocalRing | null {
  const ring = buildConnector(p, q, width);
  if (!polygonInsideTol(ring, usable, EDGE_TOL)) return null;
  const box = bboxLocal(ring);
  const blocked = blockerEntries.some((b2) => bboxesNear(box, b2.box, 0) && polygonsOverlap(ring, b2.ring));
  return blocked ? null : ring;
}

function closestPointOnRing(p: LocalPoint, ring: LocalRing): LocalPoint {
  const pts = dropClosingLocal(ring);
  let best = pts[0];
  let bestD = Infinity;
  for (let i = 0; i < pts.length; i++) {
    const seg = pointToSegment(p, pts[i], pts[(i + 1) % pts.length]);
    if (seg.distance < bestD) {
      bestD = seg.distance;
      best = seg.closest;
    }
  }
  return best;
}

/**
 * Candidate connection points between two rings: vertex-to-vertex AND each
 * ring's vertices projected onto the other's edges. Two axis-touching-ish
 * rectangles (e.g. a corridor and an aisle it directly abuts) are usually
 * closest edge-to-edge, not corner-to-corner — vertex pairs alone miss that.
 */
function closestPointPairs(a: LocalRing, b: LocalRing): { p: LocalPoint; q: LocalPoint; d: number }[] {
  const ap = dropClosingLocal(a);
  const bp = dropClosingLocal(b);
  const pairs: { p: LocalPoint; q: LocalPoint; d: number }[] = [];
  for (const p of ap) {
    for (const q of bp) pairs.push({ p, q, d: dist(p, q) });
  }
  for (const p of ap) {
    const q = closestPointOnRing(p, b);
    pairs.push({ p, q, d: dist(p, q) });
  }
  for (const q of bp) {
    const p = closestPointOnRing(q, a);
    pairs.push({ p, q, d: dist(p, q) });
  }
  return pairs;
}

/**
 * Cheapest connector (by total length) between two rings that doesn't cross
 * any blocker (stalls/exclusions) and stays within the usable boundary. Tries
 * a direct straight segment first; if the site is concave enough that no
 * direct line stays inside, falls back to a single bend via a usable-boundary
 * vertex (enough to route around a notch like an L-shaped plot without a full
 * path planner — true swept-path routing is M2 scope).
 */
function bestValidConnector(
  a: LocalRing,
  b: LocalRing,
  blockerEntries: { ring: LocalRing; box: [number, number, number, number] }[],
  width: number,
  usable: LocalRing,
): { rings: LocalRing[]; d: number } | null {
  const pairs = closestPointPairs(a, b);
  pairs.sort((x, y) => x.d - y.d);
  for (const c of pairs) {
    const ring = segmentValid(c.p, c.q, width, blockerEntries, usable);
    if (ring) return { rings: [ring], d: c.d };
  }

  // A complex boundary can have dozens of vertices; only the ones nearest the
  // two rings can plausibly produce a short bend, so cap the candidate set
  // rather than trying every vertex on every fallback call.
  const MAX_WAYPOINTS = 10;
  const mid: LocalPoint = [
    (centroidLocal(a)[0] + centroidLocal(b)[0]) / 2,
    (centroidLocal(a)[1] + centroidLocal(b)[1]) / 2,
  ];
  const waypoints = dropClosingLocal(usable)
    .map((wp) => ({ wp, d: dist(wp, mid) }))
    .sort((x, y) => x.d - y.d)
    .slice(0, MAX_WAYPOINTS)
    .map((x) => x.wp);

  let best: { rings: LocalRing[]; d: number } | null = null;
  for (const wp of waypoints) {
    const nearP = closestPointOnRing(wp, a);
    const nearPD = dist(nearP, wp);
    const nearQ = closestPointOnRing(wp, b);
    const nearQD = dist(nearQ, wp);
    const total = nearPD + nearQD;
    if (best && total >= best.d) continue;
    const seg1 = segmentValid(nearP, wp, width, blockerEntries, usable);
    if (!seg1) continue;
    const seg2 = segmentValid(wp, nearQ, width, blockerEntries, usable);
    if (!seg2) continue;
    best = { rings: [seg1, seg2], d: total };
  }
  return best;
}

function buildConnector(p: LocalPoint, q: LocalPoint, width: number): LocalRing {
  const dx = q[0] - p[0];
  const dy = q[1] - p[1];
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const px = -uy;
  const py = ux;
  const h = width / 2;
  return closeRing([
    [p[0] + px * h, p[1] + py * h],
    [q[0] + px * h, q[1] + py * h],
    [q[0] - px * h, q[1] - py * h],
    [p[0] - px * h, p[1] - py * h],
  ]);
}

// ---------------------------------------------------------------------------
// 2E. Candidate assembly.
// ---------------------------------------------------------------------------
function assembleCandidate(args: {
  perimeter: { rows: LocalRowBuild[]; aisles: LocalAisleBuild[] };
  interior: { rows: LocalRowBuild[]; aisles: LocalAisleBuild[] } | null;
  corridorLocal: LocalRing;
  usableLocal: LocalRing;
  exclusionsLocal: LocalRing[];
  proj: LocalProjection;
  longestEdgeAngle: number;
  interiorAngleDeg: number | null;
  stallW: number;
  stallL: number;
  aisle: number;
  /** Draft mode: skip `ensureConnectivity`'s connector search (dominant cost). */
  draft?: boolean;
  // M2 — all optional, absence reproduces M1 behaviour exactly.
  vehicle?: Vehicle;
  oneWay?: boolean;
  accessible?: AccessiblePolicy;
  snappedAccessLocal?: LocalPoint;
}): CandidateLayout {
  const {
    perimeter,
    interior,
    corridorLocal,
    usableLocal,
    exclusionsLocal,
    proj,
    longestEdgeAngle,
    interiorAngleDeg,
    stallW,
    stallL,
    aisle,
    draft,
    vehicle,
    oneWay,
    accessible,
    snappedAccessLocal,
  } = args;

  const rawRows = [...perimeter.rows, ...(interior?.rows ?? [])];
  const allAislesRaw = [...perimeter.aisles, ...(interior?.aisles ?? [])];

  // M2: designate accessible bays by merging adjacent stall pairs in place —
  // safe (uses only already-validated space) and geometrically genuine (the
  // resulting bay really is wider), at the cost of one standard stall per bay.
  const preMergeStallCount = rawRows.reduce((n, r) => n + r.stalls.length, 0);
  const accessibleTarget = accessible ? Math.ceil(accessible.rate * preMergeStallCount) : 0;
  const { rows: workingRows, accessibleCount } =
    accessible && accessibleTarget > 0
      ? applyAccessibleBays(rawRows, accessibleTarget, snappedAccessLocal ?? centroidLocal(usableLocal))
      : { rows: rawRows.map((r) => ({ ...r, accessibleFlags: r.stalls.map(() => false) })), accessibleCount: 0 };

  const stallBlockers = workingRows.flatMap((r) => r.stalls);

  // Draft mode: skip the connector search entirely — it's the dominant cost
  // of a full solve. Treat every aisle as reachable; connectivity warnings
  // are irrelevant for a map-only preview that never reaches the results
  // panel.
  const { aisles: aislesWithConnectors, reachableIds } = draft
    ? { aisles: allAislesRaw, reachableIds: new Set(allAislesRaw.map((a) => a.aisleId)) }
    : ensureConnectivity(
        allAislesRaw,
        corridorLocal,
        aisle,
        [...stallBlockers, ...exclusionsLocal],
        usableLocal,
      );

  const warnings: SolverWarning[] = [];
  const stallCount = workingRows.reduce((n, r) => n + r.stalls.length, 0);
  const allReachable = allAislesRaw.length === 0 || allAislesRaw.every((a) => reachableIds.has(a.aisleId));
  const anyReachable = allAislesRaw.length === 0 || allAislesRaw.some((a) => reachableIds.has(a.aisleId));

  if (allAislesRaw.length > 0 && !anyReachable) {
    warnings.push({
      code: 'entrance-disconnected',
      message:
        'The access corridor does not reach the drive aisles; a route into the parking could not be confirmed.',
    });
  } else if (allAislesRaw.length > 0 && !allReachable) {
    warnings.push({
      code: 'partial-connectivity',
      message: 'Some parking areas may not connect to the entrance; treat those areas as indicative only.',
    });
  }

  // --- M2: manoeuvring validation (opt-in via `vehicle`) --------------------
  let m2Penalty = 0;
  let finalAisleSet = aislesWithConnectors;
  const travelDirById = new Map<string, 'oneway' | 'twoway'>();
  if (vehicle) {
    const required = requiredAisleWidthFor(stallW, vehicle);
    if (aisle < required) {
      m2Penalty += 60;
      warnings.push({
        code: 'approach-clearance-insufficient',
        message: `Drive-aisle width is below the ~${round(required, 1)} m this vehicle profile needs to turn into a stall in one manoeuvre.`,
      });
    }

    const turning = reserveTurningBays(
      aislesWithConnectors,
      corridorLocal,
      usableLocal,
      [...stallBlockers, ...exclusionsLocal],
      vehicle,
    );
    finalAisleSet = [...aislesWithConnectors, ...turning.turningAisles];
    m2Penalty += turning.deadEndPenalty;
    warnings.push(...turning.warnings);

    if (oneWay) {
      const directed = checkOneWayCirculation(finalAisleSet, corridorLocal, centroidLocal(usableLocal));
      directed.travelDirById.forEach((dir, id) => travelDirById.set(id, dir));
      if (!directed.ok) {
        m2Penalty += 40;
        warnings.push(...directed.warnings);
      }
    }
  }

  const finalRows: ParkingRow[] = workingRows.map((rb, idx) => {
    const stalls: Stall[] = rb.stalls.map((corners, sIdx) => ({
      index: sIdx,
      cornersLocal: closeLocalCorners(corners),
      corners: unprojectRing(corners, proj),
      center: proj.toLngLat(centroidLocal(corners)),
      accessible: rb.accessibleFlags[sIdx] ?? false,
    }));
    const orientation: Orientation =
      rb.placement === 'perimeter'
        ? { rowAngleDeg: rb.orientationDeg, label: 'perimeter edge' }
        : { rowAngleDeg: rb.orientationDeg, label: orientationLabel(rb.orientationDeg, longestEdgeAngle) };
    return {
      rowId: `${idx + 1}-${rb.rowId}`,
      orientation,
      loading: rb.loading,
      placement: rb.placement,
      aisleId: rb.aisleId,
      stalls,
    };
  });

  const driveAisles: DriveAisle[] = finalAisleSet.map((a) => ({
    aisleId: a.aisleId,
    role: a.role,
    ring: unprojectRing(dropClosingLocal(a.ring), proj),
    travelDir: travelDirById.get(a.aisleId),
  }));

  if (accessible && accessibleCount < accessibleTarget) {
    warnings.push({
      code: 'accessible-bay-shortfall',
      message: `Only ${accessibleCount} of the ${accessibleTarget} accessible bays targeted by the ${round(accessible.rate * 100, 0)}% policy could be placed.`,
    });
  }

  const perimeterAngles = Array.from(new Set(perimeter.rows.map((r) => round(r.orientationDeg, 1))));
  let orientationSummary: OrientationSummary;
  if (finalRows.length === 0) {
    orientationSummary = { kind: 'uniform', angleDeg: interiorAngleDeg ?? 0 };
  } else if (perimeter.rows.length === 0) {
    orientationSummary = { kind: 'uniform', angleDeg: interiorAngleDeg ?? round(foldAngle(finalRows[0].orientation.rowAngleDeg), 1) };
  } else if (interior && interior.rows.length > 0) {
    const angles = Array.from(new Set([...perimeterAngles, round(foldAngle(interiorAngleDeg ?? 0), 1)]));
    orientationSummary = angles.length <= 1 ? { kind: 'uniform', angleDeg: angles[0] } : { kind: 'mixed', edgeAnglesDeg: angles };
  } else {
    orientationSummary = { kind: 'perimeter-only', edgeAnglesDeg: perimeterAngles };
  }

  const score = scoreCandidate(finalRows, allReachable, anyReachable, m2Penalty);
  const parkingFootprintSqm = round(stallCount * stallW * (stallL + aisle / 2), 1);

  return {
    candidateId: '',
    orientationSummary,
    rows: finalRows,
    stallCount,
    accessCorridor: { ring: unprojectRing(corridorLocal, proj) },
    driveAisles,
    parkingFootprintSqm,
    score,
    warnings,
  };
}

// ---------------------------------------------------------------------------
// M2 — manoeuvring validation (approachability, dead-end turning bays, one-way).
// All simplified/conceptual — see module doc comment.
// ---------------------------------------------------------------------------

/**
 * Minimum aisle width for a vehicle to turn into a stall in one manoeuvre.
 * A deliberately simplified, documented approximation — NOT a swept-path/
 * AutoTURN-grade calculation. Wider stalls need less aisle (more margin to
 * swing in); a larger turning circle or vehicle body needs more.
 */
function requiredAisleWidthFor(stallWidthM: number, vehicle: Vehicle): number {
  return Math.max(vehicle.turningRadius - stallWidthM * 0.3, vehicle.sweptWidth, LIMITS.minAisle);
}

const CORRIDOR_NODE_ID = '__corridor__';

/** Adjacency list over aisles + the corridor, using the same touch-tolerant test as flood-fill connectivity. */
function computeAdjacency(aisles: LocalAisleBuild[], corridor: LocalRing): Map<string, string[]> {
  const nodes: { id: string; ring: LocalRing }[] = [
    { id: CORRIDOR_NODE_ID, ring: corridor },
    ...aisles.map((a) => ({ id: a.aisleId, ring: a.ring })),
  ];
  const adjacency = new Map<string, string[]>();
  for (const n of nodes) adjacency.set(n.id, []);
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      if (polygonsConnected(nodes[i].ring, nodes[j].ring, CONNECT_TOL)) {
        adjacency.get(nodes[i].id)!.push(nodes[j].id);
        adjacency.get(nodes[j].id)!.push(nodes[i].id);
      }
    }
  }
  return adjacency;
}

function farthestPair(ring: LocalRing): [LocalPoint, LocalPoint] {
  const pts = dropClosingLocal(ring);
  let best: [LocalPoint, LocalPoint] = [pts[0], pts[Math.min(1, pts.length - 1)]];
  let bestD = -Infinity;
  for (let i = 0; i < pts.length; i++) {
    for (let j = i + 1; j < pts.length; j++) {
      const d = dist(pts[i], pts[j]);
      if (d > bestD) {
        bestD = d;
        best = [pts[i], pts[j]];
      }
    }
  }
  return best;
}

function squareAt(center: LocalPoint, dirX: number, dirY: number, half: number): LocalRing {
  const px = -dirY;
  const py = dirX;
  return closeRing([
    [center[0] + dirX * half + px * half, center[1] + dirY * half + py * half],
    [center[0] - dirX * half + px * half, center[1] - dirY * half + py * half],
    [center[0] - dirX * half - px * half, center[1] - dirY * half - py * half],
    [center[0] + dirX * half - px * half, center[1] + dirY * half - py * half],
  ]);
}

/**
 * Leaf aisles (degree 1 in the circulation graph) need somewhere to turn
 * around. Reserves a square hammerhead bay (side = 2×turningRadius) beyond
 * the dead end when the space is free of stalls/exclusions and stays inside
 * the site; otherwise just penalises + warns, since forcing the bay into
 * occupied space would be worse than leaving it reverse-only.
 */
function reserveTurningBays(
  aisles: LocalAisleBuild[],
  corridor: LocalRing,
  usable: LocalRing,
  blockers: LocalRing[],
  vehicle: Vehicle,
): { turningAisles: LocalAisleBuild[]; warnings: SolverWarning[]; deadEndPenalty: number } {
  const adjacency = computeAdjacency(aisles, corridor);
  const turningAisles: LocalAisleBuild[] = [];
  let deadEndPenalty = 0;
  let anyBlocked = false;
  let n = 0;

  for (const a of aisles) {
    if (a.role === 'spine' || a.role === 'turning') continue;
    const neighbors = adjacency.get(a.aisleId) ?? [];
    if (neighbors.length !== 1) continue; // not a leaf — through traffic assumed possible

    const [p1, p2] = farthestPair(a.ring);
    const neighborRing = neighbors[0] === CORRIDOR_NODE_ID ? corridor : aisles.find((x) => x.aisleId === neighbors[0])?.ring;
    if (!neighborRing) continue;
    const neighborCentroid = centroidLocal(neighborRing);
    const deadEnd = dist(p1, neighborCentroid) > dist(p2, neighborCentroid) ? p1 : p2;
    const connectedEnd = deadEnd === p1 ? p2 : p1;

    const dx = deadEnd[0] - connectedEnd[0];
    const dy = deadEnd[1] - connectedEnd[1];
    const len = Math.hypot(dx, dy) || 1;
    const dirX = dx / len;
    const dirY = dy / len;
    const half = vehicle.turningRadius;
    const center: LocalPoint = [deadEnd[0] + dirX * half, deadEnd[1] + dirY * half];
    const bayRaw = squareAt(center, dirX, dirY, half);
    const clipped = clipRingToBoundary(bayRaw, usable);
    const blocked =
      !clipped || polygonAreaLocal(clipped) < half * half * 0.5 || blockers.some((b) => polygonsOverlap(clipped, b));

    if (blocked) {
      deadEndPenalty += 25;
      anyBlocked = true;
      continue;
    }
    n++;
    turningAisles.push({ aisleId: `turn-${n}`, role: 'turning', ring: closeRing(clipped) });
  }

  const warnings: SolverWarning[] = anyBlocked
    ? [
        {
          code: 'dead-end-no-turning-space',
          message: 'A dead-end aisle has no room reserved for a turning bay; treat it as reverse-only.',
        },
      ]
    : [];
  return { turningAisles, warnings, deadEndPenalty };
}

/**
 * Simplified one-way loop: aisles are ordered by angle around the site
 * centroid, and a connected pair is directed from the smaller to the larger
 * angle (the "clockwise" short way round) — a lightweight stand-in for real
 * traffic-flow design. Reachability is then checked on that directed graph.
 */
function checkOneWayCirculation(
  aisles: LocalAisleBuild[],
  corridor: LocalRing,
  siteCentroid: LocalPoint,
): { travelDirById: Map<string, 'oneway'>; ok: boolean; warnings: SolverWarning[] } {
  const angleOfRing = (ring: LocalRing) => {
    const c = centroidLocal(ring);
    return Math.atan2(c[1] - siteCentroid[1], c[0] - siteCentroid[0]);
  };
  const nodes = [
    { id: CORRIDOR_NODE_ID, ring: corridor, angle: angleOfRing(corridor) },
    ...aisles.map((a) => ({ id: a.aisleId, ring: a.ring, angle: angleOfRing(a.ring) })),
  ];

  const forward = new Map<string, string[]>();
  for (const node of nodes) forward.set(node.id, []);
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      if (!polygonsConnected(nodes[i].ring, nodes[j].ring, CONNECT_TOL)) continue;
      let diff = nodes[j].angle - nodes[i].angle;
      diff = (((diff + Math.PI) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
      if (diff >= 0) forward.get(nodes[i].id)!.push(nodes[j].id);
      else forward.get(nodes[j].id)!.push(nodes[i].id);
    }
  }

  const reached = new Set<string>([CORRIDOR_NODE_ID]);
  const queue = [CORRIDOR_NODE_ID];
  while (queue.length) {
    const cur = queue.pop()!;
    for (const next of forward.get(cur) ?? []) {
      if (!reached.has(next)) {
        reached.add(next);
        queue.push(next);
      }
    }
  }

  const ok = aisles.every((a) => reached.has(a.aisleId));
  const warnings: SolverWarning[] = ok
    ? []
    : [
        {
          code: 'one-way-disconnected',
          message: 'Some aisles are not reachable under a consistent one-way loop; treat circulation there as two-way.',
        },
      ];
  return { travelDirById: new Map(aisles.map((a) => [a.aisleId, 'oneway' as const])), ok, warnings };
}

// ---------------------------------------------------------------------------
// M2 — accessible bays.
// ---------------------------------------------------------------------------

/** Two stalls built consecutively along a row share their middle edge exactly, so their union is just the outer 4 corners. */
function mergeAdjacentStalls(a: LocalRing, b: LocalRing): LocalRing {
  return [a[0], b[1], b[2], a[3]];
}

/**
 * Designates accessible bays by merging adjacent stall PAIRS into one wide
 * bay, closest to the reference point (typically the entrance) first. This
 * reuses already-validated space — genuinely wider, not just relabelled —
 * at the cost of one standard stall's yield per bay. Bay LENGTH upgrades
 * aren't modelled; only width/placement are (see module doc comment).
 *
 * Each merge drops a row's final space count by one, so merging is capped per
 * row to keep the row at/above `minStallsPerRun` — otherwise a legal 2-stall
 * row would collapse to a single accessible bay, i.e. a solo (a length-1 row).
 * When the cap prevents reaching `targetCount`, the caller's existing
 * accessible-bay-shortfall warning discloses it.
 */
function applyAccessibleBays(
  rows: LocalRowBuild[],
  targetCount: number,
  referencePoint: LocalPoint,
): { rows: (LocalRowBuild & { accessibleFlags: boolean[] })[]; accessibleCount: number } {
  const candidates: { rowIdx: number; pairStart: number; d: number }[] = [];
  rows.forEach((row, rowIdx) => {
    for (let i = 0; i + 1 < row.stalls.length; i += 2) {
      candidates.push({ rowIdx, pairStart: i, d: dist(centroidLocal(row.stalls[i]), referencePoint) });
    }
  });
  candidates.sort((a, b) => a.d - b.d);

  // Max merges a row may take before it would drop below the minimum run:
  // final count = stalls - merges, and merges use non-overlapping pairs.
  const maxMergesByRow = rows.map((row) =>
    Math.min(Math.floor(row.stalls.length / 2), row.stalls.length - LIMITS.minStallsPerRun),
  );
  const mergesTakenByRow = new Map<number, number>();
  const chosen: { rowIdx: number; pairStart: number; d: number }[] = [];
  for (const c of candidates) {
    if (chosen.length >= Math.max(0, targetCount)) break;
    const taken = mergesTakenByRow.get(c.rowIdx) ?? 0;
    if (taken >= maxMergesByRow[c.rowIdx]) continue; // would push this row below the minimum run
    mergesTakenByRow.set(c.rowIdx, taken + 1);
    chosen.push(c);
  }

  const chosenByRow = new Map<number, Set<number>>();
  for (const c of chosen) {
    if (!chosenByRow.has(c.rowIdx)) chosenByRow.set(c.rowIdx, new Set());
    chosenByRow.get(c.rowIdx)!.add(c.pairStart);
  }

  const newRows = rows.map((row, rowIdx) => {
    const pairs = chosenByRow.get(rowIdx);
    if (!pairs) return { ...row, accessibleFlags: row.stalls.map(() => false) };
    const newStalls: LocalRing[] = [];
    const flags: boolean[] = [];
    let i = 0;
    while (i < row.stalls.length) {
      if (pairs.has(i)) {
        newStalls.push(mergeAdjacentStalls(row.stalls[i], row.stalls[i + 1]));
        flags.push(true);
        i += 2;
      } else {
        newStalls.push(row.stalls[i]);
        flags.push(false);
        i += 1;
      }
    }
    return { ...row, stalls: newStalls, accessibleFlags: flags };
  });

  return { rows: newRows, accessibleCount: chosen.length };
}

// ---------------------------------------------------------------------------
// Scoring.
// ---------------------------------------------------------------------------
function scoreCandidate(rows: ParkingRow[], allReachable: boolean, anyReachable: boolean, m2Penalty = 0): number {
  const stalls = rows.reduce((n, r) => n + r.stalls.length, 0);
  const fragments = rows.filter((r) => r.stalls.length < 3).length;
  const rowCount = rows.length;

  let score = stalls * 10;
  score += allReachable ? 80 : anyReachable ? 20 : -200;
  score -= fragments * 15;
  score -= rowCount * 1;
  score -= m2Penalty;
  return round(score, 3);
}

// ---------------------------------------------------------------------------
// Select best, meaningfully-different candidates (deterministic).
// ---------------------------------------------------------------------------
function representativeAngle(s: OrientationSummary): number {
  return s.kind === 'uniform' ? s.angleDeg : (s.edgeAnglesDeg[0] ?? 0);
}

function selectDistinct(candidates: CandidateLayout[], max: number): CandidateLayout[] {
  const sorted = [...candidates].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.stallCount !== a.stallCount) return b.stallCount - a.stallCount;
    return representativeAngle(a.orientationSummary) - representativeAngle(b.orientationSummary);
  });

  const chosen: CandidateLayout[] = [];
  for (const c of sorted) {
    if (chosen.length >= max) break;
    const distinct = chosen.every(
      (x) =>
        angularDiff(representativeAngle(x.orientationSummary), representativeAngle(c.orientationSummary)) > 5 ||
        x.stallCount !== c.stallCount,
    );
    if (distinct) chosen.push(c);
  }
  return chosen.map((c, i) => ({ ...c, candidateId: `candidate-${i + 1}` }));
}

// ---------------------------------------------------------------------------
// Geometry predicates.
// ---------------------------------------------------------------------------
function distanceToRing(p: LocalPoint, ring: LocalRing): number {
  const pts = dropClosingLocal(ring);
  let best = Infinity;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    const d = pointToSegment(p, a, b).distance;
    if (d < best) best = d;
  }
  return best;
}

/** True if `inner` lies within `outer`, permitting edges/corners within `tol` of the outer boundary. */
function polygonInsideTol(inner: LocalRing, outer: LocalRing, tol: number): boolean {
  const ip = dropClosingLocal(inner);
  for (const p of ip) {
    if (!(pointInRing(p, outer) || distanceToRing(p, outer) < tol)) return false;
  }
  const op = dropClosingLocal(outer);
  for (let i = 0; i < ip.length; i++) {
    const a = ip[i];
    const b = ip[(i + 1) % ip.length];
    for (let j = 0; j < op.length; j++) {
      const c = op[j];
      const d = op[(j + 1) % op.length];
      if (segmentsIntersect(a, b, c, d)) return false;
    }
  }
  return true;
}

/** True if polygon `inner` lies entirely within `outer` (concave-safe, exact). */
function polygonInside(inner: LocalRing, outer: LocalRing): boolean {
  const ip = dropClosingLocal(inner);
  for (const p of ip) {
    if (!pointInRing(p, outer)) return false;
  }
  const op = dropClosingLocal(outer);
  for (let i = 0; i < ip.length; i++) {
    const a = ip[i];
    const b = ip[(i + 1) % ip.length];
    for (let j = 0; j < op.length; j++) {
      const c = op[j];
      const d = op[(j + 1) % op.length];
      if (segmentsIntersect(a, b, c, d)) return false;
    }
  }
  return true;
}

/** True if two polygons overlap (edges cross, or one contains a vertex of the other). Touching is NOT overlap. */
function polygonsOverlap(a: LocalRing, b: LocalRing): boolean {
  const ap = dropClosingLocal(a);
  const bp = dropClosingLocal(b);
  for (let i = 0; i < ap.length; i++) {
    const a1 = ap[i];
    const a2 = ap[(i + 1) % ap.length];
    for (let j = 0; j < bp.length; j++) {
      const b1 = bp[j];
      const b2 = bp[(j + 1) % bp.length];
      if (segmentsIntersect(a1, a2, b1, b2)) return true;
    }
  }
  if (pointStrictlyInside(ap[0], b)) return true;
  if (pointStrictlyInside(bp[0], a)) return true;
  return false;
}

/**
 * Point-in-ring, but a point sitting exactly ON the ring boundary (as every
 * touching stall/aisle corner legitimately does, by construction) is treated
 * as NOT inside. Ray-casting is otherwise ambiguous for exact-boundary points
 * — floating-point noise can flip it either way, which would misreport a
 * touching pair as overlapping.
 */
function pointStrictlyInside(p: LocalPoint, ring: LocalRing): boolean {
  if (distanceToRing(p, ring) < 1e-4) return false;
  return pointInRing(p, ring);
}

/**
 * A cross-product sign of exactly zero is rare in practice: a stall edge built
 * along the same direction as a Turf-buffered boundary edge is not perfectly
 * collinear with it (buffer offsetting leaves micron-scale noise), so a naive
 * strict-sign test flips unpredictably for edges that are really the same
 * line. Snap near-zero cross products to zero before comparing signs.
 */
const CROSS_EPS = 1e-4;
function crossSign(v: number): -1 | 0 | 1 {
  if (v > CROSS_EPS) return 1;
  if (v < -CROSS_EPS) return -1;
  return 0;
}

function segmentsIntersect(p1: LocalPoint, p2: LocalPoint, p3: LocalPoint, p4: LocalPoint): boolean {
  const s1 = crossSign(crossDir(p3, p4, p1));
  const s2 = crossSign(crossDir(p3, p4, p2));
  const s3 = crossSign(crossDir(p1, p2, p3));
  const s4 = crossSign(crossDir(p1, p2, p4));
  return s1 !== 0 && s2 !== 0 && s3 !== 0 && s4 !== 0 && s1 !== s2 && s3 !== s4;
}

function crossDir(a: LocalPoint, b: LocalPoint, c: LocalPoint): number {
  return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
}

// ---------------------------------------------------------------------------
// Small helpers.
// ---------------------------------------------------------------------------
function ensureCCW(ring: LocalRing): LocalRing {
  return signedArea(ring) < 0 ? [...dropClosingLocal(ring)].reverse() : dropClosingLocal(ring);
}
function ensureCW(ring: LocalRing): LocalRing {
  return signedArea(ring) > 0 ? [...dropClosingLocal(ring)].reverse() : dropClosingLocal(ring);
}

function centroidLocal(ring: [number, number][]): LocalPoint {
  const pts = dropClosingLocal(ring);
  let sx = 0;
  let sy = 0;
  for (const [x, y] of pts) {
    sx += x;
    sy += y;
  }
  return [sx / pts.length, sy / pts.length];
}

function closeLocalCorners(corners: [number, number][]): [number, number][] {
  const open = dropClosingLocal(corners);
  return [...open, open[0]] as [number, number][];
}

function angleOf(dx: number, dy: number): number {
  return foldAngle((Math.atan2(dy, dx) * 180) / Math.PI);
}

function foldAngle(deg: number): number {
  return ((deg % 180) + 180) % 180;
}

function angularDiff(a: number, b: number): number {
  let d = Math.abs((((a - b) % 180) + 180) % 180);
  if (d > 90) d = 180 - d;
  return d;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function round(v: number, dp: number): number {
  const f = Math.pow(10, dp);
  return Math.round(v * f) / f;
}

function dedupeWarnings(warnings: SolverWarning[]): SolverWarning[] {
  const seen = new Set<string>();
  const out: SolverWarning[] = [];
  for (const w of warnings) {
    const key = `${w.code}::${w.message}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(w);
  }
  return out;
}

function emptyOutput(accessPoint: LngLat, warnings: SolverWarning[]): SolverOutput {
  return {
    snappedAccessPoint: accessPoint,
    usableBoundary: null,
    expandedExclusions: [],
    candidates: [],
    warnings,
  };
}

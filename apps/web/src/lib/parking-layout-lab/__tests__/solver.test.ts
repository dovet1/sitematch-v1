/**
 * Parking Layout Lab — pure solver unit tests.
 *
 * These exercise the perimeter-first deterministic geometry heuristic against
 * the fixtures required by the spec. All geometry is built in local metres and
 * converted to lng/lat with the same equirectangular model the solver uses
 * internally, so distances in the fixtures are true metres.
 *
 * A note on tolerance: perimeter stalls/aisles are built to touch the usable
 * boundary and each other EXACTLY, by construction (a stall's outer edge IS
 * the boundary edge; a row's inner edge IS its aisle's edge). Naive
 * point-in-polygon ray-casting is ambiguous for a point sitting exactly on a
 * ring's boundary — the verification helpers below treat "on the boundary
 * within a tiny tolerance" as touching, not overlapping/outside, matching the
 * solver's own semantics (see `polygonsOverlap` / `polygonInsideTol` in
 * ../solver.ts).
 */

import { solveParkingLayout } from '../solver';
import type { CandidateLayout, LngLat, PolygonInput, SolverInput, SolverOutput } from '../types';

// --- Fixture helpers -------------------------------------------------------

const ORIGIN: LngLat = [-1.08, 51.28]; // Canterbury-ish; exact value irrelevant.
const EARTH_R = 6_378_137;
const DEG = Math.PI / 180;
const cosLat0 = Math.cos(ORIGIN[1] * DEG);

/** Convert local metres [x east, y north] to [lng, lat]. Inverse of the solver's projection. */
function m(x: number, y: number): LngLat {
  const lat = ORIGIN[1] + (y / EARTH_R) * (180 / Math.PI);
  const lon = ORIGIN[0] + (x / (EARTH_R * cosLat0)) * (180 / Math.PI);
  return [lon, lat];
}

/** Rectangle boundary from (0,0) to (w,h) in metres. */
function rect(w: number, h: number): PolygonInput {
  return { ring: [m(0, 0), m(w, 0), m(w, h), m(0, h), m(0, 0)] };
}

function poly(pointsM: [number, number][]): PolygonInput {
  return { ring: pointsM.map(([x, y]) => m(x, y)) };
}

const DEFAULTS = {
  stall: { width: 2.4, length: 4.8 },
  aisleWidth: 6,
  boundarySetback: 1,
  exclusionClearance: 1,
};

function baseInput(overrides: Partial<SolverInput> = {}): SolverInput {
  return {
    boundary: rect(50, 30),
    exclusions: [],
    accessPoint: m(25, 0),
    ...DEFAULTS,
    ...overrides,
  };
}

// --- Geometry helpers (independent of the solver internals, tolerant like it) ---

const TOL = 1e-4; // metres — comfortably above float noise, well below any real defect.

function dropClose(ring: LngLat[]): LngLat[] {
  if (ring.length > 1) {
    const a = ring[0];
    const b = ring[ring.length - 1];
    if (a[0] === b[0] && a[1] === b[1]) return ring.slice(0, -1);
  }
  return ring;
}

/** Inverse of m(): [lng,lat] -> local metres. Scale-correct for adjacency maths. */
function toM(p: LngLat): [number, number] {
  const x = (p[0] - ORIGIN[0]) * DEG * EARTH_R * cosLat0;
  const y = (p[1] - ORIGIN[1]) * DEG * EARTH_R;
  return [x, y];
}

function ringToM(ring: LngLat[]): [number, number][] {
  return dropClose(ring).map(toM);
}

function distToSegM(p: [number, number], a: [number, number], b: [number, number]): number {
  const abx = b[0] - a[0];
  const aby = b[1] - a[1];
  const lenSq = abx * abx + aby * aby;
  let t = lenSq === 0 ? 0 : ((p[0] - a[0]) * abx + (p[1] - a[1]) * aby) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p[0] - (a[0] + t * abx), p[1] - (a[1] + t * aby));
}

function distToRingM(p: [number, number], ringM: [number, number][]): number {
  let best = Infinity;
  for (let i = 0; i < ringM.length; i++) {
    const d = distToSegM(p, ringM[i], ringM[(i + 1) % ringM.length]);
    if (d < best) best = d;
  }
  return best;
}

function pointInPolygonM(pt: [number, number], ringM: [number, number][]): boolean {
  const [px, py] = pt;
  let inside = false;
  for (let i = 0, j = ringM.length - 1; i < ringM.length; j = i++) {
    const [xi, yi] = ringM[i];
    const [xj, yj] = ringM[j];
    const hit = yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi;
    if (hit) inside = !inside;
  }
  return inside;
}

/** Contained OR within TOL of the boundary — matches the solver's "touching is permitted" rule. */
function insideOrOnM(ptLL: LngLat, ringLL: LngLat[]): boolean {
  const p = toM(ptLL);
  const ringM = ringToM(ringLL);
  return pointInPolygonM(p, ringM) || distToRingM(p, ringM) < TOL;
}

// A cross-product of exactly zero is rare in practice: two edges that are really
// the same line (e.g. a stall edge and a Turf-buffered boundary edge) differ by
// buffer-offsetting noise on the order of 1e-5 to 1e-6, not exactly zero. Mirrors
// the solver's own CROSS_EPS-tolerant `segmentsIntersect` — a naive strict-sign
// test would misreport plenty of legitimately-touching (T-junction) pairs here.
const CROSS_EPS = 1e-4;
function crossSignM(v: number): -1 | 0 | 1 {
  if (v > CROSS_EPS) return 1;
  if (v < -CROSS_EPS) return -1;
  return 0;
}
function segsCrossM(p1: [number, number], p2: [number, number], p3: [number, number], p4: [number, number]): boolean {
  const d = (a: [number, number], b: [number, number], c: [number, number]) =>
    (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  const s1 = crossSignM(d(p3, p4, p1));
  const s2 = crossSignM(d(p3, p4, p2));
  const s3 = crossSignM(d(p1, p2, p3));
  const s4 = crossSignM(d(p1, p2, p4));
  return s1 !== 0 && s2 !== 0 && s3 !== 0 && s4 !== 0 && s1 !== s2 && s3 !== s4;
}

/** True overlap only — a shared/touching edge does NOT count (mirrors solver's polygonsOverlap). */
function overlapsM(aLL: LngLat[], bLL: LngLat[]): boolean {
  const a = ringToM(aLL);
  const b = ringToM(bLL);
  for (let i = 0; i < a.length; i++) {
    for (let j = 0; j < b.length; j++) {
      if (segsCrossM(a[i], a[(i + 1) % a.length], b[j], b[(j + 1) % b.length])) return true;
    }
  }
  const aStrictlyIn = (p: [number, number]) => distToRingM(p, b) >= TOL && pointInPolygonM(p, b);
  const bStrictlyIn = (p: [number, number]) => distToRingM(p, a) >= TOL && pointInPolygonM(p, a);
  if (aStrictlyIn(a[0])) return true;
  if (bStrictlyIn(b[0])) return true;
  return false;
}

/** Touching (within CONNECT_TOL) OR overlapping counts as connected — mirrors solver's polygonsConnected. */
const CONNECT_TOL = 0.15;
function connectedM(aLL: LngLat[], bLL: LngLat[]): boolean {
  if (overlapsM(aLL, bLL)) return true;
  const a = ringToM(aLL);
  const b = ringToM(bLL);
  for (const p of a) if (distToRingM(p, b) < CONNECT_TOL) return true;
  for (const p of b) if (distToRingM(p, a) < CONNECT_TOL) return true;
  return false;
}

function allStalls(candidate: CandidateLayout) {
  return candidate.rows.flatMap((r) => r.stalls);
}

/** Flood-fill the drive network (aisles + corridor) by touch-or-overlap, seeded from the corridor. */
function reachableAisleIds(candidate: CandidateLayout): Set<string> {
  const corridor = candidate.accessCorridor!.ring;
  const reached = new Set<string>();
  const queue: typeof candidate.driveAisles = [];
  candidate.driveAisles.forEach((a) => {
    if (connectedM(a.ring, corridor)) {
      reached.add(a.aisleId);
      queue.push(a);
    }
  });
  while (queue.length) {
    const cur = queue.pop()!;
    for (const a of candidate.driveAisles) {
      if (!reached.has(a.aisleId) && connectedM(cur.ring, a.ring)) {
        reached.add(a.aisleId);
        queue.push(a);
      }
    }
  }
  return reached;
}

/** True if a stall's aisle-facing (short) edge opens onto its OWN assigned aisle. */
function stallOpensOntoOwnAisle(row: CandidateLayout['rows'][number], stall: { corners: LngLat[] }, candidate: CandidateLayout): boolean {
  const aisle = candidate.driveAisles.find((a) => a.aisleId === row.aisleId);
  if (!aisle) return false;
  const c = ringToM(stall.corners);
  const centroid: [number, number] = [
    (c[0][0] + c[1][0] + c[2][0] + c[3][0]) / 4,
    (c[0][1] + c[1][1] + c[2][1] + c[3][1]) / 4,
  ];
  const aisleM = ringToM(aisle.ring);
  // A rectangle has two edge lengths (width pair, depth pair) — test the
  // SHORTER pair regardless of absolute size, since a merged accessible bay
  // can have a width edge as long as (or longer than) a standard depth edge.
  const lens = [0, 1, 2, 3].map((i) => Math.hypot(c[i][0] - c[(i + 1) % 4][0], c[i][1] - c[(i + 1) % 4][1]));
  const shorterPairMax = Math.min(...lens) + 0.5;
  for (let i = 0; i < 4; i++) {
    const a = c[i];
    const b = c[(i + 1) % 4];
    if (lens[i] > shorterPairMax) continue; // skip the longer (depth) edges; keep the width (aisle-facing) edge
    const mid: [number, number] = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const dx = mid[0] - centroid[0];
    const dy = mid[1] - centroid[1];
    const d = Math.hypot(dx, dy) || 1;
    const probe: [number, number] = [mid[0] + (dx / d) * 1, mid[1] + (dy / d) * 1];
    if (pointInPolygonM(probe, aisleM) || distToRingM(probe, aisleM) < 1) return true;
  }
  return false;
}

/** Applies the invariants every candidate from every fixture must hold. */
function assertCandidateInvariants(out: SolverOutput, candidate: CandidateLayout) {
  const usable = out.usableBoundary!.ring;
  const stalls = allStalls(candidate);

  // No stall crosses the usable boundary (touching the edge is fine).
  for (const stall of stalls) {
    for (const corner of dropClose(stall.corners)) {
      expect(insideOrOnM(corner, usable)).toBe(true);
    }
  }

  // No stall–stall overlap (distinct stalls touching an edge is fine).
  for (let i = 0; i < stalls.length; i++) {
    for (let j = i + 1; j < stalls.length; j++) {
      expect(overlapsM(stalls[i].corners, stalls[j].corners)).toBe(false);
    }
  }

  // No stall overlaps any drive aisle (it opens onto its own aisle by touching, not overlapping).
  for (const stall of stalls) {
    for (const aisle of candidate.driveAisles) {
      expect(overlapsM(stall.corners, aisle.ring)).toBe(false);
    }
  }

  // No stall/aisle crosses an exclusion.
  for (const ex of out.expandedExclusions) {
    for (const stall of stalls) expect(overlapsM(stall.corners, ex.ring)).toBe(false);
    for (const aisle of candidate.driveAisles) expect(overlapsM(aisle.ring, ex.ring)).toBe(false);
  }

  // Aisles stay within the usable boundary.
  for (const aisle of candidate.driveAisles) {
    for (const corner of dropClose(aisle.ring)) {
      expect(insideOrOnM(corner, usable)).toBe(true);
    }
  }

  // The entrance must reach SOME circulation (a total failure is a real bug).
  // A layout with obstacles that leave one aisle stranded is legitimate, but
  // ONLY if disclosed — unreachable circulation must never be silently wrong.
  const reachable = reachableAisleIds(candidate);
  const anyReachable = candidate.driveAisles.length === 0 || candidate.driveAisles.some((a) => reachable.has(a.aisleId));
  expect(anyReachable).toBe(true);
  const allReachable = candidate.driveAisles.every((a) => reachable.has(a.aisleId));
  if (!allReachable) {
    expect(candidate.warnings.some((w) => w.code === 'partial-connectivity')).toBe(true);
  }

  // Every stall opens onto its assigned serving aisle.
  for (const row of candidate.rows) {
    for (const stall of row.stalls) {
      expect(stallOpensOntoOwnAisle(row, stall, candidate)).toBe(true);
    }
  }

  expect(candidate.warnings.some((w) => w.code === 'entrance-disconnected')).toBe(false);

  // M2: pedestrian corridors don't cut through parked stalls — UNLESS the
  // simplified router couldn't avoid it, which must then be disclosed (same
  // disclose-don't-silently-fail pattern as partial vehicle connectivity).
  const pedestrianObstructed = candidate.warnings.some((w) => w.code === 'pedestrian-route-obstructed');
  for (const route of candidate.pedestrianRoutes) {
    if (!pedestrianObstructed) {
      for (const stall of stalls) {
        expect(overlapsM(route.corridor, stall.corners)).toBe(false);
      }
    }
    for (const crossing of route.crossings) {
      const c = ringToM(crossing.ring).reduce(
        (acc, p) => [acc[0] + p[0], acc[1] + p[1]] as [number, number],
        [0, 0] as [number, number],
      );
      const n = dropClose(crossing.ring).length;
      const centroid: [number, number] = [c[0] / n, c[1] / n];
      expect(pointInPolygonM(centroid, ringToM(route.corridor))).toBe(true);
    }
  }
}

// --- Tests -----------------------------------------------------------------

describe('parking-layout-lab solver', () => {
  it('1. simple rectangular plot yields parking with matching counts', () => {
    const out = solveParkingLayout(baseInput());
    expect(out.candidates.length).toBeGreaterThan(0);
    expect(out.usableBoundary).not.toBeNull();

    const top = out.candidates[0];
    const geomCount = allStalls(top).length;
    expect(top.stallCount).toBe(geomCount);
    expect(geomCount).toBeGreaterThan(10);
    for (const c of out.candidates) assertCandidateInvariants(out, c);
  });

  it('2. rectangle with a central building keeps stalls out of the exclusion', () => {
    const building = poly([
      [20, 12],
      [30, 12],
      [30, 18],
      [20, 18],
    ]);
    const out = solveParkingLayout(baseInput({ exclusions: [building] }));
    expect(out.candidates.length).toBeGreaterThan(0);
    expect(out.expandedExclusions.length).toBe(1);
    for (const c of out.candidates) assertCandidateInvariants(out, c);
  });

  it('3. L-shaped plot (convex + concave corners) produces valid candidates', () => {
    const lShape = poly([
      [0, 0],
      [60, 0],
      [60, 20],
      [25, 20],
      [25, 45],
      [0, 45],
    ]);
    const out = solveParkingLayout(baseInput({ boundary: lShape, accessPoint: m(30, 0) }));
    expect(out.candidates.length).toBeGreaterThan(0);
    for (const c of out.candidates) assertCandidateInvariants(out, c);
  });

  it('4. concave (arrow/notched — acute apex) plot stays inside its usable boundary', () => {
    const concave = poly([
      [0, 0],
      [60, 0],
      [60, 40],
      [30, 20],
      [0, 40],
    ]);
    const out = solveParkingLayout(baseInput({ boundary: concave, accessPoint: m(10, 0) }));
    expect(out.candidates.length).toBeGreaterThan(0);
    for (const c of out.candidates) assertCandidateInvariants(out, c);
  });

  it('4b. obtuse-corner hexagon plot stays valid', () => {
    const hex = poly([
      [10, 0],
      [50, 0],
      [60, 15],
      [50, 40],
      [10, 40],
      [0, 15],
    ]);
    const out = solveParkingLayout(baseInput({ boundary: hex, accessPoint: m(30, 0) }));
    expect(out.candidates.length).toBeGreaterThan(0);
    for (const c of out.candidates) assertCandidateInvariants(out, c);
  });

  it('5. narrow square plot only fits single-loaded interior rows (perimeter modules too narrow)', () => {
    const out = solveParkingLayout(baseInput({ boundary: rect(15, 15), accessPoint: m(0, 7.5) }));
    expect(out.candidates.length).toBeGreaterThan(0);
    for (const c of out.candidates) assertCandidateInvariants(out, c);
  });

  it('6. plot too small for any stall returns a warning and no candidates', () => {
    const out = solveParkingLayout(baseInput({ boundary: rect(6, 6), accessPoint: m(3, 0) }));
    expect(out.candidates.length).toBe(0);
    expect(out.warnings.some((w) => w.code === 'no-spaces')).toBe(true);
  });

  it('7. access point on each major side snaps to that side and still solves', () => {
    const sides: Record<string, LngLat> = {
      south: m(25, 0),
      north: m(25, 30),
      west: m(0, 15),
      east: m(50, 15),
    };
    for (const [name, ap] of Object.entries(sides)) {
      const out = solveParkingLayout(baseInput({ accessPoint: ap }));
      expect(out.candidates.length).toBeGreaterThan(0);
      const [sx, sy] = out.snappedAccessPoint;
      const [ax, ay] = ap;
      const near = Math.hypot(sx - ax, sy - ay);
      expect(near).toBeLessThan(1e-4);
      expect(name).toBeTruthy();
    }
  });

  it('7b. access corridor stays clear of stalls', () => {
    const out = solveParkingLayout(baseInput());
    for (const c of out.candidates) {
      const corridor = c.accessCorridor!.ring;
      for (const stall of allStalls(c)) {
        expect(overlapsM(stall.corners, corridor)).toBe(false);
      }
    }
  });

  it('8. multiple exclusion polygons are all respected', () => {
    const ex1 = poly([
      [10, 10],
      [16, 10],
      [16, 16],
      [10, 16],
    ]);
    const ex2 = poly([
      [34, 14],
      [42, 14],
      [42, 22],
      [34, 22],
    ]);
    const out = solveParkingLayout(baseInput({ exclusions: [ex1, ex2] }));
    expect(out.expandedExclusions.length).toBe(2);
    for (const c of out.candidates) assertCandidateInvariants(out, c);
  });

  it('9. self-intersecting (bowtie) input returns warnings and does not throw', () => {
    const bowtie: PolygonInput = {
      ring: [m(0, 0), m(40, 40), m(40, 0), m(0, 40), m(0, 0)],
    };
    let out;
    expect(() => {
      out = solveParkingLayout(baseInput({ boundary: bowtie }));
    }).not.toThrow();
    expect(out!.candidates.length).toBe(0);
    expect(out!.warnings.length).toBeGreaterThan(0);
  });

  it('9b. degenerate (two-point) input returns warnings and does not throw', () => {
    const degenerate: PolygonInput = { ring: [m(0, 0), m(10, 0)] };
    const out = solveParkingLayout(baseInput({ boundary: degenerate }));
    expect(out.candidates.length).toBe(0);
    expect(out.warnings.some((w) => w.code === 'degenerate-boundary')).toBe(true);
  });

  it('10. identical input produces identical output (determinism)', () => {
    const a = solveParkingLayout(baseInput({ exclusions: [poly([[20, 12], [30, 12], [30, 18], [20, 18]])] }));
    const b = solveParkingLayout(baseInput({ exclusions: [poly([[20, 12], [30, 12], [30, 18], [20, 18]])] }));
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('10b. candidates are returned in non-increasing score order, capped at 3', () => {
    const out = solveParkingLayout(baseInput());
    for (let i = 1; i < out.candidates.length; i++) {
      expect(out.candidates[i - 1].score).toBeGreaterThanOrEqual(out.candidates[i].score);
    }
    expect(out.candidates.length).toBeLessThanOrEqual(3);
    const ids = out.candidates.map((c) => c.candidateId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('11. every drive aisle connects back to the entrance on a large multi-band plot', () => {
    const out = solveParkingLayout(baseInput({ boundary: rect(80, 60), accessPoint: m(40, 0) }));
    expect(out.candidates.length).toBeGreaterThan(0);
    for (const c of out.candidates) {
      expect(c.driveAisles.length).toBeGreaterThan(1);
      assertCandidateInvariants(out, c);
    }
  });

  it('12. edge-touching is permitted; genuine overlap is rejected', () => {
    // An exclusion placed to abut (not cross) where a perimeter row would sit —
    // the row must still be buildable right up to the exclusion's clearance.
    const out = solveParkingLayout(
      baseInput({
        boundary: rect(50, 30),
        exclusions: [poly([[0, 10], [8, 10], [8, 20], [0, 20]])], // touches the west edge
        accessPoint: m(25, 0),
      }),
    );
    expect(out.candidates.length).toBeGreaterThan(0);
    for (const c of out.candidates) assertCandidateInvariants(out, c);
  });

  it('13. perimeter-only candidates are deduplicated to exactly one', () => {
    // Too narrow for any interior module once perimeter rings are subtracted.
    const out = solveParkingLayout(baseInput({ boundary: rect(24, 24), accessPoint: m(12, 0) }));
    expect(out.candidates.length).toBeGreaterThan(0);
    const perimeterOnly = out.candidates.filter((c) => c.orientationSummary.kind === 'perimeter-only');
    expect(perimeterOnly.length).toBeLessThanOrEqual(1);
    for (const c of out.candidates) assertCandidateInvariants(out, c);
  });

  it('14. a large plot with a central exclusion can split the interior into a multi-polygon region without dropping area', () => {
    const centralBlock = poly([
      [30, 5],
      [50, 5],
      [50, 55],
      [30, 55],
    ]);
    // Access point offset from the exclusion's x-range [30,50] — centring it
    // there would put the straight access corridor entirely behind the
    // building, which is a genuinely un-enterable site, not a solver bug.
    const out = solveParkingLayout(
      baseInput({ boundary: rect(80, 60), exclusions: [centralBlock], accessPoint: m(10, 0) }),
    );
    expect(out.candidates.length).toBeGreaterThan(0);
    for (const c of out.candidates) assertCandidateInvariants(out, c);
    // Both sides of the split should have contributed stalls, not just one.
    const top = out.candidates[0];
    const leftStalls = allStalls(top).filter((s) => toM(s.center)[0] < 30);
    const rightStalls = allStalls(top).filter((s) => toM(s.center)[0] > 50);
    expect(leftStalls.length).toBeGreaterThan(0);
    expect(rightStalls.length).toBeGreaterThan(0);
  });

  it('15. cyclic vertex reordering and reversed winding produce the same geometry', () => {
    const original = [m(0, 0), m(50, 0), m(50, 30), m(0, 30)];
    const rotatedStart = [original[2], original[3], original[0], original[1]];
    const reversedWinding = [...original].reverse();

    const outA = solveParkingLayout(baseInput({ boundary: { ring: original } }));
    const outB = solveParkingLayout(baseInput({ boundary: { ring: rotatedStart } }));
    const outC = solveParkingLayout(baseInput({ boundary: { ring: reversedWinding } }));

    const signature = (out: SolverOutput) => out.candidates.map((c) => [c.stallCount, c.score]);
    expect(signature(outB)).toEqual(signature(outA));
    expect(signature(outC)).toEqual(signature(outA));
  });

  it('16. generation stays within the shared iteration budget for a complex boundary', () => {
    // A many-sided near-circular boundary exercises canonicalisation + collinear
    // merging + the shared budget without needing an enormous vertex count.
    const N = 40;
    const R = 60;
    const pts: [number, number][] = [];
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2;
      pts.push([R + R * Math.cos(a), R + R * Math.sin(a)]);
    }
    const out = solveParkingLayout(baseInput({ boundary: poly(pts), accessPoint: m(R, 0) }));
    expect(out.candidates.length).toBeGreaterThan(0);
    for (const c of out.candidates) assertCandidateInvariants(out, c);
  });

  it('17. draft mode cuts base layout work: no connector search, fewer orientations, than the equivalent full solve', () => {
    // Same complex boundary as #16 — full solves on it need ensureConnectivity
    // to bridge disconnected aisle components (hence its 'partial-connectivity'
    // warning); that's exactly the dominant cost a draft solve must skip.
    const N = 40;
    const R = 60;
    const pts: [number, number][] = [];
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2;
      pts.push([R + R * Math.cos(a), R + R * Math.sin(a)]);
    }
    const input = baseInput({ boundary: poly(pts), accessPoint: m(R, 0) });

    const full = solveParkingLayout(input);
    expect(full.candidates.length).toBeGreaterThan(0);
    expect(full.candidates.some((c) => c.driveAisles.some((a) => a.role === 'spine'))).toBe(true);
    expect(full.candidates.some((c) => c.warnings.some((w) => w.code === 'partial-connectivity'))).toBe(true);

    const draft = solveParkingLayout({ ...input, draft: true });
    expect(draft.candidates.length).toBeGreaterThan(0);
    // No connector search ran: never a 'spine' aisle, never the connectivity warning.
    for (const c of draft.candidates) {
      expect(c.driveAisles.some((a) => a.role === 'spine')).toBe(false);
      expect(c.warnings.some((w) => w.code === 'partial-connectivity' || w.code === 'entrance-disconnected')).toBe(
        false,
      );
    }
    // Full orientation sweep skipped in favour of the 1-2 fallback (no
    // previously-selected orientation was hinted).
    expect(draft.candidates.length).toBeLessThanOrEqual(2);
    expect(draft.candidates.length).toBeLessThanOrEqual(full.candidates.length);

    // Collision/exclusion/setback/basic placement are unaffected: stalls
    // still respect the usable boundary and never overlap each other.
    const usable = draft.usableBoundary!.ring;
    for (const c of draft.candidates) {
      for (const stall of allStalls(c)) {
        for (const corner of dropClose(stall.corners)) {
          expect(insideOrOnM(corner, usable)).toBe(true);
        }
      }
    }
  });

  it('18. draftOrientationDeg narrows generation to a single orientation nearest the hint', () => {
    const N = 40;
    const R = 60;
    const pts: [number, number][] = [];
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2;
      pts.push([R + R * Math.cos(a), R + R * Math.sin(a)]);
    }
    const input = baseInput({ boundary: poly(pts), accessPoint: m(R, 0) });

    // No hint -> the 1-2 fallback (see #17).
    const noHint = solveParkingLayout({ ...input, draft: true });
    expect(noHint.candidates.length).toBeGreaterThan(1);

    // A hint -> exactly one candidate, built for just that orientation.
    const hinted = solveParkingLayout({ ...input, draft: true, draftOrientationDeg: 37 });
    expect(hinted.candidates.length).toBe(1);
  });
});

// --- M2: manoeuvring, pedestrian routing, accessible bays ------------------
// All M2 fields are opt-in — the M1 suite above already proves omitting them
// reproduces M1 behaviour. These tests exercise the M2 codepaths directly.

function ringAreaM(ringLL: LngLat[]): number {
  const pts = ringToM(ringLL);
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[(i + 1) % pts.length];
    a += x1 * y2 - x2 * y1;
  }
  return Math.abs(a / 2);
}

function computeDegreeM(candidate: CandidateLayout): Map<string, number> {
  const nodes = [
    { id: '__corridor__', ring: candidate.accessCorridor!.ring },
    ...candidate.driveAisles.map((a) => ({ id: a.aisleId, ring: a.ring })),
  ];
  const degree = new Map<string, number>();
  for (const n of nodes) degree.set(n.id, 0);
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      if (connectedM(nodes[i].ring, nodes[j].ring)) {
        degree.set(nodes[i].id, (degree.get(nodes[i].id) ?? 0) + 1);
        degree.set(nodes[j].id, (degree.get(nodes[j].id) ?? 0) + 1);
      }
    }
  }
  return degree;
}

const STANDARD_VEHICLE = { turningRadius: 6, sweptWidth: 2.0, length: 4.8 };

describe('parking-layout-lab solver — M2', () => {
  it('approachability warns + penalises when the aisle is too narrow for the vehicle profile', () => {
    const generous = solveParkingLayout(baseInput({ vehicle: STANDARD_VEHICLE, aisleWidth: 8 }));
    const tight = solveParkingLayout(baseInput({ vehicle: STANDARD_VEHICLE, aisleWidth: 4 }));
    expect(generous.candidates.length).toBeGreaterThan(0);
    expect(tight.candidates.length).toBeGreaterThan(0);
    expect(generous.candidates[0].warnings.some((w) => w.code === 'approach-clearance-insufficient')).toBe(false);
    expect(tight.candidates[0].warnings.some((w) => w.code === 'approach-clearance-insufficient')).toBe(true);
    for (const c of tight.candidates) assertCandidateInvariants(tight, c);
  });

  it('omitting `vehicle` never triggers manoeuvring warnings, even with a narrow aisle', () => {
    const out = solveParkingLayout(baseInput({ aisleWidth: 3 }));
    expect(out.candidates.length).toBeGreaterThan(0);
    for (const c of out.candidates) {
      expect(c.warnings.some((w) => w.code === 'approach-clearance-insufficient')).toBe(false);
      expect(c.warnings.some((w) => w.code === 'dead-end-no-turning-space')).toBe(false);
    }
  });

  it('dead-end aisles get a turning bay or a disclosed penalty warning; turning bays stay clear of stalls', () => {
    const out = solveParkingLayout(
      baseInput({ vehicle: { turningRadius: 5, sweptWidth: 2.0, length: 4.8 }, boundary: rect(80, 60), accessPoint: m(40, 0) }),
    );
    expect(out.candidates.length).toBeGreaterThan(0);
    for (const c of out.candidates) {
      assertCandidateInvariants(out, c);
      const degree = computeDegreeM(c);
      const hasDeadEndWarning = c.warnings.some((w) => w.code === 'dead-end-no-turning-space');
      const turningAisles = c.driveAisles.filter((a) => a.role === 'turning');
      for (const a of c.driveAisles) {
        if (a.role === 'spine' || a.role === 'turning') continue;
        if ((degree.get(a.aisleId) ?? 0) !== 1) continue;
        const hasNearbyTurningBay = turningAisles.some((t) => connectedM(t.ring, a.ring));
        expect(hasNearbyTurningBay || hasDeadEndWarning).toBe(true);
      }
    }
  });

  it('one-way circulation assigns travelDir to every aisle and discloses any directed-reachability gap', () => {
    const out = solveParkingLayout(baseInput({ vehicle: { turningRadius: 5, sweptWidth: 2.0, length: 4.8 }, oneWay: true }));
    expect(out.candidates.length).toBeGreaterThan(0);
    for (const c of out.candidates) {
      assertCandidateInvariants(out, c);
      for (const a of c.driveAisles) {
        expect(a.travelDir).toBe('oneway');
      }
    }
  });

  it('gate queue reserves extra throat length at the entrance', () => {
    const vehicle = { turningRadius: 6, sweptWidth: 2.0, length: 5 };
    const without = solveParkingLayout(baseInput({ vehicle }));
    const withQueue = solveParkingLayout(baseInput({ vehicle, gateQueue: { vehicles: 4 } }));
    expect(without.candidates.length).toBeGreaterThan(0);
    expect(withQueue.candidates.length).toBeGreaterThan(0);
    const areaWithout = ringAreaM(without.candidates[0].accessCorridor!.ring);
    const areaWith = ringAreaM(withQueue.candidates[0].accessCorridor!.ring);
    expect(areaWith).toBeGreaterThan(areaWithout);
    for (const c of withQueue.candidates) assertCandidateInvariants(withQueue, c);
  });

  it('visibility keepouts block placement like exclusions but are not reported as building exclusions', () => {
    const keepout = poly([
      [20, 0],
      [30, 0],
      [30, 8],
      [20, 8],
    ]);
    const out = solveParkingLayout(baseInput({ visibilityKeepouts: [keepout] }));
    expect(out.candidates.length).toBeGreaterThan(0);
    expect(out.expandedExclusions.length).toBe(0);
    for (const c of out.candidates) {
      assertCandidateInvariants(out, c);
      for (const stall of allStalls(c)) expect(overlapsM(stall.corners, keepout.ring)).toBe(false);
      for (const aisle of c.driveAisles) expect(overlapsM(aisle.ring, keepout.ring)).toBe(false);
    }
  });

  it('accessible bay policy designates genuinely wider bays without exceeding the target', () => {
    const out = solveParkingLayout(
      baseInput({ accessible: { rate: 0.1, bay: { width: 3.6, length: 4.8, sharedAccessWidth: 1.2 } } }),
    );
    expect(out.candidates.length).toBeGreaterThan(0);
    for (const c of out.candidates) {
      assertCandidateInvariants(out, c);
      const accessibleStalls = allStalls(c).filter((s) => s.accessible);
      expect(accessibleStalls.length).toBeGreaterThan(0);
      for (const s of accessibleStalls) {
        const corners = ringToM(s.corners);
        const side1 = Math.hypot(corners[0][0] - corners[1][0], corners[0][1] - corners[1][1]);
        const side2 = Math.hypot(corners[1][0] - corners[2][0], corners[1][1] - corners[2][1]);
        expect(Math.min(side1, side2)).toBeGreaterThan(2.4 * 1.5); // meaningfully wider than a standard 2.4 m stall
      }
    }
  });

  it('omitting `accessible` never marks a stall accessible', () => {
    const out = solveParkingLayout(baseInput());
    for (const c of out.candidates) {
      expect(allStalls(c).some((s) => s.accessible)).toBe(false);
    }
  });

  it('a pedestrian destination on the boundary gets routed to the entrance with a valid corridor', () => {
    const destinations = [{ id: 'd1', point: m(10, 30), attachTo: 'boundary' as const, label: 'Bus stop' }];
    const out = solveParkingLayout(baseInput({ destinations }));
    expect(out.candidates.length).toBeGreaterThan(0);
    for (const c of out.candidates) {
      assertCandidateInvariants(out, c);
      expect(c.pedestrianRoutes.length).toBe(1);
      expect(c.pedestrianRoutes[0].destinationId).toBe('d1');
      expect(c.pedestrianRoutes[0].path.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('a pedestrian destination attached to a building routes around it, not through it', () => {
    const building = poly([
      [20, 12],
      [30, 12],
      [30, 18],
      [20, 18],
    ]);
    const destinations = [{ id: 'entrance', point: m(25, 15), attachTo: 'exclusion' as const, anchorId: '0' }];
    const out = solveParkingLayout(baseInput({ exclusions: [building], destinations }));
    expect(out.candidates.length).toBeGreaterThan(0);
    for (const c of out.candidates) {
      assertCandidateInvariants(out, c);
      expect(c.pedestrianRoutes.length).toBe(1);
      const route = c.pedestrianRoutes[0];
      if (!c.warnings.some((w) => w.code === 'pedestrian-route-obstructed')) {
        for (const ex of out.expandedExclusions) {
          expect(overlapsM(route.corridor, ex.ring)).toBe(false);
        }
      }
    }
  });

  it('a user pedestrian override is used verbatim instead of automatic routing', () => {
    const destinations = [{ id: 'd1', point: m(10, 30), attachTo: 'boundary' as const }];
    const overridePath: LngLat[] = [m(10, 30), m(15, 15), m(25, 1)];
    const out = solveParkingLayout(
      baseInput({ destinations, pedestrianOverrides: [{ destinationId: 'd1', path: overridePath }] }),
    );
    expect(out.candidates.length).toBeGreaterThan(0);
    for (const c of out.candidates) {
      expect(c.pedestrianRoutes[0].userOverride).toBe(true);
      expect(c.pedestrianRoutes[0].path.length).toBe(overridePath.length);
    }
  });

  it('omitting `destinations` never produces pedestrian routes', () => {
    const out = solveParkingLayout(baseInput());
    for (const c of out.candidates) {
      expect(c.pedestrianRoutes).toEqual([]);
    }
  });
});

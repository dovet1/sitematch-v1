/**
 * Auto parking — mandatory exclusion detection.
 *
 * PURE MODULE. Real polygon intersection (not point-in-polygon): an object
 * becomes a mandatory exclusion if it is fully contained, partially crossing,
 * or edge-touching the selected boundary. There is no untick — every
 * intersecting polygon/CAD is included. See INTEGRATION_PLAN.md §4.
 *
 * Geometry runs in the boundary's local metre projection (reusing
 * lib/parking-layout-lab/geo, the same projection the solver itself uses)
 * rather than raw lng/lat, so the touch tolerance is a real physical
 * distance instead of a degree-scale epsilon.
 */

import { calculateCadImageCorners } from '../cad-utils';
import type { CadImage, CadInstance, Polygon, SavedCad } from '@/types/sitesketcher-v2';
import type { LngLat } from '@/lib/parking-layout-lab/types';
import {
  createProjection,
  dropClosing,
  pointInRing,
  pointToSegment,
  projectRing,
  ringCentroidLngLat,
  type LocalPoint,
} from '@/lib/parking-layout-lab/geo';

/** Edges within this distance (metres) of each other count as touching, not separate. */
const TOUCH_TOLERANCE_M = 0.02;

export interface DetectedExclusion {
  id: string;
  kind: 'polygon' | 'cadInstance' | 'cadImage';
  /** [lng, lat] ring, open or closed (both accepted). */
  ring: LngLat[];
}

export interface DetectionInput {
  boundaryId: string;
  boundaryRing: LngLat[];
  polygons: Polygon[];
  cadInstances: CadInstance[];
  cadImages: CadImage[];
  savedCads: SavedCad[];
}

/**
 * Every current polygon/CAD that intersects the boundary, excluding the
 * boundary itself. Runs on entering Auto and on any geometry change — the
 * result is never persisted, only its derived hash (see ./hash).
 */
export function detectMandatoryExclusions(input: DetectionInput): DetectedExclusion[] {
  const { boundaryId, boundaryRing, polygons, cadInstances, cadImages, savedCads } = input;
  const out: DetectedExclusion[] = [];

  for (const polygon of polygons) {
    if (polygon.id === boundaryId) continue;
    if (polygon.points.length < 3) continue;
    if (ringsIntersect(boundaryRing, polygon.points)) {
      out.push({ id: polygon.id, kind: 'polygon', ring: polygon.points });
    }
  }

  for (const instance of cadInstances) {
    const savedCad = savedCads.find((cad) => cad.id === instance.savedCadId);
    if (!savedCad) continue;
    const ring = cadQuad(instance, savedCad);
    if (ringsIntersect(boundaryRing, ring)) {
      out.push({ id: instance.id, kind: 'cadInstance', ring });
    }
  }

  for (const cadImage of cadImages) {
    if (cadImage.anchor === null) continue;
    const ring = cadQuad(cadImage);
    if (ringsIntersect(boundaryRing, ring)) {
      out.push({ id: cadImage.id, kind: 'cadImage', ring });
    }
  }

  return out;
}

function cadQuad(item: CadImage | CadInstance, savedCad?: SavedCad): LngLat[] {
  const corners = calculateCadImageCorners(item, savedCad);
  return [...corners, corners[0]];
}

/** True if ring A and ring B are fully separate — the negation is "is a mandatory exclusion". */
export function ringsIntersect(ringA: LngLat[], ringB: LngLat[]): boolean {
  const a = dropClosing(ringA);
  const b = dropClosing(ringB);
  if (a.length < 3 || b.length < 3) return false;

  // Project into a shared local-metre frame anchored at A's centroid so the
  // touch tolerance below is a physical distance, not a raw coordinate delta.
  const proj = createProjection(ringCentroidLngLat(a));
  const localA = projectRing(a, proj);
  const localB = projectRing(b, proj);

  for (let i = 0; i < localA.length; i++) {
    const a1 = localA[i];
    const a2 = localA[(i + 1) % localA.length];
    for (let j = 0; j < localB.length; j++) {
      const b1 = localB[j];
      const b2 = localB[(j + 1) % localB.length];
      if (segmentsIntersectOrTouch(a1, a2, b1, b2, TOUCH_TOLERANCE_M)) return true;
    }
  }

  // No edge crosses or touches: either fully separate, or one ring wholly
  // contains the other (e.g. a small CAD fully inside the boundary).
  if (pointInRing(localA[0], localB)) return true;
  if (pointInRing(localB[0], localA)) return true;
  return false;
}

function cross(o: LocalPoint, a: LocalPoint, b: LocalPoint): number {
  return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
}

function segmentsIntersectOrTouch(
  a1: LocalPoint,
  a2: LocalPoint,
  b1: LocalPoint,
  b2: LocalPoint,
  tolerance: number,
): boolean {
  const d1 = cross(b1, b2, a1);
  const d2 = cross(b1, b2, a2);
  const d3 = cross(a1, a2, b1);
  const d4 = cross(a1, a2, b2);
  const properCross =
    ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
  if (properCross) return true;

  // Non-crossing segments: the minimum separation is always at an endpoint.
  const separation = Math.min(
    pointToSegment(a1, b1, b2).distance,
    pointToSegment(a2, b1, b2).distance,
    pointToSegment(b1, a1, a2).distance,
    pointToSegment(b2, a1, a2).distance,
  );
  return separation <= tolerance;
}

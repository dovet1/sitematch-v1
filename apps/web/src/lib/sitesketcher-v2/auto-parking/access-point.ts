/**
 * Auto parking — access-point boundary snapping + edge-relative anchoring.
 *
 * PURE MODULE. Mirrors the snap-to-nearest-edge behaviour the solver applies
 * internally (see lib/parking-layout-lab/solver.ts `snapToBoundary`), exposed
 * standalone so the map's hover/click/drag interaction can preview the same
 * snap before a solve ever runs. Also owns re-projecting an edge-relative
 * anchor back onto a *changed* boundary ring (the guided flow's "Change" /
 * live-drag boundary editing), so the access point stays pinned to its edge
 * as that edge moves rather than staying at a stale lng/lat.
 */

import type { LngLat } from '@/lib/parking-layout-lab/types';
import {
  createProjection,
  dropClosing,
  dropClosingLocal,
  pointToSegment,
  projectRing,
  ringCentroidLngLat,
} from '@/lib/parking-layout-lab/geo';

export interface SnapResult {
  point: LngLat;
  /** Index of the boundary edge (i -> i+1, wrapping) the point snapped to. */
  edgeIndex: number;
  /** Distance in metres along that edge from its start vertex. */
  distanceAlongEdgeM: number;
}

/** The edge-relative representation stored in the draft — a `SnapResult` without the (now-stale) absolute point. */
export type AccessAnchor = Pick<SnapResult, 'edgeIndex' | 'distanceAlongEdgeM'>;

/** Snaps `point` to the nearest edge of `boundaryRing`. Returns null for a degenerate ring. */
export function snapPointToBoundaryEdge(point: LngLat, boundaryRing: LngLat[]): SnapResult | null {
  const ring = dropClosing(boundaryRing);
  if (ring.length < 2) return null;

  const proj = createProjection(ringCentroidLngLat(ring));
  const localRing = dropClosingLocal(projectRing(ring, proj));
  const localPoint = proj.toLocal(point);

  let bestDist = Infinity;
  let bestEdgeIndex = 0;
  let bestClosest = localRing[0];
  let bestT = 0;

  for (let i = 0; i < localRing.length; i++) {
    const a = localRing[i];
    const b = localRing[(i + 1) % localRing.length];
    const seg = pointToSegment(localPoint, a, b);
    if (seg.distance < bestDist) {
      bestDist = seg.distance;
      bestEdgeIndex = i;
      bestClosest = seg.closest;
      bestT = seg.t;
    }
  }

  const a = localRing[bestEdgeIndex];
  const b = localRing[(bestEdgeIndex + 1) % localRing.length];
  const edgeLenM = Math.hypot(b[0] - a[0], b[1] - a[1]);

  return {
    point: proj.toLngLat(bestClosest),
    edgeIndex: bestEdgeIndex,
    distanceAlongEdgeM: bestT * edgeLenM,
  };
}

/**
 * Re-projects an edge-relative anchor onto a (possibly reshaped) boundary
 * ring, keeping the access point pinned to its edge as the boundary is
 * dragged/edited. Returns `null` when the anchor's edge no longer exists —
 * the caller must then treat access as unset and reopen the placement step
 * (see docs/design_handoff_auto_parking_guided/README.md §3/§10).
 */
export function reprojectAccessAnchor(anchor: AccessAnchor, boundaryRing: LngLat[]): LngLat | null {
  const ring = dropClosing(boundaryRing);
  if (ring.length < 2) return null;
  if (anchor.edgeIndex < 0 || anchor.edgeIndex >= ring.length) return null;

  const proj = createProjection(ringCentroidLngLat(ring));
  const localRing = dropClosingLocal(projectRing(ring, proj));
  const a = localRing[anchor.edgeIndex];
  const b = localRing[(anchor.edgeIndex + 1) % localRing.length];
  const edgeLenM = Math.hypot(b[0] - a[0], b[1] - a[1]);
  if (edgeLenM < 1e-9) return proj.toLngLat(a);

  const t = Math.min(1, Math.max(0, anchor.distanceAlongEdgeM / edgeLenM));
  const local: [number, number] = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  return proj.toLngLat(local);
}

/** True when `anchor`'s edge still exists on `boundaryRing` (i.e. it wasn't deleted by a vertex edit). */
export function isAccessAnchorValid(anchor: AccessAnchor, boundaryRing: LngLat[]): boolean {
  const ring = dropClosing(boundaryRing);
  return ring.length >= 2 && anchor.edgeIndex >= 0 && anchor.edgeIndex < ring.length;
}

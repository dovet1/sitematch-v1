import type { AutoParkingEntrance, AutoParkingExclusionRef, Polygon } from '@/types/sitesketcher-v2';
import type { LngLat } from '@/lib/parking-layout-lab/types';
import { createProjection, dropClosing, pointInRing, projectRing } from '@/lib/parking-layout-lab/geo';
import { isAccessAnchorValid, reprojectAccessAnchor, snapPointToBoundaryEdge } from './access-point';

export interface SnappedBuildingEntrance {
  entrance: Extract<AutoParkingEntrance, { kind: 'building' }>;
  point: LngLat;
  wall: [LngLat, LngLat];
}

/** Find the closest wall among the explicitly selected polygon buildings. */
export function snapEntranceToBuildings(
  point: LngLat,
  buildingRefs: AutoParkingExclusionRef[],
  polygons: Polygon[],
): SnappedBuildingEntrance | null {
  const projection = createProjection(point);
  const localPoint = projection.toLocal(point);
  let best: (SnappedBuildingEntrance & { distance: number }) | null = null;

  for (const ref of buildingRefs) {
    if (ref.kind !== 'polygon') continue;
    const building = polygons.find((polygon) => polygon.id === ref.id);
    if (!building) continue;
    const snap = snapPointToBoundaryEdge(point, building.points);
    if (!snap) continue;
    const localSnap = projection.toLocal(snap.point);
    const distance = Math.hypot(localSnap[0] - localPoint[0], localSnap[1] - localPoint[1]);
    const ring = dropClosing(building.points);
    const wall: [LngLat, LngLat] = [ring[snap.edgeIndex], ring[(snap.edgeIndex + 1) % ring.length]];
    if (!best || distance < best.distance) {
      best = {
        entrance: {
          kind: 'building',
          buildingId: building.id,
          edgeIndex: snap.edgeIndex,
          distanceAlongEdgeM: snap.distanceAlongEdgeM,
        },
        point: snap.point,
        wall,
        distance,
      };
    }
  }

  if (!best) return null;
  const { distance: _distance, ...result } = best;
  return result;
}

/** Resolve a persisted/draft entrance against current building geometry. */
export function resolveEntrance(entrance: AutoParkingEntrance | null | undefined, polygons: Polygon[]): LngLat | null {
  if (!entrance) return null;
  if (entrance.kind === 'target') return entrance.point;
  const building = polygons.find((polygon) => polygon.id === entrance.buildingId);
  if (!building) return null;
  return reprojectAccessAnchor(
    { edgeIndex: entrance.edgeIndex, distanceAlongEdgeM: entrance.distanceAlongEdgeM },
    building.points,
  );
}

export function isEntranceValid(
  entrance: AutoParkingEntrance | null | undefined,
  polygons: Polygon[],
  boundaryRing?: LngLat[],
): boolean {
  if (!entrance) return false;
  if (entrance.kind === 'target') return boundaryRing ? isPointInsideRing(entrance.point, boundaryRing) : true;
  const building = polygons.find((polygon) => polygon.id === entrance.buildingId);
  return !!building && isAccessAnchorValid(entrance, building.points);
}

export function entranceWall(
  entrance: AutoParkingEntrance | null | undefined,
  polygons: Polygon[],
): [LngLat, LngLat] | null {
  if (!entrance || entrance.kind !== 'building') return null;
  const building = polygons.find((polygon) => polygon.id === entrance.buildingId);
  if (!building) return null;
  const ring = dropClosing(building.points);
  if (entrance.edgeIndex < 0 || entrance.edgeIndex >= ring.length) return null;
  return [ring[entrance.edgeIndex], ring[(entrance.edgeIndex + 1) % ring.length]];
}

export function isPointInsideRing(point: LngLat, ring: LngLat[]): boolean {
  const open = dropClosing(ring);
  if (open.length < 3) return false;
  const projection = createProjection(point);
  return pointInRing(projection.toLocal(point), projectRing(open, projection));
}

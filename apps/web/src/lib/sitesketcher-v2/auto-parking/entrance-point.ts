import type {
  AutoParkingEntrance,
  AutoParkingExclusionRef,
  CadImage,
  CadInstance,
  Polygon,
  SavedCad,
} from '@/types/sitesketcher-v2';
import type { LngLat } from '@/lib/parking-layout-lab/types';
import { createProjection, dropClosing, pointInRing, projectRing } from '@/lib/parking-layout-lab/geo';
import { isAccessAnchorValid, reprojectAccessAnchor, snapPointToBoundaryEdge } from './access-point';
import { resolveGuidedExclusions } from './detection';

type BuildingEntrance = Extract<AutoParkingEntrance, { kind: 'building' }>;

export type EntranceBuildingKind = NonNullable<BuildingEntrance['buildingKind']>;

/**
 * A footprint the building entrance can attach to — an explicitly selected
 * polygon building or an intersecting CAD. Structurally a `DetectedExclusion`
 * (see ./detection), so `resolveGuidedExclusions(...).exclusions` can be passed
 * straight in.
 */
export interface EntranceBuilding {
  id: string;
  kind: EntranceBuildingKind;
  ring: LngLat[];
}

export interface SnappedBuildingEntrance {
  entrance: BuildingEntrance;
  point: LngLat;
  wall: [LngLat, LngLat];
}

/** Old entrances lack `buildingKind`; treat a missing value as a polygon. */
function entranceBuildingKind(entrance: BuildingEntrance): EntranceBuildingKind {
  return entrance.buildingKind ?? 'polygon';
}

function findEntranceBuilding(
  entrance: BuildingEntrance,
  buildings: EntranceBuilding[],
): EntranceBuilding | undefined {
  const kind = entranceBuildingKind(entrance);
  return buildings.find((building) => building.id === entrance.buildingId && building.kind === kind);
}

/**
 * Resolve the guided building set (selected polygons + intersecting CAD) into
 * the footprint list the entrance snaps/resolves against.
 */
export function entranceBuildings(input: {
  boundaryId: string;
  boundaryRing: LngLat[];
  buildingRefs: AutoParkingExclusionRef[];
  polygons: Polygon[];
  cadInstances: CadInstance[];
  cadImages: CadImage[];
  savedCads: SavedCad[];
}): EntranceBuilding[] {
  return resolveGuidedExclusions(input).exclusions;
}

/** Find the closest wall among the building footprints (polygons and CAD). */
export function snapEntranceToBuildings(
  point: LngLat,
  buildings: EntranceBuilding[],
): SnappedBuildingEntrance | null {
  const projection = createProjection(point);
  const localPoint = projection.toLocal(point);
  let best: (SnappedBuildingEntrance & { distance: number }) | null = null;

  for (const building of buildings) {
    const snap = snapPointToBoundaryEdge(point, building.ring);
    if (!snap) continue;
    const localSnap = projection.toLocal(snap.point);
    const distance = Math.hypot(localSnap[0] - localPoint[0], localSnap[1] - localPoint[1]);
    const ring = dropClosing(building.ring);
    const wall: [LngLat, LngLat] = [ring[snap.edgeIndex], ring[(snap.edgeIndex + 1) % ring.length]];
    if (!best || distance < best.distance) {
      best = {
        entrance: {
          kind: 'building',
          buildingId: building.id,
          buildingKind: building.kind,
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
export function resolveEntrance(
  entrance: AutoParkingEntrance | null | undefined,
  buildings: EntranceBuilding[],
): LngLat | null {
  if (!entrance) return null;
  if (entrance.kind === 'target') return entrance.point;
  const building = findEntranceBuilding(entrance, buildings);
  if (!building) return null;
  return reprojectAccessAnchor(
    { edgeIndex: entrance.edgeIndex, distanceAlongEdgeM: entrance.distanceAlongEdgeM },
    building.ring,
  );
}

export function isEntranceValid(
  entrance: AutoParkingEntrance | null | undefined,
  buildings: EntranceBuilding[],
  boundaryRing?: LngLat[],
): boolean {
  if (!entrance) return false;
  if (entrance.kind === 'target') return boundaryRing ? isPointInsideRing(entrance.point, boundaryRing) : true;
  const building = findEntranceBuilding(entrance, buildings);
  return !!building && isAccessAnchorValid(entrance, building.ring);
}

export function entranceWall(
  entrance: AutoParkingEntrance | null | undefined,
  buildings: EntranceBuilding[],
): [LngLat, LngLat] | null {
  if (!entrance || entrance.kind !== 'building') return null;
  const building = findEntranceBuilding(entrance, buildings);
  if (!building) return null;
  const ring = dropClosing(building.ring);
  if (entrance.edgeIndex < 0 || entrance.edgeIndex >= ring.length) return null;
  return [ring[entrance.edgeIndex], ring[(entrance.edgeIndex + 1) % ring.length]];
}

export function isPointInsideRing(point: LngLat, ring: LngLat[]): boolean {
  const open = dropClosing(ring);
  if (open.length < 3) return false;
  const projection = createProjection(point);
  return pointInRing(projection.toLocal(point), projectRing(open, projection));
}

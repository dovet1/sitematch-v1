/**
 * Auto parking — single source of truth for "is this applied layout stale".
 *
 * Wraps detection + hash comparison so the object list, the inspector, and
 * the map rendering sync all derive the same answer instead of each
 * reimplementing the boundary-lookup + detect + compare sequence. See
 * docs/design_handoff_auto_parking_guided/README.md §9/§10.
 */

import type { AutoParkingLayout, CadImage, CadInstance, Polygon, SavedCad } from '@/types/sitesketcher-v2';
import { detectMandatoryExclusions, resolveGuidedExclusions } from './detection';
import { resolveEntrance } from './entrance-point';
import { isLayoutStale } from './hash';

export interface StalenessSceneInput {
  polygons: Polygon[];
  cadInstances: CadInstance[];
  cadImages: CadImage[];
  savedCads: SavedCad[];
}

/**
 * True when `layout`'s persisted geometry no longer matches its current
 * source inputs — the boundary was reshaped/deleted, or the mandatory
 * exclusion set derived from it changed. Never trust a stored flag; this
 * always recomputes.
 */
export function deriveAutoLayoutStale(layout: AutoParkingLayout, scene: StalenessSceneInput): boolean {
  const boundaryPolygon = scene.polygons.find((p) => p.id === layout.boundaryId);
  if (!boundaryPolygon) return true; // the boundary itself was deleted

  const detectionInput = {
    boundaryId: boundaryPolygon.id,
    boundaryRing: boundaryPolygon.points,
    polygons: scene.polygons,
    cadInstances: scene.cadInstances,
    cadImages: scene.cadImages,
    savedCads: scene.savedCads,
  };

  // Layouts saved before the entrance/building-picking flow retain the exact
  // v1 mandatory-detection contract until they are explicitly regenerated.
  if (!layout.entrance) {
    const exclusions = detectMandatoryExclusions(detectionInput);
    return isLayoutStale(layout, {
      boundaryRing: boundaryPolygon.points,
      exclusions,
      accessPoint: layout.accessPoint,
      settingsSnapshot: layout.settingsSnapshot,
    });
  }

  const resolved = resolveGuidedExclusions({
    ...detectionInput,
    buildingRefs: layout.exclusionRefs.filter((ref) => ref.kind === 'polygon'),
  });
  // An explicitly selected building is provenance, not a hint. Deletion must
  // mark the reviewed layout stale rather than silently dropping the blocker.
  if (resolved.missingRefs.length > 0) return true;
  const entrancePoint = resolveEntrance(layout.entrance, resolved.exclusions);
  if (!entrancePoint) return true;

  return isLayoutStale(layout, {
    boundaryRing: boundaryPolygon.points,
    exclusions: resolved.exclusions,
    accessPoint: layout.accessPoint,
    entrance: { anchor: layout.entrance, point: entrancePoint },
    settingsSnapshot: layout.settingsSnapshot,
  });
}

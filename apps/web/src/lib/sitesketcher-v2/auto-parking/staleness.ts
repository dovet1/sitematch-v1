/**
 * Auto parking — single source of truth for "is this applied layout stale".
 *
 * Wraps detection + hash comparison so the object list, the inspector, and
 * the map rendering sync all derive the same answer instead of each
 * reimplementing the boundary-lookup + detect + compare sequence. See
 * docs/design_handoff_auto_parking_guided/README.md §9/§10.
 */

import type { AutoParkingLayout, CadImage, CadInstance, Polygon, SavedCad } from '@/types/sitesketcher-v2';
import { detectMandatoryExclusions } from './detection';
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

  const exclusions = detectMandatoryExclusions({
    boundaryId: boundaryPolygon.id,
    boundaryRing: boundaryPolygon.points,
    polygons: scene.polygons,
    cadInstances: scene.cadInstances,
    cadImages: scene.cadImages,
    savedCads: scene.savedCads,
  });

  return isLayoutStale(layout, {
    boundaryRing: boundaryPolygon.points,
    exclusions,
    accessPoint: layout.accessPoint,
    settingsSnapshot: layout.settingsSnapshot,
  });
}

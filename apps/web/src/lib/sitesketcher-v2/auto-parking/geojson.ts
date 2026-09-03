/**
 * Auto parking — persisted-geometry filter + namespacing.
 *
 * PURE MODULE. `candidateToGeoJSON` (lib/parking-layout-lab/geojson) emits the
 * WHOLE scene — site-boundary, usable-boundary, exclusion, exclusion-
 * clearance, visibility-keepout, access-point + stalls/aisles/corridor.
 * Persisting/rendering all of it would duplicate the existing plot and
 * building layers, so this keeps only layout features (stall, aisle,
 * access-corridor, access-point). Every retained feature carries an
 * `autoLayoutId`, and row/aisle/candidate ids are namespaced by layout id so
 * multiple applied layouts can't collide. See INTEGRATION_PLAN.md §3a.
 */

import type { ParkingFeatureCollection } from '@/lib/parking-layout-lab/geojson';

type SourceFeature = ParkingFeatureCollection['features'][number];

const LAYOUT_FEATURE_TYPES = new Set(['parking-stall', 'drive-aisle', 'access-corridor', 'access-point']);
const NAMESPACED_ID_PROPS = ['rowId', 'aisleId', 'candidateId'] as const;

/**
 * Filter a full solver export down to persisted layout geometry and
 * namespace its ids by `autoLayoutId`.
 */
export function filterLayoutFeatures(
  fc: ParkingFeatureCollection,
  autoLayoutId: string,
): GeoJSON.FeatureCollection {
  const features = fc.features
    .filter((f) => LAYOUT_FEATURE_TYPES.has(f.properties.featureType as string))
    .map((f) => namespaceFeature(f, autoLayoutId));

  return {
    type: 'FeatureCollection',
    features: features as GeoJSON.Feature[],
  };
}

function namespaceFeature(feature: SourceFeature, autoLayoutId: string): SourceFeature {
  const properties: Record<string, unknown> = { ...feature.properties, autoLayoutId };
  for (const key of NAMESPACED_ID_PROPS) {
    const value = properties[key];
    if (typeof value === 'string') properties[key] = `${autoLayoutId}:${value}`;
  }
  return { ...feature, properties };
}

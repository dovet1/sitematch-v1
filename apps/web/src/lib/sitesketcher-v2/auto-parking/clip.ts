/**
 * Auto parking — stale-layout display clipping.
 *
 * PURE MODULE. A stale applied layout's bays were solved against a boundary
 * that has since been reshaped; the guided flow never re-solves silently
 * (see README.md §10), but rendering the old bays unclipped could show them
 * overhanging the new, smaller boundary. This clips each stale-layout
 * feature to the CURRENT boundary ring for display only — it never touches
 * the persisted geometry.
 */

import intersect from '@turf/intersect';
import { polygon as turfPolygon, featureCollection } from '@turf/helpers';
import type { LngLat } from '@/lib/parking-layout-lab/types';

/** Clips polygon features in `fc` to `boundaryRing`; non-polygon features (e.g. access-point) pass through unchanged. */
export function clipFeaturesToBoundary(
  fc: GeoJSON.FeatureCollection,
  boundaryRing: LngLat[],
): GeoJSON.FeatureCollection {
  const ring = closeRing(boundaryRing);
  if (ring.length < 4) return fc;

  let boundaryFeature: GeoJSON.Feature<GeoJSON.Polygon>;
  try {
    boundaryFeature = turfPolygon([ring]);
  } catch {
    return fc; // degenerate/self-intersecting boundary — skip clipping rather than throw during render
  }

  const features: GeoJSON.Feature[] = [];
  for (const f of fc.features) {
    if (f.geometry?.type !== 'Polygon' && f.geometry?.type !== 'MultiPolygon') {
      features.push(f);
      continue;
    }
    try {
      const clipped = intersect(
        featureCollection([f as GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>, boundaryFeature]),
      );
      if (clipped) features.push({ ...clipped, properties: f.properties });
      // else: fully outside the new boundary — dropped.
    } catch {
      features.push(f); // clip failure (degenerate geometry) — show unclipped rather than drop
    }
  }

  return { type: 'FeatureCollection', features };
}

function closeRing(ring: LngLat[]): LngLat[] {
  if (ring.length === 0) return ring;
  const [firstLng, firstLat] = ring[0];
  const [lastLng, lastLat] = ring[ring.length - 1];
  if (firstLng === lastLng && firstLat === lastLat) return ring;
  return [...ring, ring[0]];
}

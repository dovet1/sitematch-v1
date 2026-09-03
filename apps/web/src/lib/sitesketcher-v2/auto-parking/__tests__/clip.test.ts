import { clipFeaturesToBoundary } from '../clip';
import type { LngLat } from '@/lib/parking-layout-lab/types';

function poly(ring: LngLat[], properties: Record<string, unknown> = {}): GeoJSON.Feature<GeoJSON.Polygon> {
  return { type: 'Feature', properties, geometry: { type: 'Polygon', coordinates: [ring] } };
}

describe('clipFeaturesToBoundary', () => {
  it('clips a bay that overhangs the new, smaller boundary', () => {
    const bigBoundary: LngLat[] = [
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10],
      [0, 0],
    ];
    const overhangingBay = poly(
      [
        [8, 2],
        [12, 2],
        [12, 4],
        [8, 4],
        [8, 2],
      ],
      { featureType: 'parking-stall' },
    );
    const fc: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [overhangingBay] };

    const clipped = clipFeaturesToBoundary(fc, bigBoundary);
    expect(clipped.features).toHaveLength(1);
    const [minLng, , maxLng] = boundsOf(clipped.features[0]);
    expect(maxLng).toBeLessThanOrEqual(10.0001);
    expect(minLng).toBeGreaterThanOrEqual(8 - 0.0001);
    expect(clipped.features[0].properties?.featureType).toBe('parking-stall');
  });

  it('drops a feature fully outside the new boundary', () => {
    const boundary: LngLat[] = [
      [0, 0],
      [5, 0],
      [5, 5],
      [0, 5],
      [0, 0],
    ];
    const faraway = poly([
      [20, 20],
      [21, 20],
      [21, 21],
      [20, 21],
      [20, 20],
    ]);
    const fc: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [faraway] };
    expect(clipFeaturesToBoundary(fc, boundary).features).toHaveLength(0);
  });

  it('passes non-polygon features through unchanged (e.g. the access point)', () => {
    const boundary: LngLat[] = [
      [0, 0],
      [5, 0],
      [5, 5],
      [0, 5],
      [0, 0],
    ];
    const point: GeoJSON.Feature<GeoJSON.Point> = {
      type: 'Feature',
      properties: { featureType: 'access-point' },
      geometry: { type: 'Point', coordinates: [100, 100] },
    };
    const fc: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [point] };
    const clipped = clipFeaturesToBoundary(fc, boundary);
    expect(clipped.features).toEqual([point]);
  });

  it('leaves a fully-contained bay untouched', () => {
    const boundary: LngLat[] = [
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10],
      [0, 0],
    ];
    const contained = poly(
      [
        [2, 2],
        [4, 2],
        [4, 4],
        [2, 4],
        [2, 2],
      ],
      { featureType: 'parking-stall' },
    );
    const fc: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [contained] };
    const clipped = clipFeaturesToBoundary(fc, boundary);
    expect(clipped.features).toHaveLength(1);
  });
});

function boundsOf(f: GeoJSON.Feature): [number, number, number, number] {
  const coords: LngLat[] =
    f.geometry.type === 'Polygon'
      ? (f.geometry.coordinates[0] as LngLat[])
      : (f.geometry as GeoJSON.MultiPolygon).coordinates.flatMap((poly) => poly[0] as LngLat[]);
  const lngs = coords.map((c) => c[0]);
  const lats = coords.map((c) => c[1]);
  return [Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)];
}

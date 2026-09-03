import { filterLayoutFeatures } from '../geojson';
import type { ParkingFeatureCollection } from '@/lib/parking-layout-lab/geojson';

function polyFeature(
  featureType: string,
  properties: Record<string, unknown> = {},
): ParkingFeatureCollection['features'][number] {
  return {
    type: 'Feature',
    properties: { featureType, ...properties },
    geometry: { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]] },
  };
}

function pointFeature(featureType: string): ParkingFeatureCollection['features'][number] {
  return {
    type: 'Feature',
    properties: { featureType },
    geometry: { type: 'Point', coordinates: [0, 0] },
  };
}

const fixture: ParkingFeatureCollection = {
  type: 'FeatureCollection',
  properties: {},
  features: [
    polyFeature('site-boundary'),
    polyFeature('usable-boundary'),
    polyFeature('exclusion'),
    polyFeature('exclusion-clearance'),
    polyFeature('visibility-keepout'),
    pointFeature('access-point'),
    polyFeature('access-corridor', { candidateId: 'cand-1' }),
    polyFeature('drive-aisle', { candidateId: 'cand-1', aisleId: 'aisle-1', role: 'perimeter' }),
    polyFeature('parking-row', { candidateId: 'cand-1', rowId: 'row-1', aisleId: 'aisle-1' }),
    polyFeature('parking-stall', { candidateId: 'cand-1', rowId: 'row-1', aisleId: 'aisle-1', stallIndex: 0 }),
  ],
};

describe('filterLayoutFeatures', () => {
  it('keeps only stall/aisle/corridor/access-point features', () => {
    const out = filterLayoutFeatures(fixture, 'layout-1');
    const kept = out.features.map((f) => f.properties!.featureType);
    expect(kept.sort()).toEqual(['access-corridor', 'access-point', 'drive-aisle', 'parking-stall'].sort());
  });

  it('drops scene features that would duplicate the plot/building layers', () => {
    const out = filterLayoutFeatures(fixture, 'layout-1');
    const kept = out.features.map((f) => f.properties!.featureType);
    expect(kept).not.toContain('site-boundary');
    expect(kept).not.toContain('usable-boundary');
    expect(kept).not.toContain('exclusion');
    expect(kept).not.toContain('exclusion-clearance');
    expect(kept).not.toContain('visibility-keepout');
    expect(kept).not.toContain('parking-row');
  });

  it('tags every retained feature with autoLayoutId', () => {
    const out = filterLayoutFeatures(fixture, 'layout-1');
    expect(out.features.every((f) => f.properties!.autoLayoutId === 'layout-1')).toBe(true);
  });

  it('namespaces rowId/aisleId/candidateId by layout id', () => {
    const out = filterLayoutFeatures(fixture, 'layout-1');
    const stall = out.features.find((f) => f.properties!.featureType === 'parking-stall')!;
    expect(stall.properties!.rowId).toBe('layout-1:row-1');
    expect(stall.properties!.aisleId).toBe('layout-1:aisle-1');
    expect(stall.properties!.candidateId).toBe('layout-1:cand-1');

    const aisle = out.features.find((f) => f.properties!.featureType === 'drive-aisle')!;
    expect(aisle.properties!.aisleId).toBe('layout-1:aisle-1');
    expect(aisle.properties!.candidateId).toBe('layout-1:cand-1');
  });

  it('does not collide ids across two different layouts filtered separately', () => {
    const a = filterLayoutFeatures(fixture, 'layout-a');
    const b = filterLayoutFeatures(fixture, 'layout-b');
    const aisleA = a.features.find((f) => f.properties!.featureType === 'drive-aisle')!;
    const aisleB = b.features.find((f) => f.properties!.featureType === 'drive-aisle')!;
    expect(aisleA.properties!.aisleId).not.toBe(aisleB.properties!.aisleId);
  });
});

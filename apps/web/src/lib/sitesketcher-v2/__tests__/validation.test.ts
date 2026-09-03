import { sanitizeSketchForUser, validateAutoLayouts, validateSketchData, AUTO_PARKING_LIMITS } from '../validation';
import type { AutoParkingLayout, SketchData } from '@/types/sitesketcher-v2';

function fakeLayout(overrides: Partial<AutoParkingLayout> = {}): AutoParkingLayout {
  return {
    id: 'auto-1',
    name: 'Auto layout 1',
    geometrySchemaVersion: 1,
    boundaryId: 'polygon-1',
    exclusionRefs: [],
    accessPoint: [0, 0],
    settingsSnapshot: {
      stallSize: 'standard',
      aisleWidth: 6,
      boundarySetback: 1,
      buildingClearance: 1,
      checkManoeuvring: false,
      oneWay: false,
      gateQueueVehicles: null,
      accessibleBays: { on: false, percent: 5 },
    },
    geometry: { type: 'FeatureCollection', features: [] },
    metrics: { totalSpaces: 10, standard: 10, accessible: 0, rows: 1, footprintSqm: 50 },
    warnings: [],
    sourceHash: 'v1-abc',
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  };
}

function baseSketchData(overrides: Partial<SketchData> = {}): SketchData {
  return {
    version: 2,
    polygons: [],
    parkingBlocks: [],
    cadInstances: [],
    viewport: { center: [0, 0], zoom: 10, pitch: 0, bearing: 0 },
    settings: { units: 'metric', mapStyle: 'hybrid', sideLabelsOn: true },
    ...overrides,
  };
}

describe('validateAutoLayouts', () => {
  it('accepts an empty array for non-Plus (the routine case, not a gate)', () => {
    expect(validateAutoLayouts([], false)).toEqual({ isValid: true, errors: [] });
    expect(validateAutoLayouts(undefined, false)).toEqual({ isValid: true, errors: [] });
  });

  it('rejects a non-empty array for non-Plus', () => {
    const result = validateAutoLayouts([fakeLayout()], false);
    expect(result.isValid).toBe(false);
    expect(result.errors[0]).toMatch(/Plus subscription/);
  });

  it('accepts empty or non-empty for Plus', () => {
    expect(validateAutoLayouts([], true).isValid).toBe(true);
    expect(validateAutoLayouts([fakeLayout()], true).isValid).toBe(true);
  });

  it('rejects more than the per-sketch layout cap, even for Plus', () => {
    const layouts = Array.from({ length: AUTO_PARKING_LIMITS.maxLayoutsPerSketch + 1 }, (_, i) =>
      fakeLayout({ id: `auto-${i}` })
    );
    const result = validateAutoLayouts(layouts, true);
    expect(result.isValid).toBe(false);
    expect(result.errors[0]).toMatch(/limited to/);
  });

  it('rejects a layout whose feature count exceeds the bound', () => {
    const hugeFeatures = Array.from({ length: AUTO_PARKING_LIMITS.maxFeaturesPerLayout + 1 }, () => ({
      type: 'Feature' as const,
      properties: {},
      geometry: { type: 'Point' as const, coordinates: [0, 0] },
    }));
    const result = validateAutoLayouts(
      [fakeLayout({ geometry: { type: 'FeatureCollection', features: hugeFeatures } as any })],
      true
    );
    expect(result.isValid).toBe(false);
    expect(result.errors[0]).toMatch(/too many geometry features/);
  });

  it('rejects a layout whose total coordinate count exceeds the bound', () => {
    const bigRing = Array.from({ length: AUTO_PARKING_LIMITS.maxCoordinatesPerLayout + 1 }, () => [0, 0]);
    const result = validateAutoLayouts(
      [
        fakeLayout({
          geometry: {
            type: 'FeatureCollection',
            features: [{ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [bigRing] } }],
          } as any,
        }),
      ],
      true
    );
    expect(result.isValid).toBe(false);
    expect(result.errors[0]).toMatch(/too large/);
  });

  it('does not run size checks against a request that is rejected on entitlement alone', () => {
    // A non-Plus request with an oversized layout should still report the
    // Plus-subscription error, not a confusing pile of unrelated size errors.
    const hugeFeatures = Array.from({ length: AUTO_PARKING_LIMITS.maxFeaturesPerLayout + 1 }, () => ({
      type: 'Feature' as const,
      properties: {},
      geometry: { type: 'Point' as const, coordinates: [0, 0] },
    }));
    const result = validateAutoLayouts(
      [fakeLayout({ geometry: { type: 'FeatureCollection', features: hugeFeatures } as any })],
      false
    );
    expect(result.errors).toEqual(['Auto parking layouts require Plus subscription']);
  });
});

describe('validateSketchData — autoLayouts integration', () => {
  it('folds an auto-layouts entitlement failure into the whole-sketch result', () => {
    const result = validateSketchData(baseSketchData({ autoLayouts: [fakeLayout()] }), true, false);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Auto parking layouts require Plus subscription');
  });

  it('is valid for a Plus user with auto layouts and no other violations', () => {
    const result = validateSketchData(baseSketchData({ autoLayouts: [fakeLayout()] }), true, true);
    expect(result.isValid).toBe(true);
  });
});

describe('sanitizeSketchForUser', () => {
  it('strips autoLayouts (and CAD) for non-Plus viewers', () => {
    const data = baseSketchData({ autoLayouts: [fakeLayout()], cadInstances: [] });
    const sanitized = sanitizeSketchForUser(data, false);
    expect(sanitized.autoLayouts).toEqual([]);
  });

  it('passes autoLayouts through untouched for Plus viewers', () => {
    const layout = fakeLayout();
    const data = baseSketchData({ autoLayouts: [layout] });
    const sanitized = sanitizeSketchForUser(data, true);
    expect(sanitized.autoLayouts).toEqual([layout]);
  });
});

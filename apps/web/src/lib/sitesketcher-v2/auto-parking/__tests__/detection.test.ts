import { detectMandatoryExclusions, ringsIntersect } from '../detection';
import type { CadInstance, Polygon, SavedCad } from '@/types/sitesketcher-v2';
import type { LngLat } from '@/lib/parking-layout-lab/types';

const ORIGIN: LngLat = [-1.08, 51.28]; // arbitrary, matches solver.test.ts convention
const EARTH_R = 6_378_137;
const DEG = Math.PI / 180;
const cosLat0 = Math.cos(ORIGIN[1] * DEG);

/** Convert local metres [x east, y north] to [lng, lat]. */
function m(x: number, y: number): LngLat {
  const lat = ORIGIN[1] + (y / EARTH_R) * (180 / Math.PI);
  const lon = ORIGIN[0] + (x / (EARTH_R * cosLat0)) * (180 / Math.PI);
  return [lon, lat];
}

function rect(x0: number, y0: number, w: number, h: number): LngLat[] {
  return [m(x0, y0), m(x0 + w, y0), m(x0 + w, y0 + h), m(x0, y0 + h), m(x0, y0)];
}

function polygon(id: string, ring: LngLat[]): Polygon {
  return {
    id,
    name: id,
    colorIndex: 0,
    points: ring,
    rotation: 0,
    height: 0,
    showDistances: false,
    showArea: false,
    createdAt: 1,
    updatedAt: 1,
  };
}

const boundary = rect(0, 0, 40, 30); // 0..40 x 0..30

describe('ringsIntersect', () => {
  it('is true when B is fully contained in A', () => {
    expect(ringsIntersect(boundary, rect(10, 10, 5, 5))).toBe(true);
  });

  it('is true when B partially crosses A', () => {
    expect(ringsIntersect(boundary, rect(35, 10, 10, 5))).toBe(true);
  });

  it('is false when B is fully separate from A', () => {
    expect(ringsIntersect(boundary, rect(100, 100, 5, 5))).toBe(false);
  });

  it('is true when B shares an edge with A (touching, not crossing)', () => {
    // Shares the boundary's right edge (x=40) exactly.
    expect(ringsIntersect(boundary, rect(40, 5, 10, 5))).toBe(true);
  });

  it('is true when A is fully contained in B (reverse containment)', () => {
    expect(ringsIntersect(rect(10, 10, 5, 5), boundary)).toBe(true);
  });
});

describe('detectMandatoryExclusions', () => {
  it('excludes the boundary polygon itself even if listed among polygons', () => {
    const boundaryPolygon = polygon('boundary', boundary);
    const result = detectMandatoryExclusions({
      boundaryId: 'boundary',
      boundaryRing: boundary,
      polygons: [boundaryPolygon],
      cadInstances: [],
      cadImages: [],
      savedCads: [],
    });
    expect(result).toEqual([]);
  });

  it('flags an intersecting polygon and skips a separate one', () => {
    const inside = polygon('inside', rect(5, 5, 5, 5));
    const outside = polygon('outside', rect(200, 200, 5, 5));
    const result = detectMandatoryExclusions({
      boundaryId: 'boundary',
      boundaryRing: boundary,
      polygons: [inside, outside],
      cadInstances: [],
      cadImages: [],
      savedCads: [],
    });
    expect(result).toEqual([{ id: 'inside', kind: 'polygon', ring: inside.points }]);
  });

  it('flags an intersecting CAD instance via its rotated quad', () => {
    const savedCad: SavedCad = {
      id: 'saved-1',
      userId: 'u1',
      name: 'Plan',
      fileName: 'plan.png',
      url: 'https://example.com/plan.png',
      storagePath: 'u1/plan.png',
      metresPerPixel: 1,
      imageWidthPx: 10,
      imageHeightPx: 10,
      createdAt: '2020-01-01',
      updatedAt: '2020-01-01',
    };
    const instance: CadInstance = {
      id: 'inst-1',
      savedCadId: 'saved-1',
      anchor: m(15, 15), // centre of a 10x10m quad, well inside the boundary
      rotation: 0,
      opacity: 0.7,
      createdAt: 1,
      updatedAt: 1,
    };
    const result = detectMandatoryExclusions({
      boundaryId: 'boundary',
      boundaryRing: boundary,
      polygons: [],
      cadInstances: [instance],
      cadImages: [],
      savedCads: [savedCad],
    });
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: 'inst-1', kind: 'cadInstance' });
  });

  it('skips a CAD instance whose SavedCad is missing (can\'t compute a quad)', () => {
    const instance: CadInstance = {
      id: 'inst-orphan',
      savedCadId: 'missing',
      anchor: m(15, 15),
      rotation: 0,
      opacity: 0.7,
      createdAt: 1,
      updatedAt: 1,
    };
    const result = detectMandatoryExclusions({
      boundaryId: 'boundary',
      boundaryRing: boundary,
      polygons: [],
      cadInstances: [instance],
      cadImages: [],
      savedCads: [],
    });
    expect(result).toEqual([]);
  });
});

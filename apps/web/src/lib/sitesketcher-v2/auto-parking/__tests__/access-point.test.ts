import { snapPointToBoundaryEdge, reprojectAccessAnchor, isAccessAnchorValid } from '../access-point';
import type { LngLat } from '@/lib/parking-layout-lab/types';

const ORIGIN: LngLat = [-1.08, 51.28];
const EARTH_R = 6_378_137;
function m(x: number, y: number): LngLat {
  const cosLat0 = Math.cos((ORIGIN[1] * Math.PI) / 180);
  const lat = ORIGIN[1] + (y / EARTH_R) * (180 / Math.PI);
  const lon = ORIGIN[0] + (x / (EARTH_R * cosLat0)) * (180 / Math.PI);
  return [lon, lat];
}

// Rectangle 0..40 x 0..30.
const boundary: LngLat[] = [m(0, 0), m(40, 0), m(40, 30), m(0, 30), m(0, 0)];

describe('snapPointToBoundaryEdge', () => {
  it('snaps a point near the bottom edge onto that edge', () => {
    const result = snapPointToBoundaryEdge(m(20, 2), boundary);
    expect(result).not.toBeNull();
    expect(result!.edgeIndex).toBe(0); // (0,0)->(40,0)
    expect(result!.distanceAlongEdgeM).toBeCloseTo(20, 1);
    const [lng, lat] = result!.point;
    const [expLng, expLat] = m(20, 0);
    expect(lng).toBeCloseTo(expLng, 6);
    expect(lat).toBeCloseTo(expLat, 6);
  });

  it('snaps a point near the right edge onto that edge', () => {
    const result = snapPointToBoundaryEdge(m(39, 15), boundary);
    expect(result!.edgeIndex).toBe(1); // (40,0)->(40,30)
    expect(result!.distanceAlongEdgeM).toBeCloseTo(15, 1);
  });

  it('is null for a degenerate (single-point) ring', () => {
    expect(snapPointToBoundaryEdge(m(5, 5), [m(0, 0)])).toBeNull();
  });

  it('picks the nearest of two close edges near a corner', () => {
    // Just inside the corner, slightly closer to the bottom edge.
    const result = snapPointToBoundaryEdge(m(1, 0.4), boundary);
    expect(result!.edgeIndex).toBe(0);
  });
});

describe('reprojectAccessAnchor', () => {
  it('reprojects onto the same edge after the boundary is stretched', () => {
    const anchor = { edgeIndex: 0, distanceAlongEdgeM: 20 }; // bottom edge, 20m along
    const stretched: LngLat[] = [m(0, 0), m(80, 0), m(80, 30), m(0, 30), m(0, 0)]; // bottom edge doubled to 80
    const point = reprojectAccessAnchor(anchor, stretched);
    expect(point).not.toBeNull();
    const [lng, lat] = point!;
    const [expLng, expLat] = m(20, 0); // same absolute distance along the (now longer) edge
    expect(lng).toBeCloseTo(expLng, 6);
    expect(lat).toBeCloseTo(expLat, 6);
  });

  it('clamps beyond the edge end when the edge is shortened past the anchor distance', () => {
    const anchor = { edgeIndex: 0, distanceAlongEdgeM: 20 };
    const shortened: LngLat[] = [m(0, 0), m(10, 0), m(10, 30), m(0, 30), m(0, 0)]; // bottom edge now 10m
    const point = reprojectAccessAnchor(anchor, shortened);
    expect(point).not.toBeNull();
    const [lng, lat] = point!;
    const [expLng, expLat] = m(10, 0); // clamped to edge end
    expect(lng).toBeCloseTo(expLng, 6);
    expect(lat).toBeCloseTo(expLat, 6);
  });

  it('returns null when the anchor edge index no longer exists (edge deleted)', () => {
    const anchor = { edgeIndex: 3, distanceAlongEdgeM: 5 };
    const triangle: LngLat[] = [m(0, 0), m(40, 0), m(20, 30), m(0, 0)]; // only 3 edges (0,1,2)
    expect(reprojectAccessAnchor(anchor, triangle)).toBeNull();
  });

  it('is null for a degenerate ring', () => {
    expect(reprojectAccessAnchor({ edgeIndex: 0, distanceAlongEdgeM: 5 }, [m(0, 0)])).toBeNull();
  });
});

describe('isAccessAnchorValid', () => {
  it('is true while the anchor edge index is within range', () => {
    expect(isAccessAnchorValid({ edgeIndex: 1, distanceAlongEdgeM: 5 }, boundary)).toBe(true);
  });

  it('is false once a vertex edit drops the ring below the anchor edge index', () => {
    const triangle: LngLat[] = [m(0, 0), m(40, 0), m(20, 30), m(0, 0)];
    expect(isAccessAnchorValid({ edgeIndex: 3, distanceAlongEdgeM: 5 }, triangle)).toBe(false);
  });
});

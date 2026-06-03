import { calculateCadImageCorners } from '../cad-utils';
import type { CadImage } from '@/types/sitesketcher-v2';

const ANCHOR: [number, number] = [-0.1276, 51.5074];
const METERS_PER_DEGREE_LAT = 110540;

function metersPerDegreeLng(latitude: number): number {
  return 111320 * Math.cos(latitude * Math.PI / 180);
}

function metresBetween(a: [number, number], b: [number, number], anchor = ANCHOR): number {
  const eastMeters = (b[0] - a[0]) * metersPerDegreeLng(anchor[1]);
  const northMeters = (b[1] - a[1]) * METERS_PER_DEGREE_LAT;

  return Math.hypot(eastMeters, northMeters);
}

function makeCad(rotation: number): CadImage {
  return {
    id: 'cad-1',
    fileName: 'site-plan.png',
    url: 'https://example.com/site-plan.png',
    storagePath: 'user/site-plan.png',
    metresPerPixel: 0.5,
    anchor: ANCHOR,
    rotation,
    opacity: 0.8,
    imageWidthPx: 200,
    imageHeightPx: 100,
    createdAt: 1,
    updatedAt: 1,
  };
}

describe('calculateCadImageCorners', () => {
  it('keeps an unrotated CAD at the calibrated real-world dimensions', () => {
    const corners = calculateCadImageCorners(makeCad(0));

    expect(metresBetween(corners[0], corners[1])).toBeCloseTo(100, 8);
    expect(metresBetween(corners[1], corners[2])).toBeCloseTo(50, 8);
    expect(metresBetween(corners[2], corners[3])).toBeCloseTo(100, 8);
    expect(metresBetween(corners[3], corners[0])).toBeCloseTo(50, 8);
  });

  it('rotates a rectangular CAD 90 degrees without stretching it', () => {
    const corners = calculateCadImageCorners(makeCad(90));

    expect(metresBetween(corners[0], corners[1])).toBeCloseTo(100, 8);
    expect(metresBetween(corners[1], corners[2])).toBeCloseTo(50, 8);
    expect(metresBetween(corners[0], corners[1])).toBeGreaterThan(
      metresBetween(corners[1], corners[2])
    );

    const topEdgeLngSpan = Math.abs(corners[1][0] - corners[0][0]);
    const rightEdgeLatSpan = Math.abs(corners[2][1] - corners[1][1]);

    expect(topEdgeLngSpan).toBeLessThan(1e-12);
    expect(rightEdgeLatSpan).toBeLessThan(1e-12);
  });

  it('preserves opposite side lengths for a 45 degree CAD rotation', () => {
    const corners = calculateCadImageCorners(makeCad(45));

    const top = metresBetween(corners[0], corners[1]);
    const right = metresBetween(corners[1], corners[2]);
    const bottom = metresBetween(corners[2], corners[3]);
    const left = metresBetween(corners[3], corners[0]);

    expect(top).toBeCloseTo(100, 8);
    expect(right).toBeCloseTo(50, 8);
    expect(bottom).toBeCloseTo(100, 8);
    expect(left).toBeCloseTo(50, 8);
    expect(top).toBeCloseTo(bottom, 8);
    expect(right).toBeCloseTo(left, 8);
  });
});

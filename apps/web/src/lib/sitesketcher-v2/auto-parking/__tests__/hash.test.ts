import { computeSourceHash, isLayoutStale } from '../hash';
import type { AutoParkingLayout } from '@/types/sitesketcher-v2';
import type { LngLat } from '@/lib/parking-layout-lab/types';
import type { DetectedExclusion } from '../detection';

const boundaryRing: LngLat[] = [
  [-1.08, 51.28],
  [-1.079, 51.28],
  [-1.079, 51.281],
  [-1.08, 51.281],
];

const settings: AutoParkingLayout['settingsSnapshot'] = {
  stallSize: 'standard',
  aisleWidth: 6,
  boundarySetback: 1,
  buildingClearance: 1,
  checkManoeuvring: false,
  oneWay: false,
  gateQueueVehicles: null,
  accessibleBays: { on: false, percent: 5 },
};

const exclusionA: DetectedExclusion = {
  id: 'poly-a',
  kind: 'polygon',
  ring: [
    [-1.0795, 51.2805],
    [-1.0793, 51.2805],
    [-1.0793, 51.2807],
  ],
};
const exclusionB: DetectedExclusion = {
  id: 'cad-b',
  kind: 'cadInstance',
  ring: [
    [-1.0796, 51.2806],
    [-1.0794, 51.2806],
    [-1.0794, 51.2808],
  ],
};

const accessPoint: LngLat = [-1.0795, 51.28];

function baseInput() {
  return {
    boundaryRing,
    exclusions: [exclusionA, exclusionB],
    accessPoint,
    settingsSnapshot: settings,
  };
}

describe('computeSourceHash', () => {
  it('is deterministic for identical inputs', () => {
    expect(computeSourceHash(baseInput())).toBe(computeSourceHash(baseInput()));
  });

  it('is independent of exclusion array order', () => {
    const forward = computeSourceHash(baseInput());
    const reversed = computeSourceHash({ ...baseInput(), exclusions: [exclusionB, exclusionA] });
    expect(forward).toBe(reversed);
  });

  it('changes when a setting changes', () => {
    const a = computeSourceHash(baseInput());
    const b = computeSourceHash({ ...baseInput(), settingsSnapshot: { ...settings, aisleWidth: 7 } });
    expect(a).not.toBe(b);
  });

  it('changes when the exclusion set changes (one removed)', () => {
    const a = computeSourceHash(baseInput());
    const b = computeSourceHash({ ...baseInput(), exclusions: [exclusionA] });
    expect(a).not.toBe(b);
  });

  it('changes when the access point moves', () => {
    const a = computeSourceHash(baseInput());
    const b = computeSourceHash({ ...baseInput(), accessPoint: [-1.0794, 51.28] });
    expect(a).not.toBe(b);
  });

  it('changes when the boundary ring changes', () => {
    const a = computeSourceHash(baseInput());
    const movedBoundary = boundaryRing.map(([lng, lat]) => [lng + 0.001, lat] as LngLat);
    const b = computeSourceHash({ ...baseInput(), boundaryRing: movedBoundary });
    expect(a).not.toBe(b);
  });
});

describe('isLayoutStale', () => {
  it('is false when current inputs reproduce the stored hash', () => {
    const sourceHash = computeSourceHash(baseInput());
    expect(isLayoutStale({ sourceHash }, baseInput())).toBe(false);
  });

  it('is true when current inputs diverge from the stored hash', () => {
    const sourceHash = computeSourceHash(baseInput());
    expect(isLayoutStale({ sourceHash }, { ...baseInput(), exclusions: [exclusionA] })).toBe(true);
  });
});

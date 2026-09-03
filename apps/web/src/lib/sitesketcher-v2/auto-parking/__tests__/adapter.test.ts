import { buildAutoParkingLayout, buildSolverInput, DEFAULT_AUTO_PARKING_ACCESSIBLE_BAY, DEFAULT_AUTO_PARKING_VEHICLE } from '../adapter';
import { computeSourceHash } from '../hash';
import { solveParkingLayout } from '@/lib/parking-layout-lab/solver';
import type { AutoParkingLayout } from '@/types/sitesketcher-v2';
import type { LngLat } from '@/lib/parking-layout-lab/types';
import type { DetectedExclusion } from '../detection';

const ORIGIN: LngLat = [-1.08, 51.28];
const EARTH_R = 6_378_137;
function m(x: number, y: number): LngLat {
  const cosLat0 = Math.cos((ORIGIN[1] * Math.PI) / 180);
  const lat = ORIGIN[1] + (y / EARTH_R) * (180 / Math.PI);
  const lon = ORIGIN[0] + (x / (EARTH_R * cosLat0)) * (180 / Math.PI);
  return [lon, lat];
}

const boundaryRing: LngLat[] = [m(0, 0), m(60, 0), m(60, 40), m(0, 40), m(0, 0)];
const accessPoint: LngLat = m(0, 20);

const baseSettings: AutoParkingLayout['settingsSnapshot'] = {
  stallSize: 'standard',
  aisleWidth: 6,
  boundarySetback: 1,
  buildingClearance: 1,
  checkManoeuvring: false,
  oneWay: false,
  gateQueueVehicles: null,
  accessibleBays: { on: false, percent: 5 },
};

describe('buildSolverInput', () => {
  it('omits vehicle/oneWay/gateQueue/accessible when their toggles are off', () => {
    const input = buildSolverInput({ boundaryRing, exclusions: [], accessPoint, settings: baseSettings });
    expect(input.vehicle).toBeUndefined();
    expect(input.oneWay).toBeUndefined();
    expect(input.gateQueue).toBeUndefined();
    expect(input.accessible).toBeUndefined();
    expect(input.stall).toEqual({ width: 2.4, length: 4.8 });
  });

  it('includes vehicle/oneWay/gateQueue only when checkManoeuvring is on', () => {
    const input = buildSolverInput({
      boundaryRing,
      exclusions: [],
      accessPoint,
      settings: { ...baseSettings, checkManoeuvring: true, oneWay: true, gateQueueVehicles: 2 },
    });
    expect(input.vehicle).toEqual(DEFAULT_AUTO_PARKING_VEHICLE);
    expect(input.oneWay).toBe(true);
    expect(input.gateQueue).toEqual({ vehicles: 2 });
  });

  it('reserves no gate queue when gateQueueVehicles is 0 or null', () => {
    const input = buildSolverInput({
      boundaryRing,
      exclusions: [],
      accessPoint,
      settings: { ...baseSettings, checkManoeuvring: true, gateQueueVehicles: 0 },
    });
    expect(input.gateQueue).toBeNull();
  });

  it('includes accessible only when accessibleBays.on is true, converting percent to a rate', () => {
    const input = buildSolverInput({
      boundaryRing,
      exclusions: [],
      accessPoint,
      settings: { ...baseSettings, accessibleBays: { on: true, percent: 10 } },
    });
    expect(input.accessible).toEqual({ rate: 0.1, bay: DEFAULT_AUTO_PARKING_ACCESSIBLE_BAY });
  });

  it('passes a separate entrance target to accessible placement without changing vehicle access', () => {
    const entrancePoint = m(55, 35);
    const input = buildSolverInput({
      boundaryRing,
      exclusions: [],
      accessPoint,
      entrancePoint,
      settings: { ...baseSettings, accessibleBays: { on: true, percent: 10 } },
    });
    expect(input.accessPoint).toEqual(accessPoint);
    expect(input.accessible?.anchorPoint).toEqual(entrancePoint);
  });

  it('uses larger stall dimensions when selected', () => {
    const input = buildSolverInput({
      boundaryRing,
      exclusions: [],
      accessPoint,
      settings: { ...baseSettings, stallSize: 'larger' },
    });
    expect(input.stall).toEqual({ width: 2.7, length: 5.0 });
  });
});

describe('buildAutoParkingLayout', () => {
  const exclusions: DetectedExclusion[] = [];

  it('produces a layout whose geometry is filtered and whose sourceHash matches a fresh recompute', () => {
    const solverInput = buildSolverInput({ boundaryRing, exclusions, accessPoint, settings: baseSettings });
    const solverOutput = solveParkingLayout(solverInput);
    expect(solverOutput.candidates.length).toBeGreaterThan(0);
    const candidate = solverOutput.candidates[0];

    const layout = buildAutoParkingLayout({
      id: 'layout-1',
      name: 'Auto layout 1',
      boundaryId: 'boundary-1',
      exclusions,
      settingsSnapshot: baseSettings,
      solverInput,
      solverOutput,
      candidate,
      now: 1000,
    });

    expect(layout.geometrySchemaVersion).toBe(1);
    expect(layout.boundaryId).toBe('boundary-1');
    expect(layout.boundarySnapshot).toEqual(solverInput.boundary.ring);
    expect(layout.createdAt).toBe(1000);
    expect(layout.updatedAt).toBe(1000);
    expect(layout.metrics.totalSpaces).toBe(candidate.stallCount);
    expect(layout.metrics.rows).toBe(candidate.rows.length);
    expect(layout.metrics.standard + layout.metrics.accessible).toBe(candidate.stallCount);
    expect(layout.warnings).toEqual(candidate.warnings);

    // Every retained feature is layout-only, and none leak the raw boundary.
    const featureTypes = new Set(layout.geometry.features.map((f) => (f.properties as any).featureType));
    expect(featureTypes.has('site-boundary')).toBe(false);
    expect(Array.from(featureTypes).every((t) => ['parking-stall', 'drive-aisle', 'access-corridor', 'access-point'].includes(t as string))).toBe(true);

    const recomputed = computeSourceHash({
      boundaryRing: solverInput.boundary.ring,
      exclusions,
      accessPoint: solverOutput.snappedAccessPoint,
      settingsSnapshot: baseSettings,
    });
    expect(layout.sourceHash).toBe(recomputed);
  });

  it('maps exclusion refs to just id + kind (no geometry duplicated in the persisted ref)', () => {
    const exclusion: DetectedExclusion = { id: 'poly-x', kind: 'polygon', ring: [m(5, 5), m(6, 5), m(6, 6)] };
    const solverInput = buildSolverInput({
      boundaryRing,
      exclusions: [exclusion],
      accessPoint,
      settings: baseSettings,
    });
    const solverOutput = solveParkingLayout(solverInput);
    const candidate = solverOutput.candidates[0];

    const layout = buildAutoParkingLayout({
      id: 'layout-2',
      name: 'Auto layout 2',
      boundaryId: 'boundary-1',
      exclusions: [exclusion],
      settingsSnapshot: baseSettings,
      solverInput,
      solverOutput,
      candidate,
    });

    expect(layout.exclusionRefs).toEqual([{ id: 'poly-x', kind: 'polygon' }]);
  });

  it('persists building provenance and the entrance used for accessible placement', () => {
    const entrance = { kind: 'target' as const, point: m(50, 35) };
    const enabledSettings = { ...baseSettings, accessibleBays: { on: true, percent: 5 } };
    const exclusion: DetectedExclusion = {
      id: 'poly-x', kind: 'polygon', source: 'drawn', ring: [m(5, 5), m(6, 5), m(6, 6)],
    };
    const solverInput = buildSolverInput({
      boundaryRing,
      exclusions: [exclusion],
      accessPoint,
      entrancePoint: entrance.point,
      settings: enabledSettings,
    });
    const solverOutput = solveParkingLayout(solverInput);
    const layout = buildAutoParkingLayout({
      id: 'layout-3', name: 'Auto layout 3', boundaryId: 'boundary-1', exclusions: [exclusion],
      entrance, entrancePoint: entrance.point, settingsSnapshot: enabledSettings, solverInput, solverOutput,
      candidate: solverOutput.candidates[0],
    });
    expect(layout.exclusionRefs).toEqual([{ id: 'poly-x', kind: 'polygon', source: 'drawn' }]);
    expect(layout.entrance).toEqual(entrance);
    expect(layout.sourceHash.startsWith('v2-')).toBe(true);
  });
});

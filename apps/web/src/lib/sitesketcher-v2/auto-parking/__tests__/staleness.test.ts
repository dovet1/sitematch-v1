import { computeSourceHash } from '../hash';
import { deriveAutoLayoutStale } from '../staleness';
import type { AutoParkingLayout, Polygon } from '@/types/sitesketcher-v2';

function polygon(id: string, x: number): Polygon {
  return {
    id,
    name: id,
    colorIndex: 0,
    points: [[x, 0], [x + 1, 0], [x + 1, 1], [x, 1], [x, 0]],
    rotation: 0,
    height: 0,
    showDistances: false,
    showArea: false,
    createdAt: 1,
    updatedAt: 1,
  };
}

describe('guided auto-layout staleness', () => {
  const boundary = {
    ...polygon('boundary', 0),
    points: [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]] as [number, number][],
  };
  const selected = polygon('selected', 2);
  const unselected = polygon('unselected', 5);
  const entrance = { kind: 'building' as const, buildingId: selected.id, edgeIndex: 0, distanceAlongEdgeM: 0 };
  const entrancePoint: [number, number] = selected.points[0];
  const settings: AutoParkingLayout['settingsSnapshot'] = {
    stallSize: 'standard', aisleWidth: 6, boundarySetback: 3, buildingClearance: 1,
    checkManoeuvring: false, oneWay: false, gateQueueVehicles: null,
    accessibleBays: { on: true, percent: 6 },
  };
  const exclusion = { id: selected.id, kind: 'polygon' as const, source: 'selected' as const, ring: selected.points };
  const sourceHash = computeSourceHash({
    boundaryRing: boundary.points,
    exclusions: [exclusion],
    accessPoint: [5, 0],
    entrance: { anchor: entrance, point: entrancePoint },
    settingsSnapshot: settings,
  });
  const layout: AutoParkingLayout = {
    id: 'layout', name: 'Layout', geometrySchemaVersion: 1, boundaryId: boundary.id,
    exclusionRefs: [{ id: selected.id, kind: 'polygon', source: 'selected' }],
    accessPoint: [5, 0], entrance, settingsSnapshot: settings,
    geometry: { type: 'FeatureCollection', features: [] },
    metrics: { totalSpaces: 0, standard: 0, accessible: 0, rows: 0, footprintSqm: 0 },
    warnings: [], sourceHash, createdAt: 1, updatedAt: 1,
  };
  const scene = (polygons: Polygon[]) => ({ polygons, cadInstances: [], cadImages: [], savedCads: [] });

  it('ignores unselected polygon changes', () => {
    expect(deriveAutoLayoutStale(layout, scene([boundary, selected, unselected]))).toBe(false);
    const movedUnselected = { ...unselected, points: unselected.points.map(([x, y]) => [x + 1, y] as [number, number]) };
    expect(deriveAutoLayoutStale(layout, scene([boundary, selected, movedUnselected]))).toBe(false);
  });

  it('becomes stale when a selected building changes or is deleted', () => {
    const movedSelected = { ...selected, points: selected.points.map(([x, y]) => [x, y + 0.25] as [number, number]) };
    expect(deriveAutoLayoutStale(layout, scene([boundary, movedSelected, unselected]))).toBe(true);
    expect(deriveAutoLayoutStale(layout, scene([boundary, unselected]))).toBe(true);
  });
});

import { useSketchStore } from '../state-manager';
import type { AutoParkingLayout, ParkingBlock, Polygon, SavedCad } from '@/types/sitesketcher-v2';

const savedCad: SavedCad = {
  id: 'saved-cad-1',
  userId: 'user-1',
  name: 'Site plan',
  fileName: 'site-plan.png',
  url: 'https://example.com/site-plan.png',
  storagePath: 'user-1/site-plan.png',
  metresPerPixel: 0.1,
  imageWidthPx: 100,
  imageHeightPx: 100,
  createdAt: '2026-05-29T00:00:00.000Z',
  updatedAt: '2026-05-29T00:00:00.000Z',
};

const polygon: Polygon = {
  id: 'polygon-1',
  name: 'Plot A',
  colorIndex: 0,
  points: [
    [0, 0],
    [1, 0],
    [1, 1],
    [0, 1],
  ],
  rotation: 0,
  height: 10,
  showDistances: true,
  showArea: true,
  createdAt: 1,
  updatedAt: 1,
};

const parkingBlock: ParkingBlock = {
  id: 'parking-1',
  name: 'Parking A',
  spaces: 10,
  layout: 'single',
  stallSize: 'standard',
  anchor: [0, 0],
  rotation: 0,
  createdAt: 1,
  updatedAt: 1,
};

const mapInstance = {
  project: ([lng, lat]: [number, number]) => ({ x: lng * 1000, y: lat * 1000 }),
  unproject: ({ x, y }: { x: number; y: number }) => ({ lng: x / 1000, lat: y / 1000 }),
} as any;

describe('SiteSketcher v2 CAD placement state', () => {
  beforeEach(() => {
    useSketchStore.getState().reset();
    useSketchStore.setState({
      savedCads: [savedCad],
      cadInstances: [],
      activeTool: 'select',
      activePanel: null,
      selectedId: null,
      selectedType: null,
      cadPlacementInProgress: null,
    });
  });

  it('keeps the CAD panel open while placing and opens the instance inspector after placement', () => {
    useSketchStore.getState().startCadPlacement(savedCad.id);

    expect(useSketchStore.getState().activeTool).toBe('cad');
    expect(useSketchStore.getState().activePanel).toBeNull();
    expect(useSketchStore.getState().cadPlacementInProgress).toEqual({ savedCadId: savedCad.id });
    expect(useSketchStore.getState().selectedId).toBeNull();

    useSketchStore.getState().placeCadInstance(savedCad.id, [-0.1, 51.5]);

    const state = useSketchStore.getState();
    expect(state.activeTool).toBe('select');
    expect(state.activePanel).toBeNull();
    expect(state.cadPlacementInProgress).toBeNull();
    expect(state.selectedType).toBe('cad');
    expect(state.selectedId).toBe(state.cadInstances[0].id);
  });
});

describe('SiteSketcher v2 history selection reconciliation', () => {
  beforeEach(() => {
    useSketchStore.getState().reset();
    useSketchStore.setState({
      polygons: [],
      parkingBlocks: [],
      history: [],
      historyIndex: -1,
      selectedId: null,
      selectedType: null,
    });
  });

  it('clears selected polygon when undo restores a state without that polygon', () => {
    const store = useSketchStore.getState();

    store.pushHistory();
    useSketchStore.setState({
      polygons: [JSON.parse(JSON.stringify(polygon))],
      selectedId: polygon.id,
      selectedType: 'polygon',
    });
    useSketchStore.getState().pushHistory();

    useSketchStore.getState().undo();

    const state = useSketchStore.getState();
    expect(state.polygons).toHaveLength(0);
    expect(state.selectedId).toBeNull();
    expect(state.selectedType).toBeNull();
  });

  it('keeps selected polygon when undo restores a state where that polygon still exists', () => {
    useSketchStore.setState({
      polygons: [JSON.parse(JSON.stringify(polygon))],
      selectedId: polygon.id,
      selectedType: 'polygon',
    });
    useSketchStore.getState().pushHistory();
    useSketchStore.getState().updatePolygon(polygon.id, { height: 25 });

    useSketchStore.getState().undo();

    const state = useSketchStore.getState();
    expect(state.polygons).toHaveLength(1);
    expect(state.polygons[0].height).toBe(10);
    expect(state.selectedId).toBe(polygon.id);
    expect(state.selectedType).toBe('polygon');
  });

  it('clears selected parking block when undo restores a state without that parking block', () => {
    const store = useSketchStore.getState();

    store.pushHistory();
    useSketchStore.setState({
      parkingBlocks: [JSON.parse(JSON.stringify(parkingBlock))],
      selectedId: parkingBlock.id,
      selectedType: 'parking',
    });
    useSketchStore.getState().pushHistory();

    useSketchStore.getState().undo();

    const state = useSketchStore.getState();
    expect(state.parkingBlocks).toHaveLength(0);
    expect(state.selectedId).toBeNull();
    expect(state.selectedType).toBeNull();
  });
});

describe('SiteSketcher v2 polygon rotation history', () => {
  beforeEach(() => {
    useSketchStore.getState().reset();
    useSketchStore.setState({
      mapInstance,
      polygons: [JSON.parse(JSON.stringify(polygon))],
      parkingBlocks: [],
      history: [],
      historyIndex: -1,
    });
    useSketchStore.getState().pushHistory();
  });

  it('undoes and redoes a batched polygon rotation as one history step', () => {
    const store = useSketchStore.getState();
    const originalPoints = JSON.parse(JSON.stringify(polygon.points));

    store.pushHistory();
    store.rotatePolygon(polygon.id, 30, { recordHistory: false });
    store.rotatePolygon(polygon.id, 90, { recordHistory: false });
    store.pushHistory();

    const rotatedState = useSketchStore.getState();
    const rotatedPolygon = rotatedState.polygons[0];
    const rotatedPoints = JSON.parse(JSON.stringify(rotatedPolygon.points));

    expect(rotatedPolygon.rotation).toBe(90);
    expect(rotatedPoints).not.toEqual(originalPoints);
    expect(rotatedState.history).toHaveLength(3);

    useSketchStore.getState().undo();

    const undonePolygon = useSketchStore.getState().polygons[0];
    expect(undonePolygon.rotation).toBe(0);
    expect(undonePolygon.points).toEqual(originalPoints);

    useSketchStore.getState().redo();

    const redonePolygon = useSketchStore.getState().polygons[0];
    expect(redonePolygon.rotation).toBe(90);
    expect(redonePolygon.points).toEqual(rotatedPoints);
  });

  it('does not add history for a no-op rotation', () => {
    const historyLength = useSketchStore.getState().history.length;

    useSketchStore.getState().rotatePolygon(polygon.id, polygon.rotation);

    expect(useSketchStore.getState().history).toHaveLength(historyLength);
  });

  it('undoes and redoes a batched polygon height change as one history step', () => {
    const store = useSketchStore.getState();

    store.pushHistory();
    store.updatePolygon(polygon.id, { height: 25 }, { recordHistory: false });
    store.updatePolygon(polygon.id, { height: 50 }, { recordHistory: false });
    store.pushHistory();

    const raisedState = useSketchStore.getState();
    expect(raisedState.polygons[0].height).toBe(50);
    expect(raisedState.history).toHaveLength(3);

    useSketchStore.getState().undo();

    expect(useSketchStore.getState().polygons[0].height).toBe(10);

    useSketchStore.getState().redo();

    expect(useSketchStore.getState().polygons[0].height).toBe(50);
  });

  it('does not add history for a no-op batched height change', () => {
    const historyLength = useSketchStore.getState().history.length;

    useSketchStore.getState().updatePolygon(
      polygon.id,
      { height: polygon.height },
      { recordHistory: false }
    );

    expect(useSketchStore.getState().history).toHaveLength(historyLength);
  });
});

const autoLayout: AutoParkingLayout = {
  id: 'auto-layout-1',
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
  metrics: { totalSpaces: 10, standard: 10, accessible: 0, rows: 2, footprintSqm: 100 },
  warnings: [],
  sourceHash: 'v1-deadbeef',
  createdAt: 1,
  updatedAt: 1,
};

describe('SiteSketcher v2 auto parking — parkingMethod persistence', () => {
  beforeEach(() => {
    useSketchStore.getState().reset();
  });

  it('defaults to manual and round-trips through getSketchData', () => {
    expect(useSketchStore.getState().parkingMethod).toBe('manual');
    expect(useSketchStore.getState().getSketchData().settings.parkingMethod).toBe('manual');
  });

  it('setParkingMethod persists into getSketchData', () => {
    useSketchStore.getState().setParkingMethod('auto');
    expect(useSketchStore.getState().getSketchData().settings.parkingMethod).toBe('auto');
  });

  it('loadSketch restores a stored parkingMethod, defaulting to manual when absent', () => {
    useSketchStore.getState().loadSketch({
      id: 's1',
      name: 'Sketch',
      updated_at: '2026-01-01T00:00:00.000Z',
      data: { version: 2, polygons: [], parkingBlocks: [], cadInstances: [], viewport: {}, settings: { parkingMethod: 'auto' } },
    });
    expect(useSketchStore.getState().parkingMethod).toBe('auto');

    useSketchStore.getState().loadSketch({
      id: 's2',
      name: 'Older sketch',
      updated_at: '2026-01-01T00:00:00.000Z',
      data: { version: 2, polygons: [], parkingBlocks: [], cadInstances: [], viewport: {}, settings: {} },
    });
    expect(useSketchStore.getState().parkingMethod).toBe('manual');
  });

  it('switching to auto always starts a fresh guided boundary draw, never auto-selecting an existing polygon', () => {
    useSketchStore.getState().setParkingMethod('auto');
    const state = useSketchStore.getState();
    expect(state.autoParkingDraft.phase).toBe('boundary');
    expect(state.autoParkingDraft.boundaryId).toBeNull();
  });

  it('switching to manual resets the auto draft and clears any generation state', () => {
    useSketchStore.getState().setParkingMethod('auto');
    useSketchStore.getState().setAutoParkingBoundary('polygon-1');
    useSketchStore.getState().setAutoParkingCandidates([], { input: {} as any, output: {} as any });

    useSketchStore.getState().setParkingMethod('manual');

    const state = useSketchStore.getState();
    expect(state.autoParkingDraft.boundaryId).toBeNull();
    expect(state.autoParkingDraft.phase).toBe('boundary');
    expect(state.autoParkingCandidates).toEqual([]);
    expect(state.autoParkingSolverRun).toBeNull();
  });

  it('setAutoParkingBoundary advances to buildings and clears prior guided inputs / candidates', () => {
    useSketchStore.getState().commitAutoParkingAccessAnchor({ edgeIndex: 0, distanceAlongEdgeM: 1 });
    useSketchStore.getState().setAutoParkingCandidates([], { input: {} as any, output: {} as any });

    useSketchStore.getState().setAutoParkingBoundary('polygon-1');

    const state = useSketchStore.getState();
    expect(state.autoParkingDraft.boundaryId).toBe('polygon-1');
    expect(state.autoParkingDraft.phase).toBe('buildings');
    expect(state.autoParkingDraft.buildingRefs).toEqual([]);
    expect(state.autoParkingDraft.entrance).toBeNull();
    expect(state.autoParkingDraft.accessAnchor).toBeNull();
    expect(state.autoParkingSolverRun).toBeNull();
  });

  it('commitAutoParkingAccessAnchor advances phase from access to ready', () => {
    useSketchStore.getState().setAutoParkingBoundary('polygon-1');
    useSketchStore.getState().continueAutoParkingBuildings();
    useSketchStore.getState().commitAutoParkingEntrance({ kind: 'target', point: [0.5, 0.5] });
    useSketchStore.getState().commitAutoParkingAccessAnchor({ edgeIndex: 0, distanceAlongEdgeM: 5 });

    const state = useSketchStore.getState();
    expect(state.autoParkingDraft.phase).toBe('ready');
    expect(state.autoParkingDraft.accessAnchor).toEqual({ edgeIndex: 0, distanceAlongEdgeM: 5 });
  });

  it('boundary-edit: commit checks access-anchor validity and restores phaseBeforeEdit', () => {
    useSketchStore.getState().setPolygons([polygon]);
    useSketchStore.getState().setAutoParkingBoundary('polygon-1');
    useSketchStore.getState().continueAutoParkingBuildings();
    useSketchStore.getState().commitAutoParkingEntrance({ kind: 'target', point: [0.5, 0.5] });
    useSketchStore.getState().commitAutoParkingAccessAnchor({ edgeIndex: 0, distanceAlongEdgeM: 5 });
    expect(useSketchStore.getState().autoParkingDraft.phase).toBe('ready');

    useSketchStore.getState().startAutoParkingBoundaryEdit();
    expect(useSketchStore.getState().autoParkingDraft.phase).toBe('boundary-edit');
    expect(useSketchStore.getState().autoParkingDraft.boundarySnapshot).not.toBeNull();

    useSketchStore.getState().commitAutoParkingBoundaryEdit();
    const state = useSketchStore.getState();
    expect(state.autoParkingDraft.phase).toBe('ready');
    expect(state.autoParkingDraft.boundarySnapshot).toBeNull();
  });

  it('boundary-edit: cancel restores the pre-edit boundary geometry', () => {
    useSketchStore.getState().setPolygons([polygon]);
    useSketchStore.getState().setAutoParkingBoundary('polygon-1');
    useSketchStore.getState().startAutoParkingBoundaryEdit();
    useSketchStore.getState().updatePolygon('polygon-1', { points: [[0, 0], [20, 0], [20, 20], [0, 20]] });

    useSketchStore.getState().cancelAutoParkingBoundaryEdit();

    const state = useSketchStore.getState();
    expect(state.polygons[0].points).toEqual(polygon.points);
    expect(state.autoParkingDraft.phase).toBe('buildings');
  });

  it('supports the optional buildings step and persists drawn/selected provenance in the draft', () => {
    useSketchStore.getState().setPolygons([polygon]);
    useSketchStore.getState().setAutoParkingBoundary('boundary-1');
    useSketchStore.getState().toggleAutoParkingBuilding('polygon-1', 'drawn');
    expect(useSketchStore.getState().autoParkingDraft.buildingRefs).toEqual([
      { id: 'polygon-1', kind: 'polygon', source: 'drawn' },
    ]);
    useSketchStore.getState().continueAutoParkingBuildings();
    expect(useSketchStore.getState().autoParkingDraft.phase).toBe('entrance');
  });

  it('unmarking an entrance building clears the entrance but leaves the polygon intact', () => {
    useSketchStore.getState().setPolygons([polygon]);
    useSketchStore.getState().setAutoParkingBoundary('boundary-1');
    useSketchStore.getState().toggleAutoParkingBuilding('polygon-1', 'selected');
    useSketchStore.getState().continueAutoParkingBuildings();
    useSketchStore.getState().commitAutoParkingEntrance({
      kind: 'building', buildingId: 'polygon-1', edgeIndex: 0, distanceAlongEdgeM: 2,
    });
    useSketchStore.getState().startAutoParkingBuildingsEdit();
    useSketchStore.getState().toggleAutoParkingBuilding('polygon-1', 'selected');
    expect(useSketchStore.getState().autoParkingDraft.entrance).toBeNull();
    expect(useSketchStore.getState().polygons).toEqual([polygon]);
  });

  it('finishPolygonDrawing while in auto mode makes the new plot the boundary and returns to the Parking tool', () => {
    useSketchStore.getState().setParkingMethod('auto');
    useSketchStore.getState().startPolygonDrawing(0);
    useSketchStore.getState().addPointToPolygon([0, 0]);
    useSketchStore.getState().addPointToPolygon([1, 0]);
    useSketchStore.getState().addPointToPolygon([1, 1]);

    const created = useSketchStore.getState().finishPolygonDrawing();

    expect(created).not.toBeNull();
    const state = useSketchStore.getState();
    expect(state.autoParkingDraft.boundaryId).toBe(created!.id);
    expect(state.activeTool).toBe('parking');
    expect(created!.height).toBe(0);
  });
});

describe('SiteSketcher v2 auto parking — applied layout CRUD + selection', () => {
  beforeEach(() => {
    useSketchStore.getState().reset();
  });

  it('addAutoLayout serializes into getSketchData and round-trips via loadSketch', () => {
    useSketchStore.getState().addAutoLayout(autoLayout);
    expect(useSketchStore.getState().getSketchData().autoLayouts).toEqual([autoLayout]);

    useSketchStore.setState({ effectiveAccess: { ...useSketchStore.getState().effectiveAccess, hasPlusAccess: true } });
    useSketchStore.getState().loadSketch({
      id: 's1',
      name: 'Sketch',
      updated_at: '2026-01-01T00:00:00.000Z',
      data: { version: 2, polygons: [], parkingBlocks: [], cadInstances: [], autoLayouts: [autoLayout], viewport: {}, settings: {} },
    });
    expect(useSketchStore.getState().autoLayouts).toEqual([autoLayout]);
  });

  it('an old sketch without autoLayouts loads with an empty array, not a crash', () => {
    expect(() =>
      useSketchStore.getState().loadSketch({
        id: 's-old',
        name: 'Old sketch',
        updated_at: '2026-01-01T00:00:00.000Z',
        data: { version: 2, polygons: [], parkingBlocks: [], cadInstances: [], viewport: {}, settings: {} },
      })
    ).not.toThrow();
    expect(useSketchStore.getState().autoLayouts).toEqual([]);
  });

  it('legacy regenerate pauses at entrance and keeps the one-shot generation pending', () => {
    useSketchStore.getState().setPolygons([polygon]);
    useSketchStore.getState().enterAutoParkingEditor(autoLayout);
    expect(useSketchStore.getState().autoParkingDraft.phase).toBe('entrance');
    expect(useSketchStore.getState().autoParkingDraft.pendingAutoGenerate).toBe(true);

    useSketchStore.getState().commitAutoParkingEntrance({ kind: 'target', point: [0.5, 0.5] });
    expect(useSketchStore.getState().autoParkingDraft.phase).toBe('ready');
    expect(useSketchStore.getState().autoParkingDraft.pendingAutoGenerate).toBe(true);
  });

  it('deleteAutoLayout removes it and clears its selection', () => {
    useSketchStore.getState().addAutoLayout(autoLayout);
    useSketchStore.getState().setSelectedAutoLayoutId(autoLayout.id);

    useSketchStore.getState().deleteAutoLayout(autoLayout.id);

    const state = useSketchStore.getState();
    expect(state.autoLayouts).toEqual([]);
    expect(state.selectedAutoLayoutId).toBeNull();
  });

  it('selecting an auto layout clears polygon/parking/cad selection, and vice versa', () => {
    useSketchStore.getState().setSelectedId('polygon-1', 'polygon');
    useSketchStore.getState().setSelectedAutoLayoutId(autoLayout.id);
    expect(useSketchStore.getState().selectedId).toBeNull();
    expect(useSketchStore.getState().selectedType).toBeNull();
    expect(useSketchStore.getState().selectedAutoLayoutId).toBe(autoLayout.id);

    useSketchStore.getState().setSelectedId('polygon-1', 'polygon');
    expect(useSketchStore.getState().selectedAutoLayoutId).toBeNull();
    expect(useSketchStore.getState().selectedId).toBe('polygon-1');
  });
});

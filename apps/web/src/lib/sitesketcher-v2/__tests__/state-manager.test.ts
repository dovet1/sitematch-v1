import { useSketchStore } from '../state-manager';
import type { ParkingBlock, Polygon, SavedCad } from '@/types/sitesketcher-v2';

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

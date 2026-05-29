import { useSketchStore } from '../state-manager';
import type { SavedCad } from '@/types/sitesketcher-v2';

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

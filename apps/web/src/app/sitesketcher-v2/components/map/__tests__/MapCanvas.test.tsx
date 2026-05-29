import { act, render, waitFor } from '@testing-library/react';
import { MapCanvas } from '../MapCanvas';
import {
  addCadImageToMap,
  initializeMap,
  removeCadImageFromMap,
} from '@/lib/sitesketcher-v2/mapbox-integration';
import type { CadImage } from '@/types/sitesketcher-v2';

let mockState: any;
const mockActions = {
  setViewport: jest.fn(),
  addPolygon: jest.fn(),
  addParkingBlock: jest.fn(),
  updatePolygon: jest.fn(),
  deletePolygon: jest.fn(),
  setSelectedId: jest.fn(),
  pushHistory: jest.fn(),
  moveCadImage: jest.fn(),
  placeCadImage: jest.fn(),
  cancelCadPlacement: jest.fn(),
  setMapInstance: jest.fn(),
  startMeasurement: jest.fn(),
  addMeasurementPoint: jest.fn(),
};

jest.mock('@/lib/sitesketcher-v2/state-manager', () => ({
  useSketchStore: Object.assign(jest.fn(() => mockState), {
    getState: jest.fn(() => mockState),
  }),
}));

jest.mock('@/lib/sitesketcher-v2/constants', () => ({
  MAPBOX_TOKEN: 'test-mapbox-token',
  MAP_STYLES: {
    satellite: 'satellite-style',
    hybrid: 'hybrid-style',
    streets: 'streets-style',
  },
}));

jest.mock('mapbox-gl', () => ({
  __esModule: true,
  default: {
    LngLatBounds: jest.fn(),
  },
}));

jest.mock('@mapbox/mapbox-gl-draw', () => ({
  __esModule: true,
  default: {
    modes: {},
  },
}));

jest.mock('../PolygonLabels', () => ({
  PolygonLabels: () => null,
}));

jest.mock('../MeasurementOverlay', () => ({
  MeasurementOverlay: () => null,
}));

jest.mock('../PolygonDrawPreviewOverlay', () => ({
  PolygonDrawPreviewOverlay: () => null,
}));

jest.mock('@/lib/sitesketcher-v2/mapbox-integration', () => ({
  initializeMap: jest.fn(),
  setupMapboxDraw: jest.fn(() => ({
    changeMode: jest.fn(),
  })),
  setup3DLayer: jest.fn(),
  setupParkingLayer: jest.fn(),
  toggle3DLayer: jest.fn(),
  syncDrawTo3D: jest.fn(),
  syncParkingToMap: jest.fn(),
  syncPolygonsTo3D: jest.fn(),
  loadPolygonsIntoDraw: jest.fn(),
  enterPolygonDrawMode: jest.fn(),
  drawFeatureToPolygon: jest.fn(),
  updateCadImageOnMap: jest.fn(),
  addCadImageToMap: jest.fn((map, cadImage) => {
    map.addSource(`cad-image-${cadImage.id}`, {});
    map.addLayer({ id: `cad-layer-${cadImage.id}` });
  }),
  removeCadImageFromMap: jest.fn((map, cadImageId) => {
    map.removeLayer(`cad-layer-${cadImageId}`);
    map.removeSource(`cad-image-${cadImageId}`);
  }),
}));

type FakeMap = ReturnType<typeof createFakeMap>;

function createFakeMap() {
  const sources = new Set<string>();
  const layers = new Set<string>();
  const eventHandlers = new Map<string, Array<(...args: any[]) => void>>();
  const onceHandlers = new Map<string, Array<(...args: any[]) => void>>();

  return {
    on: jest.fn((event: string, layerOrHandler: string | ((...args: any[]) => void), handler?: (...args: any[]) => void) => {
      if (typeof layerOrHandler === 'function') {
        eventHandlers.set(event, [...(eventHandlers.get(event) || []), layerOrHandler]);
      }
      return undefined;
    }),
    once: jest.fn((event: string, handler: (...args: any[]) => void) => {
      onceHandlers.set(event, [...(onceHandlers.get(event) || []), handler]);
    }),
    off: jest.fn(),
    emit(event: string, payload?: any) {
      eventHandlers.get(event)?.forEach((handler) => handler(payload));
    },
    emitOnce(event: string, payload?: any) {
      const handlers = onceHandlers.get(event) || [];
      onceHandlers.delete(event);
      handlers.forEach((handler) => handler(payload));
    },
    addSource: jest.fn((id: string) => {
      sources.add(id);
    }),
    addLayer: jest.fn((layer: { id: string }) => {
      layers.add(layer.id);
    }),
    removeLayer: jest.fn((id: string) => {
      layers.delete(id);
    }),
    removeSource: jest.fn((id: string) => {
      sources.delete(id);
    }),
    getLayer: jest.fn((id: string) => layers.has(id) ? { id } : undefined),
    getSource: jest.fn((id: string) => sources.has(id) ? { id } : undefined),
    getStyle: jest.fn(() => ({
      layers: Array.from(layers).map((id) => ({ id })),
    })),
    setStyle: jest.fn(() => {
      sources.clear();
      layers.clear();
    }),
    getCanvas: jest.fn(() => ({ style: { cursor: '' } })),
    dragPan: {
      disable: jest.fn(),
      enable: jest.fn(),
    },
    getCenter: jest.fn(() => ({ lng: -0.1276, lat: 51.5074 })),
    getZoom: jest.fn(() => 12),
    getPitch: jest.fn(() => 0),
    getBearing: jest.fn(() => 0),
    resize: jest.fn(),
    remove: jest.fn(),
    easeTo: jest.fn(),
    flyTo: jest.fn(),
    fitBounds: jest.fn(),
    queryRenderedFeatures: jest.fn(() => []),
    project: jest.fn(([lng, lat]: [number, number]) => ({
      x: (lng + 1) * 100000,
      y: (lat - 50) * 100000,
    })),
  };
}

const sampleCadImage: CadImage = {
  id: 'cad-1',
  fileName: 'site-plan.png',
  url: 'https://example.com/site-plan.png',
  storagePath: 'user/site-plan.png',
  metresPerPixel: 0.1,
  anchor: [-0.1276, 51.5074],
  rotation: 0,
  opacity: 0.8,
  imageWidthPx: 100,
  imageHeightPx: 100,
  createdAt: 1,
  updatedAt: 1,
};

function setMockState(updates: Record<string, any> = {}) {
  mockState = {
    view: '2d',
    mapStyle: 'hybrid',
    viewport: {
      center: [-0.1276, 51.5074],
      zoom: 12,
      pitch: 0,
      bearing: 0,
    },
    polygons: [],
    parkingBlocks: [],
    cadImages: [],
    selectedId: null,
    selectedType: null,
    mapFocusRequest: null,
    activeTool: 'select',
    selectedPolygonColorIndex: 0,
    measurementInProgress: null,
    frozenMeasurement: null,
    cadPlacementInProgress: null,
    parkingPlacement: {
      spaces: 10,
      layout: 'single',
      stallSize: 'standard',
    },
    ...mockActions,
    ...updates,
  };
}

describe('MapCanvas CAD layer handlers', () => {
  let fakeMap: FakeMap;

  beforeEach(() => {
    jest.clearAllMocks();
    fakeMap = createFakeMap();
    (initializeMap as jest.Mock).mockReturnValue(fakeMap);
    setMockState();
  });

  it('registers CAD layer handlers immediately after adding a placed CAD layer', async () => {
    const { rerender } = render(<MapCanvas />);

    act(() => {
      fakeMap.emit('load');
    });

    act(() => {
      setMockState({ cadImages: [sampleCadImage] });
    });
    rerender(<MapCanvas />);

    await waitFor(() => {
      expect(addCadImageToMap).toHaveBeenCalledWith(fakeMap, sampleCadImage);
      expect(fakeMap.on).toHaveBeenCalledWith('mousedown', 'cad-layer-cad-1', expect.any(Function));
      expect(fakeMap.on).toHaveBeenCalledWith('mouseenter', 'cad-layer-cad-1', expect.any(Function));
      expect(fakeMap.on).toHaveBeenCalledWith('mouseleave', 'cad-layer-cad-1', expect.any(Function));
    });
  });

  it('selects CAD from a layer mousedown even when raster events have no features', async () => {
    const { rerender } = render(<MapCanvas />);

    act(() => {
      fakeMap.emit('load');
    });

    act(() => {
      setMockState({ cadImages: [sampleCadImage] });
    });
    rerender(<MapCanvas />);

    await waitFor(() => {
      expect(fakeMap.on).toHaveBeenCalledWith('mousedown', 'cad-layer-cad-1', expect.any(Function));
    });

    const layerMouseDown = fakeMap.on.mock.calls.find(
      ([event, layer]) => event === 'mousedown' && layer === 'cad-layer-cad-1'
    )?.[2];

    act(() => {
      layerMouseDown?.({
        features: [],
        preventDefault: jest.fn(),
      });
    });

    expect(fakeMap.dragPan.disable).toHaveBeenCalled();
    expect(mockActions.setSelectedId).toHaveBeenCalledWith('cad-1', 'cad');

    act(() => {
      fakeMap.emit('click', {
        point: { x: 0, y: 0 },
        lngLat: { lng: 0, lat: 0 },
      });
    });

    expect(mockActions.setSelectedId).not.toHaveBeenCalledWith(null, null);
  });

  it('selects CAD from map mousedown using projected CAD geometry', async () => {
    const { rerender } = render(<MapCanvas />);

    act(() => {
      fakeMap.emit('load');
    });

    act(() => {
      setMockState({ cadImages: [sampleCadImage] });
    });
    rerender(<MapCanvas />);

    const projectedAnchor = fakeMap.project(sampleCadImage.anchor!);

    act(() => {
      fakeMap.emit('mousedown', {
        point: projectedAnchor,
        lngLat: { lng: sampleCadImage.anchor![0], lat: sampleCadImage.anchor![1] },
        preventDefault: jest.fn(),
      });
    });

    expect(fakeMap.dragPan.disable).toHaveBeenCalled();
    expect(mockActions.setSelectedId).toHaveBeenCalledWith('cad-1', 'cad');
  });

  it('unregisters CAD handlers before removing an unplaced CAD layer', async () => {
    const { rerender } = render(<MapCanvas />);

    act(() => {
      fakeMap.emit('load');
    });

    act(() => {
      setMockState({ cadImages: [sampleCadImage] });
    });
    rerender(<MapCanvas />);

    await waitFor(() => {
      expect(fakeMap.on).toHaveBeenCalledWith('mousedown', 'cad-layer-cad-1', expect.any(Function));
    });

    act(() => {
      setMockState({ cadImages: [{ ...sampleCadImage, anchor: null }] });
    });
    rerender(<MapCanvas />);

    await waitFor(() => {
      expect(fakeMap.off).toHaveBeenCalledWith('mousedown', 'cad-layer-cad-1', expect.any(Function));
      expect(fakeMap.off).toHaveBeenCalledWith('mouseenter', 'cad-layer-cad-1', expect.any(Function));
      expect(fakeMap.off).toHaveBeenCalledWith('mouseleave', 'cad-layer-cad-1', expect.any(Function));
      expect(removeCadImageFromMap).toHaveBeenCalledWith(fakeMap, 'cad-1');
    });
  });

  it('re-registers CAD layer handlers after a style reload recreates CAD layers', async () => {
    const { rerender } = render(<MapCanvas />);

    act(() => {
      fakeMap.emit('load');
    });

    act(() => {
      setMockState({ cadImages: [sampleCadImage] });
    });
    rerender(<MapCanvas />);

    await waitFor(() => {
      expect(fakeMap.on).toHaveBeenCalledWith('mousedown', 'cad-layer-cad-1', expect.any(Function));
    });

    const mousedownRegistrationsBeforeStyleChange = fakeMap.on.mock.calls.filter(
      ([event, layer]) => event === 'mousedown' && layer === 'cad-layer-cad-1'
    ).length;

    act(() => {
      setMockState({ cadImages: [sampleCadImage], mapStyle: 'streets' });
    });
    rerender(<MapCanvas />);

    act(() => {
      fakeMap.emitOnce('style.load');
    });

    await waitFor(() => {
      const mousedownRegistrationsAfterStyleChange = fakeMap.on.mock.calls.filter(
        ([event, layer]) => event === 'mousedown' && layer === 'cad-layer-cad-1'
      ).length;

      expect(fakeMap.off).toHaveBeenCalledWith('mousedown', 'cad-layer-cad-1', expect.any(Function));
      expect(addCadImageToMap).toHaveBeenCalledWith(fakeMap, sampleCadImage);
      expect(mousedownRegistrationsAfterStyleChange).toBe(mousedownRegistrationsBeforeStyleChange + 1);
    });
  });
});

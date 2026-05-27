import { create } from 'zustand';
import {
  Polygon,
  ParkingBlock,
  CadImage,
  Tool,
  MapStyle,
  Units,
  ViewMode,
  HistoryState,
  PolygonInProgress,
  MeasurementChain,
  MapFocusRequest,
} from '@/types/sitesketcher-v2';
import { DEFAULT_BUILDING_HEIGHT_METERS, DEFAULT_VIEWPORT, MAX_HISTORY_SIZE } from './constants';

interface SketchState {
  // Data
  polygons: Polygon[];
  parkingBlocks: ParkingBlock[];
  cadImages: CadImage[];

  // UI state
  activeTool: Tool;
  activePanel: 'layers' | 'saved' | null; // For bottom rail buttons
  selectedId: string | null;
  selectedType: 'polygon' | 'parking' | 'cad' | null;
  selectedPolygonColorIndex: number; // For polygon tool panel
  units: Units;
  mapStyle: MapStyle;
  view: ViewMode;
  sideLabelsOn: boolean;
  parkingPlacement: Pick<ParkingBlock, 'spaces' | 'layout' | 'stallSize'>;

  // Drawing state
  drawingInProgress: PolygonInProgress | null;
  measurementInProgress: MeasurementChain | null;

  // Sketch metadata
  sketchId: string | null;
  sketchName: string;
  isDirty: boolean;
  lastSaved: Date | null;

  // Viewport
  viewport: { center: [number, number]; zoom: number; pitch: number; bearing: number };
  mapFocusRequest: MapFocusRequest | null;

  // History
  history: HistoryState[];
  historyIndex: number;

  // Actions - Polygons
  addPolygon: (polygon: Polygon) => void;
  updatePolygon: (id: string, updates: Partial<Polygon>) => void;
  deletePolygon: (id: string) => void;
  setPolygons: (polygons: Polygon[]) => void;

  // Actions - Parking Blocks
  addParkingBlock: (parkingBlock: ParkingBlock) => void;
  updateParkingBlock: (id: string, updates: Partial<ParkingBlock>) => void;
  moveParkingBlock: (id: string, anchor: [number, number]) => void;
  deleteParkingBlock: (id: string) => void;
  setParkingBlocks: (parkingBlocks: ParkingBlock[]) => void;

  // Actions - CAD Images
  addCadImage: (cadImage: CadImage) => void;
  updateCadImage: (id: string, updates: Partial<CadImage>) => void;
  deleteCadImage: (id: string) => void;
  setCadImages: (cadImages: CadImage[]) => void;

  // Actions - UI
  setActiveTool: (tool: Tool) => void;
  setActivePanel: (panel: 'layers' | 'saved' | null) => void;
  setSelectedId: (id: string | null, type: 'polygon' | 'parking' | 'cad' | null) => void;
  setSelectedPolygonColorIndex: (index: number) => void;
  setUnits: (units: Units) => void;
  setMapStyle: (mapStyle: MapStyle) => void;
  setView: (view: ViewMode) => void;
  setSideLabelsOn: (on: boolean) => void;
  setParkingPlacement: (settings: Partial<SketchState['parkingPlacement']>) => void;

  // Actions - Drawing
  startPolygonDrawing: (colorIndex: number) => void;
  addPointToPolygon: (point: [number, number]) => void;
  updateLastPoint: (point: [number, number]) => void;
  finishPolygonDrawing: () => Polygon | null;
  cancelPolygonDrawing: () => void;

  startMeasurement: () => void;
  addMeasurementPoint: (point: [number, number], distance?: number) => void;
  finishMeasurement: () => void;
  cancelMeasurement: () => void;

  // Actions - Sketch
  setSketchId: (id: string | null) => void;
  setSketchName: (name: string) => void;
  markDirty: () => void;
  markClean: () => void;
  setLastSaved: (date: Date | null) => void;

  // Actions - Viewport
  setViewport: (viewport: Partial<SketchState['viewport']>) => void;
  focusMap: (request: Omit<MapFocusRequest, 'requestId'>) => void;

  // Actions - History
  pushHistory: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;

  // Actions - Reset
  reset: () => void;
  loadSketch: (sketch: any) => void;

  // Actions - Save helpers
  getSketchData: () => any;
}

const createHistoryState = (state: SketchState): HistoryState => ({
  polygons: JSON.parse(JSON.stringify(state.polygons)),
  parkingBlocks: JSON.parse(JSON.stringify(state.parkingBlocks)),
  cadImages: JSON.parse(JSON.stringify(state.cadImages)),
  timestamp: Date.now(),
});

export const useSketchStore = create<SketchState>((set, get) => ({
  // Initial state
  polygons: [],
  parkingBlocks: [],
  cadImages: [],

  activeTool: 'select',
  activePanel: null,
  selectedId: null,
  selectedType: null,
  selectedPolygonColorIndex: 0,
  units: 'metric',
  mapStyle: 'hybrid',
  view: '2d',
  sideLabelsOn: true,
  parkingPlacement: {
    spaces: 10,
    layout: 'single',
    stallSize: 'standard',
  },

  drawingInProgress: null,
  measurementInProgress: null,

  sketchId: null,
  sketchName: 'Untitled Sketch',
  isDirty: false,
  lastSaved: null,

  viewport: { ...DEFAULT_VIEWPORT },
  mapFocusRequest: null,

  history: [],
  historyIndex: -1,

  // Polygon actions
  addPolygon: (polygon) => {
    get().pushHistory(); // Push BEFORE mutation
    set((state) => ({
      polygons: [...state.polygons, polygon],
      isDirty: true,
    }));
  },

  updatePolygon: (id, updates) => {
    get().pushHistory(); // Push BEFORE mutation
    set((state) => ({
      polygons: state.polygons.map((p) =>
        p.id === id ? { ...p, ...updates, updatedAt: Date.now() } : p
      ),
      isDirty: true,
    }));
  },

  deletePolygon: (id) => {
    get().pushHistory(); // Push BEFORE mutation
    set((state) => ({
      polygons: state.polygons.filter((p) => p.id !== id),
      selectedId: state.selectedId === id ? null : state.selectedId,
      selectedType: state.selectedId === id ? null : state.selectedType,
      isDirty: true,
    }));
  },

  setPolygons: (polygons) => set({ polygons }),

  // Parking block actions
  addParkingBlock: (parkingBlock) => {
    get().pushHistory(); // Push BEFORE mutation
    set((state) => ({
      parkingBlocks: [...state.parkingBlocks, parkingBlock],
      isDirty: true,
    }));
  },

  updateParkingBlock: (id, updates) => {
    get().pushHistory(); // Push BEFORE mutation
    set((state) => ({
      parkingBlocks: state.parkingBlocks.map((pb) =>
        pb.id === id ? { ...pb, ...updates, updatedAt: Date.now() } : pb
      ),
      isDirty: true,
    }));
  },

  moveParkingBlock: (id, anchor) => {
    set((state) => ({
      parkingBlocks: state.parkingBlocks.map((pb) =>
        pb.id === id ? { ...pb, anchor, updatedAt: Date.now() } : pb
      ),
      isDirty: true,
    }));
  },

  deleteParkingBlock: (id) => {
    get().pushHistory(); // Push BEFORE mutation
    set((state) => ({
      parkingBlocks: state.parkingBlocks.filter((pb) => pb.id !== id),
      selectedId: state.selectedId === id ? null : state.selectedId,
      selectedType: state.selectedId === id ? null : state.selectedType,
      isDirty: true,
    }));
  },

  setParkingBlocks: (parkingBlocks) => set({ parkingBlocks }),

  // CAD image actions
  addCadImage: (cadImage) => {
    get().pushHistory(); // Push BEFORE mutation
    set((state) => ({
      cadImages: [...state.cadImages, cadImage],
      isDirty: true,
    }));
  },

  updateCadImage: (id, updates) => {
    get().pushHistory(); // Push BEFORE mutation
    set((state) => ({
      cadImages: state.cadImages.map((ci) =>
        ci.id === id ? { ...ci, ...updates, updatedAt: Date.now() } : ci
      ),
      isDirty: true,
    }));
  },

  deleteCadImage: (id) => {
    get().pushHistory(); // Push BEFORE mutation
    set((state) => ({
      cadImages: state.cadImages.filter((ci) => ci.id !== id),
      selectedId: state.selectedId === id ? null : state.selectedId,
      selectedType: state.selectedId === id ? null : state.selectedType,
      isDirty: true,
    }));
  },

  setCadImages: (cadImages) => set({ cadImages }),

  // UI actions
  setActiveTool: (tool) =>
    set({
      activeTool: tool,
      activePanel: null, // Clear panel when tool is selected
      selectedId: tool === 'select' ? get().selectedId : null,
      selectedType: tool === 'select' ? get().selectedType : null,
    }),

  setActivePanel: (panel) =>
    set({
      activePanel: panel,
      activeTool: 'select', // Switch to select when panel is opened
    }),

  setSelectedId: (id, type) =>
    set({
      selectedId: id,
      selectedType: type,
      activeTool: id ? 'select' : get().activeTool,
    }),

  setSelectedPolygonColorIndex: (index) => set({ selectedPolygonColorIndex: index }),
  setUnits: (units) => set({ units, isDirty: true }),
  setMapStyle: (mapStyle) => set({ mapStyle }),
  setView: (view) => set({ view }),
  setSideLabelsOn: (on) => set({ sideLabelsOn: on, isDirty: true }),
  setParkingPlacement: (settings) =>
    set((state) => ({
      parkingPlacement: { ...state.parkingPlacement, ...settings },
    })),

  // Drawing actions
  startPolygonDrawing: (colorIndex) =>
    set({
      drawingInProgress: { points: [], colorIndex },
      activeTool: 'polygon',
    }),

  addPointToPolygon: (point) => {
    const state = get();
    if (!state.drawingInProgress) return;

    set({
      drawingInProgress: {
        ...state.drawingInProgress,
        points: [...state.drawingInProgress.points, point],
      },
    });
  },

  updateLastPoint: (point) => {
    const state = get();
    if (!state.drawingInProgress || state.drawingInProgress.points.length === 0) return;

    const points = [...state.drawingInProgress.points];
    points[points.length - 1] = point;

    set({
      drawingInProgress: {
        ...state.drawingInProgress,
        points,
      },
    });
  },

  finishPolygonDrawing: () => {
    const state = get();
    if (!state.drawingInProgress || state.drawingInProgress.points.length < 3) {
      set({ drawingInProgress: null });
      return null;
    }

    const polygon: Polygon = {
      id: `polygon-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: `Plot ${String.fromCharCode(65 + state.polygons.length)}`,
      colorIndex: state.drawingInProgress.colorIndex,
      points: state.drawingInProgress.points,
      rotation: 0,
      height: DEFAULT_BUILDING_HEIGHT_METERS,
      showDistances: true,
      showArea: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    set((s) => ({
      polygons: [...s.polygons, polygon],
      drawingInProgress: null,
      isDirty: true,
    }));

    get().pushHistory();
    return polygon;
  },

  cancelPolygonDrawing: () => set({ drawingInProgress: null }),

  startMeasurement: () =>
    set({
      measurementInProgress: {
        id: `measurement-${Date.now()}`,
        points: [],
        totalDistance: 0,
      },
      activeTool: 'measure',
    }),

  addMeasurementPoint: (point, distance) => {
    const state = get();
    if (!state.measurementInProgress) return;

    const newPoint = { lngLat: point, distance };
    const points = [...state.measurementInProgress.points, newPoint];
    const totalDistance = points.reduce((sum, p) => sum + (p.distance || 0), 0);

    set({
      measurementInProgress: {
        ...state.measurementInProgress,
        points,
        totalDistance,
      },
    });
  },

  finishMeasurement: () => set({ measurementInProgress: null }),

  cancelMeasurement: () => set({ measurementInProgress: null }),

  // Sketch actions
  setSketchId: (id) => set({ sketchId: id }),
  setSketchName: (name) => set({ sketchName: name, isDirty: true }),
  markDirty: () => set({ isDirty: true }),
  markClean: () => set({ isDirty: false }),
  setLastSaved: (date) => set({ lastSaved: date }),

  // Viewport actions
  setViewport: (viewport) =>
    set((state) => ({
      viewport: { ...state.viewport, ...viewport },
    })),
  focusMap: (request) =>
    set({
      mapFocusRequest: {
        ...request,
        requestId: Date.now(),
      },
    }),

  // History actions
  pushHistory: () => {
    const state = get();
    const newHistoryState = createHistoryState(state);

    // If we're not at the end of history, truncate future states
    const history = state.history.slice(0, state.historyIndex + 1);

    // Add new state and limit size
    const newHistory = [...history, newHistoryState].slice(-MAX_HISTORY_SIZE);

    set({
      history: newHistory,
      historyIndex: newHistory.length - 1,
    });
  },

  undo: () => {
    const state = get();
    if (!state.canUndo()) return;

    const newIndex = state.historyIndex - 1;
    const historyState = state.history[newIndex];

    set({
      polygons: historyState.polygons,
      parkingBlocks: historyState.parkingBlocks,
      cadImages: historyState.cadImages,
      historyIndex: newIndex,
      isDirty: true,
    });
  },

  redo: () => {
    const state = get();
    if (!state.canRedo()) return;

    const newIndex = state.historyIndex + 1;
    const historyState = state.history[newIndex];

    set({
      polygons: historyState.polygons,
      parkingBlocks: historyState.parkingBlocks,
      cadImages: historyState.cadImages,
      historyIndex: newIndex,
      isDirty: true,
    });
  },

  canUndo: () => {
    const state = get();
    return state.historyIndex > 0;
  },

  canRedo: () => {
    const state = get();
    return state.historyIndex < state.history.length - 1;
  },

  // Reset actions
  reset: () =>
    set({
      polygons: [],
      parkingBlocks: [],
      cadImages: [],
      activeTool: 'select',
      selectedId: null,
      selectedType: null,
      drawingInProgress: null,
      measurementInProgress: null,
      sketchId: null,
      sketchName: 'Untitled Sketch',
      isDirty: false,
      lastSaved: null,
      viewport: { ...DEFAULT_VIEWPORT },
      mapFocusRequest: null,
      history: [],
      historyIndex: -1,
    }),

  loadSketch: (sketch) => {
    const data = sketch.data;
    set({
      polygons: data.polygons || [],
      parkingBlocks: data.parkingBlocks || [],
      cadImages: data.cadImages || [],
      viewport: data.viewport || { ...DEFAULT_VIEWPORT },
      units: data.settings?.units || 'metric',
      mapStyle: (data.settings?.mapStyle as MapStyle) || 'hybrid',
      sideLabelsOn: data.settings?.sideLabelsOn ?? true,
      sketchId: sketch.id,
      sketchName: sketch.name,
      isDirty: false,
      lastSaved: new Date(sketch.updated_at),
      history: [],
      historyIndex: -1,
      activeTool: 'select',
      selectedId: null,
      selectedType: null,
    });

    // Push initial history state
    get().pushHistory();
  },

  // Get sketch data for saving
  getSketchData: () => {
    const state = get();
    return {
      version: 2,
      polygons: state.polygons,
      parkingBlocks: state.parkingBlocks,
      cadImages: state.cadImages,
      viewport: state.viewport,
      settings: {
        units: state.units,
        mapStyle: state.mapStyle,
        sideLabelsOn: state.sideLabelsOn,
      },
    };
  },
}));

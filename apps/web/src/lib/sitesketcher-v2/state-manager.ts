import { create } from 'zustand';
import {
  Polygon,
  ParkingBlock,
  CadImage,
  SavedCad,
  CadInstance,
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
import { rotatePolygonPoints } from './polygon-utils';
import { measurementPreviewStore } from './measurement-preview-store';
import type mapboxgl from 'mapbox-gl';

interface SketchState {
  // Map reference (for coordinate transformations)
  mapInstance: mapboxgl.Map | null;

  // Data
  polygons: Polygon[];
  parkingBlocks: ParkingBlock[];
  cadImages: CadImage[]; // DEPRECATED: Will be removed after migration
  cadInstances: CadInstance[];
  savedCads: SavedCad[];
  savedCadsLoading: boolean;
  savedCadsError: string | null;

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
  frozenMeasurement: MeasurementChain | null; // Measurement that's finished drawing but still visible
  cadPlacementInProgress: { savedCadId: string } | null; // SavedCad being placed (no instance until placement)

  // Sketch metadata
  sketchId: string | null;
  sketchName: string;
  sketchDescription: string;
  isDirty: boolean;
  lastSaved: Date | null;

  // Viewport
  viewport: { center: [number, number]; zoom: number; pitch: number; bearing: number };
  mapFocusRequest: MapFocusRequest | null;

  // History
  history: HistoryState[];
  historyIndex: number;

  // Actions - Map
  setMapInstance: (map: mapboxgl.Map | null) => void;

  // Actions - Polygons
  addPolygon: (polygon: Polygon) => void;
  updatePolygon: (id: string, updates: Partial<Polygon>, options?: { recordHistory?: boolean }) => void;
  rotatePolygon: (id: string, newRotation: number, options?: { recordHistory?: boolean }) => void;
  deletePolygon: (id: string) => void;
  setPolygons: (polygons: Polygon[]) => void;

  // Actions - Parking Blocks
  addParkingBlock: (parkingBlock: ParkingBlock) => void;
  updateParkingBlock: (id: string, updates: Partial<ParkingBlock>) => void;
  moveParkingBlock: (id: string, anchor: [number, number]) => void;
  deleteParkingBlock: (id: string) => void;
  setParkingBlocks: (parkingBlocks: ParkingBlock[]) => void;

  // Actions - CAD Images (DEPRECATED)
  addCadImage: (cadImage: CadImage) => void;
  updateCadImage: (id: string, updates: Partial<CadImage>) => void;
  moveCadImage: (id: string, anchor: [number, number]) => void;
  deleteCadImage: (id: string) => void;
  setCadImages: (cadImages: CadImage[]) => void;
  startCadPlacement: (savedCadIdOrLegacyId: string) => void;
  placeCadImage: (id: string, anchor: [number, number]) => void;
  cancelCadPlacement: () => void;

  // Actions - SavedCad Library
  loadSavedCads: () => Promise<void>;
  addSavedCad: (cad: SavedCad) => void;
  updateSavedCad: (id: string, updates: Partial<SavedCad>) => void;
  deleteSavedCad: (id: string) => void;

  // Actions - CAD Instances
  addCadInstance: (instance: CadInstance) => void;
  updateCadInstance: (id: string, updates: Partial<CadInstance>) => void;
  deleteCadInstance: (id: string) => void;
  placeCadInstance: (savedCadId: string, anchor: [number, number]) => void;

  // Helpers
  getCadForInstance: (instanceId: string) => SavedCad | null;

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
  freezeMeasurement: () => void; // Stop drawing but keep visible

  // Actions - Sketch
  setSketchId: (id: string | null) => void;
  setSketchName: (name: string) => void;
  setSketchDescription: (description: string) => void;
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
  timestamp: Date.now(),
});

export const useSketchStore = create<SketchState>((set, get) => ({
  // Initial state
  mapInstance: null,
  polygons: [],
  parkingBlocks: [],
  cadImages: [], // DEPRECATED
  cadInstances: [],
  savedCads: [],
  savedCadsLoading: false,
  savedCadsError: null,

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
  frozenMeasurement: null,
  cadPlacementInProgress: null,

  sketchId: null,
  sketchName: 'Untitled Sketch',
  sketchDescription: '',
  isDirty: false,
  lastSaved: null,

  viewport: { ...DEFAULT_VIEWPORT },
  mapFocusRequest: null,

  history: [],
  historyIndex: -1,

  // Map actions
  setMapInstance: (map) => set({ mapInstance: map }),

  // Polygon actions
  addPolygon: (polygon) => {
    get().pushHistory(); // Push BEFORE mutation
    set((state) => ({
      polygons: [...state.polygons, polygon],
      isDirty: true,
    }));
  },

  updatePolygon: (id, updates, options) => {
    if (options?.recordHistory !== false) {
      get().pushHistory(); // Push BEFORE mutation
    }
    set((state) => ({
      polygons: state.polygons.map((p) =>
        p.id === id ? { ...p, ...updates, updatedAt: Date.now() } : p
      ),
      isDirty: true,
    }));
  },

  rotatePolygon: (id, newRotation, options) => {
    const state = get();
    const { mapInstance } = state;

    if (!mapInstance) {
      console.warn('Cannot rotate polygon: map instance not available');
      return;
    }

    const polygon = state.polygons.find(p => p.id === id);
    if (!polygon) return;

    // Calculate the delta rotation
    const deltaRotation = newRotation - polygon.rotation;
    if (deltaRotation === 0) return;

    if (options?.recordHistory !== false) {
      get().pushHistory(); // Push BEFORE mutation
    }

    // Rotate the actual points by the delta
    const rotatedPoints = rotatePolygonPoints(polygon.points, deltaRotation, mapInstance);

    set((state) => ({
      polygons: state.polygons.map((p) =>
        p.id === id
          ? { ...p, points: rotatedPoints, rotation: newRotation, updatedAt: Date.now() }
          : p
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
    // NO pushHistory() - CAD operations not in undo stack (deferred to future PR)
    set((state) => ({
      cadImages: [...state.cadImages, cadImage],
      isDirty: true,
    }));
  },

  updateCadImage: (id, updates) => {
    // NO pushHistory() - CAD operations not in undo stack (deferred to future PR)
    set((state) => ({
      cadImages: state.cadImages.map((ci) =>
        ci.id === id ? { ...ci, ...updates, updatedAt: Date.now() } : ci
      ),
      isDirty: true,
    }));
  },

  moveCadImage: (id, anchor) => {
    // DOES NOT push history - used during drag operations
    // History is pushed once on mousedown
    set((state) => ({
      cadImages: state.cadImages.map((ci) =>
        ci.id === id ? { ...ci, anchor, updatedAt: Date.now() } : ci
      ),
      isDirty: true,
    }));
  },

  deleteCadImage: (id) => {
    // NO pushHistory() - CAD operations not in undo stack (deferred to future PR)
    set((state) => ({
      cadImages: state.cadImages.filter((ci) => ci.id !== id),
      selectedId: state.selectedId === id ? null : state.selectedId,
      selectedType: state.selectedId === id ? null : state.selectedType,
      cadPlacementInProgress: state.cadPlacementInProgress,
      isDirty: true,
    }));
  },

  setCadImages: (cadImages) => set({ cadImages }),

  startCadPlacement: (savedCadIdOrLegacyId) => {
    // NEW: Check if it's a savedCadId or legacy CAD image ID
    const state = get();
    const isSavedCad = state.savedCads.some(cad => cad.id === savedCadIdOrLegacyId);

    if (isSavedCad) {
      // New flow: place from library
      set({
        cadPlacementInProgress: { savedCadId: savedCadIdOrLegacyId },
        activeTool: 'cad',
        activePanel: null,
        selectedId: null, // No selection until instance created
        selectedType: null,
      });
    } else {
      // Legacy flow: placing existing CAD image
      set({
        cadPlacementInProgress: null, // Legacy uses different mechanism
        activeTool: 'cad',
        activePanel: null,
        selectedId: savedCadIdOrLegacyId,
        selectedType: 'cad',
      });
    }
  },

  placeCadImage: (id, anchor) => {
    // NO pushHistory() - CAD operations deferred from undo system (see Known Limitations)
    set((state) => ({
      cadImages: state.cadImages.map((ci) =>
        ci.id === id ? { ...ci, anchor, updatedAt: Date.now() } : ci
      ),
      cadPlacementInProgress: null,
      isDirty: true,
    }));
  },

  cancelCadPlacement: () => set({
    cadPlacementInProgress: null,
  }),

  // SavedCad Library actions
  loadSavedCads: async () => {
    set({ savedCadsLoading: true, savedCadsError: null });

    try {
      const response = await fetch('/api/sitesketcher-v2/cads');

      if (!response.ok) {
        throw new Error(`Failed to load CAD library: ${response.statusText}`);
      }

      const data = await response.json();
      set({
        savedCads: data.cads || [],
        savedCadsLoading: false,
        savedCadsError: null,
      });
    } catch (error) {
      console.error('Failed to load saved CADs:', error);
      set({
        savedCadsLoading: false,
        savedCadsError: error instanceof Error ? error.message : 'Failed to load CAD library',
      });
    }
  },

  addSavedCad: (cad) => {
    set((state) => ({
      savedCads: [...state.savedCads, cad],
    }));
  },

  updateSavedCad: (id, updates) => {
    set((state) => ({
      savedCads: state.savedCads.map((cad) =>
        cad.id === id ? { ...cad, ...updates } : cad
      ),
    }));
  },

  deleteSavedCad: (id) => {
    set((state) => ({
      savedCads: state.savedCads.filter((cad) => cad.id !== id),
    }));
  },

  // CAD Instance actions
  addCadInstance: (instance) => {
    // NO pushHistory() - CAD operations not in undo stack (deferred to future PR)
    set((state) => ({
      cadInstances: [...state.cadInstances, instance],
      isDirty: true,
    }));
  },

  updateCadInstance: (id, updates) => {
    // NO pushHistory() - CAD operations not in undo stack (deferred to future PR)
    set((state) => ({
      cadInstances: state.cadInstances.map((instance) =>
        instance.id === id ? { ...instance, ...updates, updatedAt: Date.now() } : instance
      ),
      isDirty: true,
    }));
  },

  deleteCadInstance: (id) => {
    // NO pushHistory() - CAD operations not in undo stack (deferred to future PR)
    set((state) => ({
      cadInstances: state.cadInstances.filter((instance) => instance.id !== id),
      selectedId: state.selectedId === id ? null : state.selectedId,
      selectedType: state.selectedId === id ? null : state.selectedType,
      isDirty: true,
    }));
  },

  placeCadInstance: (savedCadId, anchor) => {
    // NO pushHistory() - CAD operations deferred from undo system
    const instance: CadInstance = {
      id: `cad-instance-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      savedCadId,
      anchor,
      rotation: 0,
      opacity: 0.7,
      locked: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    set((state) => ({
      cadInstances: [...state.cadInstances, instance],
      cadPlacementInProgress: null,
      selectedId: instance.id,
      selectedType: 'cad',
      activeTool: 'select',
      activePanel: null,
      isDirty: true,
    }));
  },

  // Helper
  getCadForInstance: (instanceId) => {
    const state = get();
    const instance = state.cadInstances.find((i) => i.id === instanceId);
    if (!instance) return null;
    return state.savedCads.find((cad) => cad.id === instance.savedCadId) || null;
  },

  // UI actions
  setActiveTool: (tool) => {
    // Clear preview when switching away from measure tool
    if (tool !== 'measure') {
      measurementPreviewStore.clear();
    }

    return set((state) => ({
      activeTool: tool,
      activePanel: null, // Clear panel when tool is selected
      selectedId: tool === 'select' ? state.selectedId : null,
      selectedType: tool === 'select' ? state.selectedType : null,
      measurementInProgress: tool === 'measure' ? state.measurementInProgress : null, // Clear measurement when switching away
      frozenMeasurement: tool === 'measure' ? state.frozenMeasurement : null, // Clear frozen measurement when switching away
      cadPlacementInProgress: null, // Cancel placement when switching tools
    }));
  },

  setActivePanel: (panel) => {
    // Always clear measurement and preview (opening panels always nulls measurement)
    measurementPreviewStore.clear();

    return set({
      activePanel: panel,
      activeTool: 'select', // Switch to select when panel is opened
      measurementInProgress: null, // Clear measurement when panel is opened
      frozenMeasurement: null, // Clear frozen measurement when panel is opened
      cadPlacementInProgress: null, // Cancel placement when opening panels
    });
  },

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

  startMeasurement: () => {
    measurementPreviewStore.clear(); // Clear any previous preview
    return set({
      measurementInProgress: {
        id: `measurement-${Date.now()}`,
        points: [],
        totalDistance: 0,
      },
      activeTool: 'measure',
      frozenMeasurement: null, // Clear any frozen measurement when starting new measurement
    });
  },

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

  finishMeasurement: () => {
    measurementPreviewStore.clear();
    return set({ measurementInProgress: null });
  },

  cancelMeasurement: () => {
    measurementPreviewStore.clear();
    return set({ measurementInProgress: null, frozenMeasurement: null });
  },

  freezeMeasurement: () => {
    const state = get();
    if (!state.measurementInProgress) return;

    measurementPreviewStore.clear();
    return set({
      frozenMeasurement: state.measurementInProgress,
      measurementInProgress: null,
    });
  },

  // Sketch actions
  setSketchId: (id) => set({ sketchId: id }),
  setSketchName: (name) => set({ sketchName: name, isDirty: true }),
  setSketchDescription: (description) => set({ sketchDescription: description, isDirty: true }),
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

    // Clear placement mode even if no history available (before canUndo check)
    // This ensures Escape-like behavior when user presses undo during placement
    if (state.cadPlacementInProgress) {
      set({ cadPlacementInProgress: null });
    }

    if (!state.canUndo()) return;

    const newIndex = state.historyIndex - 1;
    const historyState = state.history[newIndex];

    set({
      polygons: historyState.polygons,
      parkingBlocks: historyState.parkingBlocks,
      cadImages: state.cadImages, // Preserve current CAD state (legacy)
      cadInstances: state.cadInstances, // Preserve current CAD instances
      cadPlacementInProgress: null, // Clear transient placement mode (redundant but explicit)
      historyIndex: newIndex,
      isDirty: true,
    });
  },

  redo: () => {
    const state = get();

    // Clear placement mode even if no history available (before canRedo check)
    if (state.cadPlacementInProgress) {
      set({ cadPlacementInProgress: null });
    }

    if (!state.canRedo()) return;

    const newIndex = state.historyIndex + 1;
    const historyState = state.history[newIndex];

    set({
      polygons: historyState.polygons,
      parkingBlocks: historyState.parkingBlocks,
      cadImages: state.cadImages, // Preserve current CAD state (legacy)
      cadInstances: state.cadInstances, // Preserve current CAD instances
      cadPlacementInProgress: null, // Clear transient placement mode (redundant but explicit)
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
  reset: () => {
    measurementPreviewStore.clear(); // MUST clear preview on reset
    return set({
      polygons: [],
      parkingBlocks: [],
      cadImages: [], // Legacy
      cadInstances: [],
      // NOTE: Do NOT reset savedCads - library persists across sketches
      activeTool: 'select',
      activePanel: null,
      selectedId: null,
      selectedType: null,
      drawingInProgress: null,
      measurementInProgress: null,
      frozenMeasurement: null,
      cadPlacementInProgress: null,
      sketchId: null,
      sketchName: 'Untitled Sketch',
      sketchDescription: '',
      isDirty: false,
      lastSaved: null,
      viewport: { ...DEFAULT_VIEWPORT },
      mapFocusRequest: null,
      history: [],
      historyIndex: -1,
    });
  },

  loadSketch: (sketch) => {
    measurementPreviewStore.clear(); // Clear preview when loading sketch
    const data = sketch.data;
    set({
      polygons: data.polygons || [],
      parkingBlocks: data.parkingBlocks || [],
      cadImages: data.cadImages || [], // Legacy support
      cadInstances: data.cadInstances || [],
      // NOTE: savedCads remain unchanged - library persists across sketch loads
      viewport: data.viewport || { ...DEFAULT_VIEWPORT },
      units: data.settings?.units || 'metric',
      mapStyle: (data.settings?.mapStyle as MapStyle) || 'hybrid',
      sideLabelsOn: data.settings?.sideLabelsOn ?? true,
      sketchId: sketch.id,
      sketchName: sketch.name,
      sketchDescription: sketch.description || '',
      isDirty: false,
      lastSaved: new Date(sketch.updated_at),
      history: [],
      historyIndex: -1,
      activeTool: 'select',
      activePanel: null,
      selectedId: null,
      selectedType: null,
      measurementInProgress: null, // Explicitly clear measurement on load
      frozenMeasurement: null, // Explicitly clear frozen measurement on load
      cadPlacementInProgress: null, // Explicitly clear placement on load
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
      cadImages: state.cadImages, // Legacy support (can be removed after full migration)
      cadInstances: state.cadInstances,
      viewport: state.viewport,
      settings: {
        units: state.units,
        mapStyle: state.mapStyle,
        sideLabelsOn: state.sideLabelsOn,
      },
    };
  },
}));

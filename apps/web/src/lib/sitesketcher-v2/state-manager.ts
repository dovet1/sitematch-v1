import { create } from 'zustand';
import {
  Polygon,
  ParkingBlock,
  CadImage,
  SavedCad,
  CadInstance,
  AutoParkingLayout,
  AutoParkingEntrance,
  Tool,
  MapStyle,
  Units,
  ViewMode,
  HistoryState,
  PolygonInProgress,
  MeasurementChain,
  MapFocusRequest,
  EffectiveAccess,
  LimitStatus,
} from '@/types/sitesketcher-v2';
import { DEFAULT_BUILDING_HEIGHT_METERS, DEFAULT_VIEWPORT, MAX_HISTORY_SIZE, TIER_FEATURES } from './constants';
import { rotatePolygonPoints } from './polygon-utils';
import { measurementPreviewStore } from './measurement-preview-store';
import {
  createDefaultAutoParkingDraft,
  type AutoParkingDraft,
  type AutoParkingPhase,
  type AutoParkingGenerationStatus,
} from './auto-parking/types';
import { isAccessAnchorValid, snapPointToBoundaryEdge, type AccessAnchor } from './auto-parking/access-point';
import { entranceBuildings, isEntranceValid, type EntranceBuilding } from './auto-parking/entrance-point';
import type { CandidateLayout, SolverInput, SolverOutput } from '@/lib/parking-layout-lab/types';
import type mapboxgl from 'mapbox-gl';

export type ParkingMethod = 'manual' | 'auto';

/** The solver run a candidate was chosen from — needed to build the persisted AutoParkingLayout on apply. */
export interface AutoParkingSolverRun {
  input: SolverInput;
  output: SolverOutput;
}

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

  // Auto parking — parkingMethod is persisted per sketch (SketchData.settings.parkingMethod);
  // autoParkingDraft is transient workflow state, never persisted (see
  // docs/design_handoff_auto_parking_guided/README.md "State Management").
  parkingMethod: ParkingMethod;
  autoParkingDraft: AutoParkingDraft;
  // Worker-driven, transient (owned/mutated by the worker controller hook).
  autoParkingGenerationStatus: AutoParkingGenerationStatus;
  autoParkingGenerationError: string | null;
  autoParkingCandidates: CandidateLayout[];
  autoParkingSelectedCandidateId: string | null;
  autoParkingSolverRun: AutoParkingSolverRun | null;
  // Map-only draft-solve preview rendered while dragging boundary/access/exclusion
  // geometry during compare — never touches candidate cards/metrics (see useAutoParkingWorker).
  autoParkingLivePreview: GeoJSON.FeatureCollection | null;
  autoParkingPreviewUpdating: boolean;
  // Persisted, applied layouts (SketchData.autoLayouts). Selection is tracked
  // separately from selectedId/selectedType — see setSelectedAutoLayoutId —
  // because the shared store's selectedType union is also consumed by the
  // standalone SiteSketcher shell (RightInspector.tsx), which the integration
  // plan explicitly keeps unmodified.
  autoLayouts: AutoParkingLayout[];
  selectedAutoLayoutId: string | null;

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

  // Subscription tier access
  effectiveAccess: EffectiveAccess;

  // Actions - Map
  setMapInstance: (map: mapboxgl.Map | null) => void;

  // Actions - Subscription tier
  setEffectiveAccess: (access: EffectiveAccess) => void;
  checkPolygonLimit: () => boolean;
  checkParkingLimit: () => boolean;
  checkCadLimit: () => boolean;
  checkMeasurementLimit: () => boolean;
  getPolygonLimitStatus: () => LimitStatus;
  getParkingLimitStatus: () => LimitStatus;
  getMeasurementPointCount: () => number;

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
  loadSharedCads: () => Promise<void>;
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

  // Actions - Auto parking (guided flow; see auto-parking/types.ts AutoParkingPhase)
  /** Manually toggling to 'auto' always starts a fresh guided boundary draw — never auto-selects an existing polygon. */
  setParkingMethod: (method: ParkingMethod) => void;
  /** Boundary just closed (draw.create) — commits it and advances straight to access placement. */
  setAutoParkingBoundary: (boundaryId: string) => void;
  startAutoParkingBoundaryEdit: () => void;
  commitAutoParkingBoundaryEdit: () => void;
  cancelAutoParkingBoundaryEdit: () => void;
  setAutoParkingBuildingMode: (mode: AutoParkingDraft['buildingMode']) => void;
  toggleAutoParkingBuilding: (id: string, source: 'drawn' | 'selected') => void;
  continueAutoParkingBuildings: () => void;
  startAutoParkingBuildingsEdit: () => void;
  /** Live value update while hovering/dragging; never advances the phase. */
  setAutoParkingEntrance: (entrance: AutoParkingEntrance | null) => void;
  commitAutoParkingEntrance: (entrance: AutoParkingEntrance) => void;
  startAutoParkingEntranceEdit: () => void;
  cancelAutoParkingEntranceEdit: () => void;
  /** Live value update only (hover preview / drag) — never changes phase. */
  setAutoParkingAccessAnchor: (anchor: AccessAnchor | null) => void;
  /** Click / drag-release — sets the anchor AND advances/exits the placement phase. */
  commitAutoParkingAccessAnchor: (anchor: AccessAnchor) => void;
  startAutoParkingAccessEdit: () => void;
  cancelAutoParkingAccessEdit: () => void;
  updateAutoParkingSettings: (updates: Partial<AutoParkingDraft['settings']>) => void;
  setAutoParkingSettingsExpanded: (expanded: boolean) => void;
  setAutoParkingPhase: (phase: AutoParkingPhase) => void;
  resetAutoParkingDraft: () => void;
  setAutoParkingGenerationStatus: (status: AutoParkingGenerationStatus, error?: string | null) => void;
  setAutoParkingCandidates: (
    candidates: CandidateLayout[],
    run: AutoParkingSolverRun | null,
    selectedCandidateId?: string | null
  ) => void;
  setAutoParkingSelectedCandidateId: (id: string | null) => void;
  setAutoParkingLivePreview: (fc: GeoJSON.FeatureCollection | null) => void;
  setAutoParkingPreviewUpdating: (updating: boolean) => void;
  clearAutoParkingGeneration: () => void;
  /** Reopens the guided comparison flow with a working copy of an already-applied layout ("Edit layout settings" / "Regenerate"). */
  enterAutoParkingEditor: (layout: AutoParkingLayout, opts?: { expandSettings?: boolean }) => void;
  /** Consumes (returns + clears) the one-shot "auto-generate on entry" flag set by enterAutoParkingEditor. */
  consumeAutoParkingPendingGenerate: () => boolean;
  /** Commits the chosen candidate: adds a new layout, or replaces draft.editingLayoutId's layout in place. Exits Auto back to Select. */
  applyAutoParkingLayout: (layout: AutoParkingLayout) => void;
  addAutoLayout: (layout: AutoParkingLayout) => void;
  updateAutoLayout: (id: string, updates: Partial<AutoParkingLayout>) => void;
  deleteAutoLayout: (id: string) => void;
  setAutoLayouts: (layouts: AutoParkingLayout[]) => void;
  setSelectedAutoLayoutId: (id: string | null) => void;

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

/** The guided building set (selected polygons + intersecting CAD) the entrance snaps/resolves against. */
const entranceBuildingsForState = (state: SketchState): EntranceBuilding[] => {
  const draft = state.autoParkingDraft;
  const boundary = state.polygons.find((polygon) => polygon.id === draft.boundaryId);
  if (!boundary) return [];
  return entranceBuildings({
    boundaryId: boundary.id,
    boundaryRing: boundary.points,
    buildingRefs: draft.buildingRefs,
    polygons: state.polygons,
    cadInstances: state.cadInstances,
    cadImages: state.cadImages,
    savedCads: state.savedCads,
  });
};

const createHistoryState = (state: SketchState): HistoryState => ({
  polygons: JSON.parse(JSON.stringify(state.polygons)),
  parkingBlocks: JSON.parse(JSON.stringify(state.parkingBlocks)),
  timestamp: Date.now(),
});

const reconcileSelectionWithHistoryState = (
  state: SketchState,
  historyState: HistoryState
): Pick<SketchState, 'selectedId' | 'selectedType'> => {
  if (!state.selectedId || !state.selectedType) {
    return { selectedId: state.selectedId, selectedType: state.selectedType };
  }

  if (
    state.selectedType === 'polygon' &&
    !historyState.polygons.some((polygon) => polygon.id === state.selectedId)
  ) {
    return { selectedId: null, selectedType: null };
  }

  if (
    state.selectedType === 'parking' &&
    !historyState.parkingBlocks.some((parkingBlock) => parkingBlock.id === state.selectedId)
  ) {
    return { selectedId: null, selectedType: null };
  }

  return { selectedId: state.selectedId, selectedType: state.selectedType };
};

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

  parkingMethod: 'manual',
  autoParkingDraft: createDefaultAutoParkingDraft(),
  autoParkingGenerationStatus: 'idle',
  autoParkingGenerationError: null,
  autoParkingCandidates: [],
  autoParkingSelectedCandidateId: null,
  autoParkingSolverRun: null,
  autoParkingLivePreview: null,
  autoParkingPreviewUpdating: false,
  autoLayouts: [],
  selectedAutoLayoutId: null,

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

  // Subscription tier access (initialize with free tier)
  effectiveAccess: {
    hasProAccess: false,
    hasPlusAccess: false,
    tierLimits: TIER_FEATURES.free,
  },

  // Map actions
  setMapInstance: (map) => set({ mapInstance: map }),

  // Subscription tier actions
  setEffectiveAccess: (access) => set({ effectiveAccess: access }),

  checkPolygonLimit: () => {
    const state = get();
    return state.polygons.length < state.effectiveAccess.tierLimits.maxPolygons;
  },

  checkParkingLimit: () => {
    const state = get();
    return state.parkingBlocks.length < state.effectiveAccess.tierLimits.maxParkingBlocks;
  },

  checkCadLimit: () => {
    const state = get();
    const cadCount = state.cadInstances.length + state.cadImages.length;
    return cadCount < state.effectiveAccess.tierLimits.maxCadImages;
  },

  checkMeasurementLimit: () => {
    const state = get();
    const pointCount = state.measurementInProgress?.points.length || 0;
    return pointCount < state.effectiveAccess.tierLimits.maxMeasurementPoints;
  },

  getPolygonLimitStatus: () => {
    const state = get();
    const current = state.polygons.length;
    const max = state.effectiveAccess.tierLimits.maxPolygons;
    return {
      current,
      max,
      reached: current >= max,
      remaining: Math.max(0, max - current),
    };
  },

  getParkingLimitStatus: () => {
    const state = get();
    const current = state.parkingBlocks.length;
    const max = state.effectiveAccess.tierLimits.maxParkingBlocks;
    return {
      current,
      max,
      reached: current >= max,
      remaining: Math.max(0, max - current),
    };
  },

  getMeasurementPointCount: () => {
    const state = get();
    return state.measurementInProgress?.points.length || 0;
  },

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
    // Placing from within the guided Auto-parking Buildings step must not
    // switch the tool/panel away from Parking, or the guided flow unmounts.
    const inGuidedBuildings =
      state.parkingMethod === 'auto' && state.autoParkingDraft.phase === 'buildings';

    if (isSavedCad) {
      // New flow: place from library
      set({
        cadPlacementInProgress: { savedCadId: savedCadIdOrLegacyId },
        ...(inGuidedBuildings ? {} : { activeTool: 'cad', activePanel: null }),
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

  // Load the admin-maintained shared CAD library into savedCads. Used by the
  // unified workspace instead of the per-user loadSavedCads(); populates the
  // same array so CAD rendering/resolution by id works unchanged.
  loadSharedCads: async () => {
    set({ savedCadsLoading: true, savedCadsError: null });

    try {
      const response = await fetch('/api/sitesketcher-v2/shared-cads');

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
      console.error('Failed to load shared CADs:', error);
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

    set((state) => {
      // Keep the guided Auto-parking flow on the Parking tool when the CAD is
      // dropped from its Buildings step; otherwise fall back to Select.
      const inGuidedBuildings =
        state.parkingMethod === 'auto' && state.autoParkingDraft.phase === 'buildings';
      return {
        cadInstances: [...state.cadInstances, instance],
        cadPlacementInProgress: null,
        selectedId: instance.id,
        selectedType: 'cad',
        ...(inGuidedBuildings ? {} : { activeTool: 'select', activePanel: null }),
        isDirty: true,
      };
    });
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
    set((state) => {
      // Selecting a CAD from within the guided Auto-parking flow must keep the
      // Parking tool active — the user manipulates it (move/rotate) in place via
      // the inspector rather than being yanked into Select mode.
      const keepGuidedTool =
        type === 'cad' && state.parkingMethod === 'auto' && state.activeTool === 'parking'
      return {
        selectedId: id,
        selectedType: type,
        selectedAutoLayoutId: null,
        activeTool: id && !keepGuidedTool ? 'select' : state.activeTool,
      }
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

  // Auto parking actions — see auto-parking/types.ts for the AutoParkingPhase state machine.
  setParkingMethod: (method) =>
    set({
      parkingMethod: method,
      isDirty: true,
      // Manually toggling to Auto always starts a fresh guided boundary draw
      // (no existing-polygon auto-select — see README.md §1). Toggling back
      // to Manual cancels any in-flight guided step.
      autoParkingDraft: createDefaultAutoParkingDraft(),
      autoParkingGenerationStatus: 'idle',
      autoParkingGenerationError: null,
      autoParkingCandidates: [],
      autoParkingSelectedCandidateId: null,
      autoParkingSolverRun: null,
      autoParkingLivePreview: null,
      autoParkingPreviewUpdating: false,
    }),

  // The boundary polygon just closed (draw.create) — commit it and advance
  // to the optional building-capture step.
  setAutoParkingBoundary: (boundaryId) =>
    set((state) => ({
      autoParkingDraft: {
        ...state.autoParkingDraft,
        boundaryId,
        boundarySnapshot: null,
        buildingRefs: [],
        buildingMode: 'draw',
        entrance: null,
        entranceSnapshot: null,
        accessAnchor: null,
        accessAnchorSnapshot: null,
        phaseBeforeEdit: null,
        phase: 'buildings',
      },
      autoParkingGenerationStatus: 'idle',
      autoParkingGenerationError: null,
      autoParkingCandidates: [],
      autoParkingSelectedCandidateId: null,
      autoParkingSolverRun: null,
    })),

  startAutoParkingBoundaryEdit: () => {
    const state = get();
    const boundary = state.polygons.find((p) => p.id === state.autoParkingDraft.boundaryId);
    if (!boundary) return;
    set({
      autoParkingDraft: {
        ...state.autoParkingDraft,
        boundarySnapshot: boundary.points,
        phaseBeforeEdit: state.autoParkingDraft.phase,
        phase: 'boundary-edit',
      },
    });
  },

  commitAutoParkingBoundaryEdit: () => {
    const state = get();
    const draft = state.autoParkingDraft;
    const boundary = state.polygons.find((p) => p.id === draft.boundaryId);
    const anchorStillValid =
      !!draft.accessAnchor && !!boundary && isAccessAnchorValid(draft.accessAnchor, boundary.points);
    set({
      autoParkingDraft: {
        ...draft,
        boundarySnapshot: null,
        // The edge the access point sat on may have been deleted while editing —
        // unset it and reopen placement rather than keep a dangling anchor.
        accessAnchor: anchorStillValid ? draft.accessAnchor : null,
        phase: anchorStillValid ? draft.phaseBeforeEdit ?? 'ready' : 'access',
        phaseBeforeEdit: null,
      },
    });
  },

  cancelAutoParkingBoundaryEdit: () => {
    const state = get();
    const draft = state.autoParkingDraft;
    if (draft.boundaryId && draft.boundarySnapshot) {
      get().updatePolygon(draft.boundaryId, { points: draft.boundarySnapshot }, { recordHistory: false });
    }
    set({
      autoParkingDraft: {
        ...draft,
        boundarySnapshot: null,
        phase: draft.phaseBeforeEdit ?? 'ready',
        phaseBeforeEdit: null,
      },
    });
  },

  setAutoParkingBuildingMode: (mode) =>
    set((state) => ({ autoParkingDraft: { ...state.autoParkingDraft, buildingMode: mode } })),

  toggleAutoParkingBuilding: (id, source) =>
    set((state) => {
      const draft = state.autoParkingDraft;
      const exists = draft.buildingRefs.some((ref) => ref.id === id);
      const buildingRefs = exists
        ? draft.buildingRefs.filter((ref) => ref.id !== id)
        : [...draft.buildingRefs, { id, kind: 'polygon' as const, source }];
      // Only a polygon-building entrance is cleared here — untoggling a polygon
      // never removes a CAD the entrance may be attached to.
      const entrance =
        exists &&
        draft.entrance?.kind === 'building' &&
        (draft.entrance.buildingKind ?? 'polygon') === 'polygon' &&
        draft.entrance.buildingId === id
          ? null
          : draft.entrance;
      const editingVisibleLayout = draft.phaseBeforeEdit === 'compare' || draft.phaseBeforeEdit === 'editing';
      return {
        autoParkingDraft: { ...draft, buildingRefs, entrance },
        autoParkingCandidates: editingVisibleLayout ? state.autoParkingCandidates : [],
        autoParkingSelectedCandidateId: editingVisibleLayout ? state.autoParkingSelectedCandidateId : null,
        autoParkingSolverRun: editingVisibleLayout ? state.autoParkingSolverRun : null,
        autoParkingLivePreview: null,
      };
    }),

  continueAutoParkingBuildings: () =>
    set((state) => {
      const draft = state.autoParkingDraft;
      const missing = draft.buildingRefs.some(
        (ref) => !state.polygons.some((polygon) => polygon.id === ref.id),
      );
      if (missing) return state;
      const boundary = state.polygons.find((polygon) => polygon.id === draft.boundaryId);
      const entranceValid = isEntranceValid(draft.entrance, entranceBuildingsForState(state), boundary?.points);
      const returnPhase = draft.phaseBeforeEdit;
      const phase: AutoParkingPhase =
        returnPhase && entranceValid ? returnPhase : 'entrance';
      return {
        autoParkingDraft: {
          ...draft,
          entrance: entranceValid ? draft.entrance : null,
          phase,
          phaseBeforeEdit: phase === 'entrance' ? returnPhase : null,
        },
      };
    }),

  startAutoParkingBuildingsEdit: () =>
    set((state) => ({
      autoParkingDraft: {
        ...state.autoParkingDraft,
        phaseBeforeEdit: state.autoParkingDraft.phase,
        phase: 'buildings',
      },
    })),

  setAutoParkingEntrance: (entrance) =>
    set((state) => ({ autoParkingDraft: { ...state.autoParkingDraft, entrance } })),

  commitAutoParkingEntrance: (entrance) =>
    set((state) => {
      const draft = state.autoParkingDraft;
      const nextPhase: AutoParkingPhase =
        draft.phase === 'entrance-edit'
          ? draft.phaseBeforeEdit ?? (draft.accessAnchor ? 'ready' : 'access')
          : draft.phase === 'entrance' && draft.phaseBeforeEdit
            ? draft.phaseBeforeEdit
          : draft.accessAnchor
            ? 'ready'
            : 'access';
      return {
        autoParkingDraft: {
          ...draft,
          entrance,
          entranceSnapshot: null,
          phase: nextPhase,
          phaseBeforeEdit: null,
        },
      };
    }),

  startAutoParkingEntranceEdit: () =>
    set((state) => ({
      autoParkingDraft: {
        ...state.autoParkingDraft,
        entranceSnapshot: state.autoParkingDraft.entrance,
        phaseBeforeEdit: state.autoParkingDraft.phase,
        phase: 'entrance-edit',
      },
    })),

  cancelAutoParkingEntranceEdit: () =>
    set((state) => ({
      autoParkingDraft: {
        ...state.autoParkingDraft,
        entrance: state.autoParkingDraft.entranceSnapshot,
        entranceSnapshot: null,
        phase: state.autoParkingDraft.phaseBeforeEdit ?? (state.autoParkingDraft.accessAnchor ? 'ready' : 'access'),
        phaseBeforeEdit: null,
      },
    })),

  setAutoParkingAccessAnchor: (anchor) =>
    set((state) => ({ autoParkingDraft: { ...state.autoParkingDraft, accessAnchor: anchor } })),

  commitAutoParkingAccessAnchor: (anchor) =>
    set((state) => {
      const draft = state.autoParkingDraft;
      const nextPhase: AutoParkingPhase =
        draft.phase === 'access-edit' ? draft.phaseBeforeEdit ?? 'ready' : draft.phase === 'access' ? 'ready' : draft.phase;
      return {
        autoParkingDraft: {
          ...draft,
          accessAnchor: anchor,
          accessAnchorSnapshot: null,
          phase: nextPhase,
          phaseBeforeEdit: nextPhase === draft.phase ? draft.phaseBeforeEdit : null,
        },
      };
    }),

  startAutoParkingAccessEdit: () =>
    set((state) => ({
      autoParkingDraft: {
        ...state.autoParkingDraft,
        accessAnchorSnapshot: state.autoParkingDraft.accessAnchor,
        phaseBeforeEdit: state.autoParkingDraft.phase,
        phase: 'access-edit',
      },
    })),

  cancelAutoParkingAccessEdit: () =>
    set((state) => ({
      autoParkingDraft: {
        ...state.autoParkingDraft,
        accessAnchor: state.autoParkingDraft.accessAnchorSnapshot,
        accessAnchorSnapshot: null,
        phase: state.autoParkingDraft.phaseBeforeEdit ?? 'ready',
        phaseBeforeEdit: null,
      },
    })),

  updateAutoParkingSettings: (updates) =>
    set((state) => ({
      autoParkingDraft: {
        ...state.autoParkingDraft,
        settings: { ...state.autoParkingDraft.settings, ...updates },
      },
    })),

  setAutoParkingSettingsExpanded: (expanded) =>
    set((state) => ({ autoParkingDraft: { ...state.autoParkingDraft, settingsExpanded: expanded } })),

  setAutoParkingPhase: (phase) => set((state) => ({ autoParkingDraft: { ...state.autoParkingDraft, phase } })),

  resetAutoParkingDraft: () =>
    set({ autoParkingDraft: createDefaultAutoParkingDraft(), autoParkingLivePreview: null, autoParkingPreviewUpdating: false }),

  setAutoParkingGenerationStatus: (status, error = null) =>
    set({ autoParkingGenerationStatus: status, autoParkingGenerationError: error }),

  setAutoParkingCandidates: (candidates, run, selectedCandidateId) =>
    set((state) => ({
      autoParkingCandidates: candidates,
      autoParkingSolverRun: run,
      autoParkingSelectedCandidateId: selectedCandidateId ?? candidates[0]?.candidateId ?? null,
      autoParkingGenerationStatus: 'idle',
      autoParkingGenerationError: null,
      autoParkingLivePreview: null,
      autoParkingPreviewUpdating: false,
      autoParkingDraft: { ...state.autoParkingDraft, phase: candidates.length > 0 || run ? 'compare' : state.autoParkingDraft.phase },
    })),

  setAutoParkingSelectedCandidateId: (id) => set({ autoParkingSelectedCandidateId: id }),

  setAutoParkingLivePreview: (fc) => set({ autoParkingLivePreview: fc }),
  setAutoParkingPreviewUpdating: (updating) => set({ autoParkingPreviewUpdating: updating }),

  clearAutoParkingGeneration: () =>
    set({
      autoParkingGenerationStatus: 'idle',
      autoParkingGenerationError: null,
      autoParkingCandidates: [],
      autoParkingSelectedCandidateId: null,
      autoParkingSolverRun: null,
      autoParkingLivePreview: null,
      autoParkingPreviewUpdating: false,
    }),

  enterAutoParkingEditor: (layout, opts) => {
    const state = get();
    const boundary = state.polygons.find((p) => p.id === layout.boundaryId);
    const snap = boundary ? snapPointToBoundaryEdge(layout.accessPoint, boundary.points) : null;
    const anchor: AccessAnchor | null = snap ? { edgeIndex: snap.edgeIndex, distanceAlongEdgeM: snap.distanceAlongEdgeM } : null;
    const buildingRefs = layout.exclusionRefs
      .filter((ref) => ref.kind === 'polygon')
      .map((ref) => ({
        id: ref.id,
        kind: 'polygon' as const,
        source: ref.source === 'drawn' ? 'drawn' as const : 'selected' as const,
      }));
    const hasMissingBuilding = buildingRefs.some(
      (ref) => !state.polygons.some((polygon) => polygon.id === ref.id),
    );
    const entrance = layout.entrance ?? null;
    const layoutEntranceBuildings = boundary
      ? entranceBuildings({
          boundaryId: boundary.id,
          boundaryRing: boundary.points,
          buildingRefs,
          polygons: state.polygons,
          cadInstances: state.cadInstances,
          cadImages: state.cadImages,
          savedCads: state.savedCads,
        })
      : [];
    const entranceValid = isEntranceValid(entrance, layoutEntranceBuildings, boundary?.points);
    const phase: AutoParkingPhase = hasMissingBuilding
      ? 'buildings'
      : !entranceValid
        ? 'entrance'
        : anchor
          ? 'ready'
          : 'access';
    set({
      parkingMethod: 'auto',
      activeTool: 'parking',
      selectedAutoLayoutId: null,
      selectedId: null,
      selectedType: null,
      autoParkingGenerationStatus: 'idle',
      autoParkingGenerationError: null,
      autoParkingCandidates: [],
      autoParkingSelectedCandidateId: null,
      autoParkingSolverRun: null,
      autoParkingLivePreview: null,
      autoParkingPreviewUpdating: false,
      autoParkingDraft: {
        boundaryId: layout.boundaryId,
        boundarySnapshot: null,
        buildingRefs,
        buildingMode: 'select',
        entrance: entranceValid ? entrance : null,
        entranceSnapshot: null,
        accessAnchor: anchor,
        accessAnchorSnapshot: null,
        phaseBeforeEdit: null,
        settings: { ...layout.settingsSnapshot, accessibleBays: { ...layout.settingsSnapshot.accessibleBays } },
        settingsExpanded: !!opts?.expandSettings,
        phase,
        editingLayoutId: layout.id,
        pendingAutoGenerate: true,
      },
    });
  },

  consumeAutoParkingPendingGenerate: () => {
    const pending = get().autoParkingDraft.pendingAutoGenerate;
    if (pending) {
      set((state) => ({ autoParkingDraft: { ...state.autoParkingDraft, pendingAutoGenerate: false } }));
    }
    return pending;
  },

  applyAutoParkingLayout: (layout) => {
    const editingId = get().autoParkingDraft.editingLayoutId;
    // Regenerating an existing layout replaces it in place under the SAME id — never a duplicate.
    const finalLayout = editingId ? { ...layout, id: editingId } : layout;
    if (editingId) {
      get().updateAutoLayout(editingId, finalLayout);
    } else {
      get().addAutoLayout(finalLayout);
    }
    set({
      selectedAutoLayoutId: finalLayout.id,
      activeTool: 'select',
      autoParkingDraft: createDefaultAutoParkingDraft(),
      autoParkingGenerationStatus: 'idle',
      autoParkingGenerationError: null,
      autoParkingCandidates: [],
      autoParkingSelectedCandidateId: null,
      autoParkingSolverRun: null,
      autoParkingLivePreview: null,
      autoParkingPreviewUpdating: false,
    });
  },

  addAutoLayout: (layout) => {
    get().pushHistory();
    set((state) => ({
      autoLayouts: [...state.autoLayouts, layout],
      isDirty: true,
    }));
  },

  updateAutoLayout: (id, updates) => {
    get().pushHistory();
    set((state) => ({
      autoLayouts: state.autoLayouts.map((l) => (l.id === id ? { ...l, ...updates, updatedAt: Date.now() } : l)),
      isDirty: true,
    }));
  },

  deleteAutoLayout: (id) => {
    get().pushHistory();
    set((state) => ({
      autoLayouts: state.autoLayouts.filter((l) => l.id !== id),
      selectedAutoLayoutId: state.selectedAutoLayoutId === id ? null : state.selectedAutoLayoutId,
      isDirty: true,
    }));
  },

  setAutoLayouts: (layouts) => set({ autoLayouts: layouts }),

  setSelectedAutoLayoutId: (id) =>
    set({
      selectedAutoLayoutId: id,
      selectedId: id ? null : get().selectedId,
      selectedType: id ? null : get().selectedType,
      activeTool: id ? 'select' : get().activeTool,
    }),

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

    const isAutoParkingBoundary =
      state.parkingMethod === 'auto' && state.autoParkingDraft.phase === 'boundary';

    const polygon: Polygon = {
      id: `polygon-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: `Plot ${String.fromCharCode(65 + state.polygons.length)}`,
      colorIndex: state.drawingInProgress.colorIndex,
      points: state.drawingInProgress.points,
      rotation: 0,
      height: isAutoParkingBoundary ? 0 : DEFAULT_BUILDING_HEIGHT_METERS,
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

    // Only while the guided flow is actively waiting on its boundary step —
    // an unrelated plot drawn during compare/editing must not hijack it.
    if (isAutoParkingBoundary) {
      get().setAutoParkingBoundary(polygon.id);
      set({ activeTool: 'parking' });
    }

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
    const reconciledSelection = reconcileSelectionWithHistoryState(state, historyState);

    set({
      polygons: historyState.polygons,
      parkingBlocks: historyState.parkingBlocks,
      cadImages: state.cadImages, // Preserve current CAD state (legacy)
      cadInstances: state.cadInstances, // Preserve current CAD instances
      selectedId: reconciledSelection.selectedId,
      selectedType: reconciledSelection.selectedType,
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
    const reconciledSelection = reconcileSelectionWithHistoryState(state, historyState);

    set({
      polygons: historyState.polygons,
      parkingBlocks: historyState.parkingBlocks,
      cadImages: state.cadImages, // Preserve current CAD state (legacy)
      cadInstances: state.cadInstances, // Preserve current CAD instances
      selectedId: reconciledSelection.selectedId,
      selectedType: reconciledSelection.selectedType,
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
      parkingMethod: 'manual',
      autoParkingDraft: createDefaultAutoParkingDraft(),
      autoParkingGenerationStatus: 'idle',
      autoParkingGenerationError: null,
      autoParkingCandidates: [],
      autoParkingSelectedCandidateId: null,
      autoParkingSolverRun: null,
      autoParkingLivePreview: null,
      autoParkingPreviewUpdating: false,
      autoLayouts: [],
      selectedAutoLayoutId: null,
    });
  },

  loadSketch: (sketch) => {
    measurementPreviewStore.clear(); // Clear preview when loading sketch
    const { effectiveAccess } = get();

    // Extract sketch data and metadata
    const data = sketch.data;
    const cadImages = data.cadImages || [];
    const cadInstances = data.cadInstances || [];
    const autoLayouts = data.autoLayouts || [];

    set({
      polygons: data.polygons || [],
      parkingBlocks: data.parkingBlocks || [],
      // CAD / auto-layout visibility filtering (empty for non-Plus, full for Plus)
      cadImages: effectiveAccess.hasPlusAccess ? cadImages : [],
      cadInstances: effectiveAccess.hasPlusAccess ? cadInstances : [],
      autoLayouts: effectiveAccess.hasPlusAccess ? autoLayouts : [],
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
      // parkingMethod is remembered per sketch; absent (older sketches) defaults to manual.
      parkingMethod: data.settings?.parkingMethod || 'manual',
      autoParkingDraft: createDefaultAutoParkingDraft(),
      autoParkingGenerationStatus: 'idle',
      autoParkingGenerationError: null,
      autoParkingCandidates: [],
      autoParkingSelectedCandidateId: null,
      autoParkingSolverRun: null,
      autoParkingLivePreview: null,
      autoParkingPreviewUpdating: false,
      selectedAutoLayoutId: null,
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
      autoLayouts: state.autoLayouts,
      viewport: state.viewport,
      settings: {
        units: state.units,
        mapStyle: state.mapStyle,
        sideLabelsOn: state.sideLabelsOn,
        parkingMethod: state.parkingMethod,
      },
    };
  },
}));

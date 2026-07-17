import { create } from 'zustand'
import type {
  WorkspaceMode,
  InspectorTab,
  MapScale,
  WorkspaceArea,
  MapSubSelection,
  MissingFascia,
  GapRule,
  CatchmentDefinition,
  WorkspaceOverlays,
  ComparePair,
  ComparePoint,
} from '../../types/unified-workspace'

const MAX_COMPARE = 3

export const MIN_POPULATION = 5001
export const MAX_POPULATION = 1200000

interface WorkspaceState {
  // Cross-tool selection + navigation
  view: WorkspaceMode
  area: WorkspaceArea | null
  tab: InspectorTab
  selected: MapSubSelection | null
  // Transient: brand hovered in the Present Brands list, highlighting its pins.
  hoveredBrandId: string | null

  // Detail modals: a requirement (by requirementId) or a missing brand.
  reqModal: string | null
  brandModal: MissingFascia | null
  // Present-brand info modal, opened by brandId from the Present Brands list.
  brandInfoId: string | null

  // Assess brand-list filters (shared across the Missing/Present tabs).
  brandFilterCategoryIds: string[]
  brandFilterBrandIds: string[]

  // Overlays / filters
  overlays: WorkspaceOverlays
  gapRules: GapRule[]
  populationRange: [number, number]
  showSubFiveK: boolean
  catchment: CatchmentDefinition
  // Catchment tab: whether the LSOA cells are drawn on the map.
  showLsoa: boolean
  compare: WorkspaceArea[]

  // Find-Gaps map filter — gsscodes matching the active rules (null = show all).
  gapGssCodes: string[] | null

  // Assess-Area dropped pin. Scope/radius now derives from `catchment`.
  assessPoint: { lat: number; lng: number } | null

  // Compare two locations (Assess only). `compareArm` = waiting for pin B;
  // `comparePair` = the two dropped points; `pointCompareOpen` = modal visible.
  compareArm: boolean
  comparePair: ComparePair | null
  pointCompareOpen: boolean

  // Panel chrome
  leftHidden: boolean
  inspectorHidden: boolean

  // Actions
  setMode: (mode: WorkspaceMode) => void
  selectArea: (area: WorkspaceArea | null) => void
  setTab: (tab: InspectorTab) => void
  setSelected: (selected: MapSubSelection | null) => void
  setHoveredBrandId: (id: string | null) => void
  setReqModal: (requirementId: string | null) => void
  setBrandModal: (missing: MissingFascia | null) => void
  setBrandInfoId: (brandId: string | null) => void
  setBrandFilterCategoryIds: (ids: string[]) => void
  setBrandFilterBrandIds: (ids: string[]) => void
  clearBrandFilters: () => void

  toggleRoadTraffic: () => void
  toggleTrafficHeatmap: () => void
  setGapRules: (rules: GapRule[]) => void
  addGapRule: (rule: GapRule) => void
  removeGapRule: (id: string) => void
  toggleGapRule: (id: string) => void
  setPopulationRange: (range: [number, number]) => void
  setShowSubFiveK: (v: boolean) => void
  setGapGssCodes: (codes: string[] | null) => void
  setAssessPoint: (point: { lat: number; lng: number } | null) => void
  setCatchment: (catchment: CatchmentDefinition) => void
  toggleShowLsoa: () => void

  armPointCompare: () => void
  dropComparePoint: (b: ComparePoint) => void
  setPointCompareOpen: (open: boolean) => void
  clearPointCompare: () => void

  addToCompare: (area: WorkspaceArea) => void
  removeFromCompare: (id: string) => void
  clearCompare: () => void

  toggleLeft: () => void
  toggleInspector: () => void
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  view: 'assess',
  area: null,
  tab: 'missing',
  selected: null,
  hoveredBrandId: null,
  reqModal: null,
  brandModal: null,
  brandInfoId: null,

  brandFilterCategoryIds: [],
  brandFilterBrandIds: [],

  overlays: { roadTraffic: false, trafficHeatmap: false, requirements: false },
  gapRules: [],
  populationRange: [MIN_POPULATION, MAX_POPULATION],
  showSubFiveK: false,
  catchment: { mode: 'distance', value: 5 },
  showLsoa: true,
  compare: [],

  gapGssCodes: null,

  assessPoint: null,

  compareArm: false,
  comparePair: null,
  pointCompareOpen: false,

  leftHidden: false,
  inspectorHidden: false,

  // Switching modes clears the selection and resets to Missing Brands (per handoff).
  // The dirty-Sketch leave-guard is handled by the Sketch integration layer.
  setMode: (mode) =>
    set((s) => ({
      view: mode,
      area: null,
      selected: null,
      hoveredBrandId: null,
      reqModal: null,
      brandModal: null,
      brandInfoId: null,
      tab: 'missing',
      assessPoint: null,
      brandFilterCategoryIds: [],
      brandFilterBrandIds: [],
      // Leaving/switching mode tears down any in-flight point comparison.
      compareArm: false,
      comparePair: null,
      pointCompareOpen: false,
      // The requirements overlay is pin-gated; don't let it leak across a mode
      // switch and auto-re-enable when a new pin is dropped. Traffic flags persist.
      overlays: { ...s.overlays, requirements: false },
    })),

  // Selecting an area resets the tab to Missing Brands and clears sub-selection.
  selectArea: (area) =>
    set({
      area,
      tab: 'missing',
      selected: null,
      hoveredBrandId: null,
      reqModal: null,
      brandModal: null,
      brandInfoId: null,
      brandFilterCategoryIds: [],
      brandFilterBrandIds: [],
    }),

  // Tab switching is only meaningful when there's an active selection —
  // a picked built-up area or an Assess dropped point.
  setTab: (tab) => set((s) => (s.area || s.assessPoint ? { tab } : {})),

  setSelected: (selected) => set({ selected }),
  setHoveredBrandId: (hoveredBrandId) => set({ hoveredBrandId }),
  setReqModal: (reqModal) => set({ reqModal }),
  setBrandModal: (brandModal) => set({ brandModal }),
  setBrandInfoId: (brandInfoId) => set({ brandInfoId }),
  setBrandFilterCategoryIds: (brandFilterCategoryIds) =>
    set({ brandFilterCategoryIds }),
  setBrandFilterBrandIds: (brandFilterBrandIds) => set({ brandFilterBrandIds }),
  clearBrandFilters: () =>
    set({ brandFilterCategoryIds: [], brandFilterBrandIds: [] }),

  toggleRoadTraffic: () =>
    set((s) => ({
      overlays: { ...s.overlays, roadTraffic: !s.overlays.roadTraffic },
    })),
  toggleTrafficHeatmap: () =>
    set((s) => ({
      overlays: { ...s.overlays, trafficHeatmap: !s.overlays.trafficHeatmap },
    })),

  setGapRules: (gapRules) => set({ gapRules }),
  addGapRule: (rule) => set((s) => ({ gapRules: [...s.gapRules, rule] })),
  removeGapRule: (id) =>
    set((s) => ({ gapRules: s.gapRules.filter((r) => r.id !== id) })),
  toggleGapRule: (id) =>
    set((s) => ({
      gapRules: s.gapRules.map((r) => {
        if (r.id !== id) return r
        const op =
          r.op === 'has'
            ? 'lacks'
            : r.op === 'lacks'
              ? 'has'
              : r.op === 'within'
                ? 'beyond'
                : 'within'
        return { ...r, op }
      }),
    })),
  setPopulationRange: (populationRange) => set({ populationRange }),
  setShowSubFiveK: (showSubFiveK) => set({ showSubFiveK }),
  setGapGssCodes: (gapGssCodes) => set({ gapGssCodes }),
  // Dropping a new point or closing the dropped-point inspector (null) must not
  // leave a stale modal open; closing also clears the requirements overlay so
  // its pins (and now-hidden toggle) don't orphan in empty Assess mode.
  setAssessPoint: (assessPoint) =>
    set((s) => ({
      assessPoint,
      reqModal: null,
      brandModal: null,
      brandInfoId: null,
      // A new point yields a fresh landscape, so clear brand-list filters.
      brandFilterCategoryIds: [],
      brandFilterBrandIds: [],
      // Clearing the point (null) also tears down any active comparison so its
      // pins/tray don't orphan in empty Assess mode.
      ...(assessPoint
        ? {}
        : { compareArm: false, comparePair: null, pointCompareOpen: false }),
      overlays: assessPoint
        ? s.overlays
        : { ...s.overlays, requirements: false },
    })),
  setCatchment: (catchment) => set({ catchment }),
  toggleShowLsoa: () => set((s) => ({ showLsoa: !s.showLsoa })),

  // Arm the compare flow: only meaningful with a dropped point and no pair yet.
  armPointCompare: () =>
    set((s) =>
      s.assessPoint && !s.comparePair ? { compareArm: true } : {}
    ),
  // Drop pin B: pair it with the current Assess pin (pin A) and open the modal.
  dropComparePoint: (b) =>
    set((s) =>
      s.assessPoint
        ? {
            comparePair: { a: { ...s.assessPoint }, b },
            compareArm: false,
            pointCompareOpen: true,
          }
        : {}
    ),
  setPointCompareOpen: (pointCompareOpen) => set({ pointCompareOpen }),
  clearPointCompare: () =>
    set({ compareArm: false, comparePair: null, pointCompareOpen: false }),

  addToCompare: (area) =>
    set((s) => {
      if (s.compare.some((a) => a.id === area.id)) return {}
      if (s.compare.length >= MAX_COMPARE) return {}
      return { compare: [...s.compare, area] }
    }),
  removeFromCompare: (id) =>
    set((s) => ({ compare: s.compare.filter((a) => a.id !== id) })),
  clearCompare: () => set({ compare: [] }),

  toggleLeft: () => set((s) => ({ leftHidden: !s.leftHidden })),
  toggleInspector: () => set((s) => ({ inspectorHidden: !s.inspectorHidden })),
}))

// Derived helpers (kept out of state to avoid duplication).
export function selectScale(area: WorkspaceArea | null): MapScale {
  return area ? 'local' : 'national'
}

// Sketch mode uses satellite; other modes use satellite-streets (hybrid).
export function selectMapStyleKey(view: WorkspaceMode): 'satellite' | 'hybrid' {
  return view === 'sketch' ? 'satellite' : 'hybrid'
}

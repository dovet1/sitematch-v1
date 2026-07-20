import { create } from 'zustand'
import type {
  WorkspaceMode,
  InspectorTab,
  MapScale,
  WorkspaceArea,
  MapSubSelection,
  MissingFascia,
  GapRule,
  GapItem,
  GapBucket,
  GapSort,
  CatchmentDefinition,
  WorkspaceOverlays,
  ComparePair,
  CompareArm,
  LatLng,
  PlanningApplication,
} from '../../types/unified-workspace'

const MAX_COMPARE = 3

export const MIN_POPULATION = 5001
export const MAX_POPULATION = 1200000

// Radius options (km) offered per bucket; 0 = "In the town" (strict boundary match).
export const GAP_RADII = [0, 1, 3, 5, 10] as const

// Derive the API-facing GapRule[] from the two buckets. A MISSING item becomes a
// "lacks"/"beyond" rule; a HAVE item becomes a "has"/"within" rule. Radius 0 uses
// presence (in the town); radius N uses proximity within/beyond N km. This is the
// single query representation consumed by useFindGaps / useFindGapsStorePins.
export function bucketsToGapRules(
  missingItems: GapItem[],
  missingRadius: number,
  haveItems: GapItem[],
  haveRadius: number
): GapRule[] {
  const rule = (item: GapItem, radius: number, present: boolean): GapRule => {
    const base = {
      id: `${present ? 'have' : 'missing'}:${item.key}`,
      type: item.type,
      value: item.label,
      targetIds: item.targetIds,
    }
    if (radius > 0) {
      return {
        ...base,
        kind: 'proximity',
        op: present ? 'within' : 'beyond',
        km: radius,
      }
    }
    return { ...base, kind: 'presence', op: present ? 'has' : 'lacks' }
  }
  return [
    ...missingItems.map((i) => rule(i, missingRadius, false)),
    ...haveItems.map((i) => rule(i, haveRadius, true)),
  ]
}

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
  // Planning-application detail modal (Planning tab list row or map pin).
  planningModal: PlanningApplication | null

  // Assess brand-list filters (shared across the Missing/Present tabs).
  brandFilterCategoryIds: string[]
  brandFilterBrandIds: string[]

  // Overlays / filters
  overlays: WorkspaceOverlays
  // Find-Gaps "two buckets": brands/categories the town must be MISSING vs must
  // ALREADY HAVE, each with its own proximity radius (km; 0 = "In the town").
  // `gapRules` is derived from these on every mutation (see bucketsToGapRules).
  missingItems: GapItem[]
  haveItems: GapItem[]
  missingRadius: number
  haveRadius: number
  gapSort: GapSort
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
  // `activeCompareArm` = which pin the catchment control edits while comparing.
  compareArm: boolean
  comparePair: ComparePair | null
  activeCompareArm: CompareArm
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
  setPlanningModal: (app: PlanningApplication | null) => void
  setBrandFilterCategoryIds: (ids: string[]) => void
  setBrandFilterBrandIds: (ids: string[]) => void
  clearBrandFilters: () => void

  toggleRoadTraffic: () => void
  toggleTrafficHeatmap: () => void
  addBucketItem: (bucket: GapBucket, item: GapItem) => void
  removeBucketItem: (bucket: GapBucket, key: string) => void
  setBucketRadius: (bucket: GapBucket, radius: number) => void
  clearBuckets: () => void
  setGapSort: (sort: GapSort) => void
  setPopulationRange: (range: [number, number]) => void
  setShowSubFiveK: (v: boolean) => void
  setGapGssCodes: (codes: string[] | null) => void
  setAssessPoint: (point: { lat: number; lng: number } | null) => void
  setCatchment: (catchment: CatchmentDefinition) => void
  toggleShowLsoa: () => void

  armPointCompare: () => void
  dropComparePoint: (b: LatLng) => void
  setActiveCompareArm: (arm: CompareArm) => void
  setComparePointCatchment: (arm: CompareArm, catchment: CatchmentDefinition) => void
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
  planningModal: null,

  brandFilterCategoryIds: [],
  brandFilterBrandIds: [],

  overlays: { roadTraffic: false, trafficHeatmap: false, requirements: false },
  missingItems: [],
  haveItems: [],
  missingRadius: 0,
  haveRadius: 5,
  gapSort: 'pop',
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
  activeCompareArm: 'a',
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
      planningModal: null,
      tab: 'missing',
      assessPoint: null,
      brandFilterCategoryIds: [],
      brandFilterBrandIds: [],
      // Leaving/switching mode tears down any in-flight point comparison.
      compareArm: false,
      comparePair: null,
      activeCompareArm: 'a',
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
      planningModal: null,
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
  setPlanningModal: (planningModal) => set({ planningModal }),
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

  // Bucket mutations recompute the derived gapRules in the same set() so the
  // downstream find/map hooks always read a consistent query.
  addBucketItem: (bucket, item) =>
    set((s) => {
      const missingItems =
        bucket === 'missing'
          ? s.missingItems.some((i) => i.key === item.key)
            ? s.missingItems
            : [...s.missingItems, item]
          : s.missingItems
      const haveItems =
        bucket === 'have'
          ? s.haveItems.some((i) => i.key === item.key)
            ? s.haveItems
            : [...s.haveItems, item]
          : s.haveItems
      return {
        missingItems,
        haveItems,
        gapRules: bucketsToGapRules(
          missingItems,
          s.missingRadius,
          haveItems,
          s.haveRadius
        ),
      }
    }),
  removeBucketItem: (bucket, key) =>
    set((s) => {
      const missingItems =
        bucket === 'missing'
          ? s.missingItems.filter((i) => i.key !== key)
          : s.missingItems
      const haveItems =
        bucket === 'have'
          ? s.haveItems.filter((i) => i.key !== key)
          : s.haveItems
      return {
        missingItems,
        haveItems,
        gapRules: bucketsToGapRules(
          missingItems,
          s.missingRadius,
          haveItems,
          s.haveRadius
        ),
      }
    }),
  setBucketRadius: (bucket, radius) =>
    set((s) => {
      const missingRadius = bucket === 'missing' ? radius : s.missingRadius
      const haveRadius = bucket === 'have' ? radius : s.haveRadius
      return {
        missingRadius,
        haveRadius,
        gapRules: bucketsToGapRules(
          s.missingItems,
          missingRadius,
          s.haveItems,
          haveRadius
        ),
      }
    }),
  clearBuckets: () =>
    set({ missingItems: [], haveItems: [], gapRules: [] }),
  setGapSort: (gapSort) => set({ gapSort }),
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
      planningModal: null,
      // A new point yields a fresh landscape, so clear brand-list filters.
      brandFilterCategoryIds: [],
      brandFilterBrandIds: [],
      // Clearing the point (null) also tears down any active comparison so its
      // pins/tray don't orphan in empty Assess mode.
      ...(assessPoint
        ? {}
        : {
            compareArm: false,
            comparePair: null,
            activeCompareArm: 'a' as CompareArm,
            pointCompareOpen: false,
          }),
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
  // Drop pin B: pair it with the current Assess pin (pin A). Both pins inherit
  // the current global catchment as a starting point; the surveyor then tweaks
  // each independently. The freshly dropped pin B is made active so it's editable
  // immediately, and the modal stays closed — it opens on demand from the tray.
  dropComparePoint: (b) =>
    set((s) =>
      s.assessPoint
        ? {
            comparePair: {
              a: { ...s.assessPoint, catchment: s.catchment },
              b: { ...b, catchment: s.catchment },
            },
            compareArm: false,
            activeCompareArm: 'b',
            pointCompareOpen: false,
          }
        : {}
    ),
  setActiveCompareArm: (activeCompareArm) => set({ activeCompareArm }),
  setComparePointCatchment: (arm, catchment) =>
    set((s) =>
      s.comparePair
        ? {
            comparePair: {
              ...s.comparePair,
              [arm]: { ...s.comparePair[arm], catchment },
            },
          }
        : {}
    ),
  setPointCompareOpen: (pointCompareOpen) => set({ pointCompareOpen }),
  // Clearing restores the single-pin global catchment from pin A (the surviving
  // assessPoint), so the lone pin never inherits pin B's catchment.
  clearPointCompare: () =>
    set((s) => ({
      compareArm: false,
      comparePair: null,
      activeCompareArm: 'a',
      pointCompareOpen: false,
      ...(s.comparePair ? { catchment: s.comparePair.a.catchment } : {}),
    })),

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

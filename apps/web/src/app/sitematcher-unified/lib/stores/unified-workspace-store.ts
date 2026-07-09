import { create } from 'zustand'
import type {
  WorkspaceMode,
  InspectorTab,
  MapScale,
  WorkspaceArea,
  MapSubSelection,
  GapRule,
  CatchmentDefinition,
  WorkspaceOverlays,
} from '../../types/unified-workspace'

const MAX_COMPARE = 3

interface WorkspaceState {
  // Cross-tool selection + navigation
  view: WorkspaceMode
  area: WorkspaceArea | null
  tab: InspectorTab
  selected: MapSubSelection | null

  // Overlays / filters
  overlays: WorkspaceOverlays
  gapRules: GapRule[]
  catchment: CatchmentDefinition
  compare: WorkspaceArea[]

  // Panel chrome
  leftHidden: boolean
  inspectorHidden: boolean

  // Actions
  setMode: (mode: WorkspaceMode) => void
  selectArea: (area: WorkspaceArea | null) => void
  setTab: (tab: InspectorTab) => void
  setSelected: (selected: MapSubSelection | null) => void

  toggleTraffic: () => void
  setGapRules: (rules: GapRule[]) => void
  addGapRule: (rule: GapRule) => void
  removeGapRule: (id: string) => void
  setCatchment: (catchment: CatchmentDefinition) => void

  addToCompare: (area: WorkspaceArea) => void
  removeFromCompare: (id: string) => void
  clearCompare: () => void

  toggleLeft: () => void
  toggleInspector: () => void
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  view: 'assess',
  area: null,
  tab: 'summary',
  selected: null,

  overlays: { traffic: false },
  gapRules: [],
  catchment: { mode: 'distance', value: 10 },
  compare: [],

  leftHidden: false,
  inspectorHidden: false,

  // Switching modes clears the selection and resets to Summary (per handoff).
  // The dirty-Sketch leave-guard is handled by the Sketch integration layer.
  setMode: (mode) =>
    set({ view: mode, area: null, selected: null, tab: 'summary' }),

  // Selecting an area resets the tab to Summary and clears sub-selection.
  selectArea: (area) => set({ area, tab: 'summary', selected: null }),

  // Tab switching is only meaningful when an area is selected.
  setTab: (tab) => set((s) => (s.area ? { tab } : {})),

  setSelected: (selected) => set({ selected }),

  toggleTraffic: () =>
    set((s) => ({ overlays: { ...s.overlays, traffic: !s.overlays.traffic } })),

  setGapRules: (gapRules) => set({ gapRules }),
  addGapRule: (rule) => set((s) => ({ gapRules: [...s.gapRules, rule] })),
  removeGapRule: (id) =>
    set((s) => ({ gapRules: s.gapRules.filter((r) => r.id !== id) })),
  setCatchment: (catchment) => set({ catchment }),

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

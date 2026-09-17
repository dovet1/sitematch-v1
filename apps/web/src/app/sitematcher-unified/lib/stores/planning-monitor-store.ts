import { create } from 'zustand'
import { defaultCriteria, type FilterCapabilities, type MonitorCriteria } from '@/lib/planning-monitor/criteria'
import type { BBox, DigestHighlight, MonitorPatch, MonitorRow, MonitorScope } from '@/lib/planning-monitor/types'
import { stackItemKey, type StackItem } from '../planning-monitor-ui'

/**
 * Planning mode's transient state. Saved patches and their criteria live in the database; this
 * store holds what the user is looking at: scope, the left panel's step, the drawing in progress,
 * the viewport, the shared row/pin selection, and whether the weekly summary is open. Browsing
 * Whole UK or panning never changes a saved patch.
 *
 * The design allows one patch per user. The API still returns a list; the first (most recently
 * updated) is the patch.
 */

export interface PlanningViewport {
  bbox: BBox
  zoom: number
}

export type LngLat = [number, number]

/** A shape being drawn (a new patch) or reshaped (the saved patch's boundary). */
export interface PlanningDrawing {
  mode: 'new' | 'edit'
  vertices: LngLat[]
  closed: boolean
}

/** Where a stacked pin's list came from, so it can be read again. */
export interface StackPick {
  cellKey: string
  lngLat: LngLat
  count: number
  /** The cluster request's zoom; the cell key is only meaningful with it. */
  zoom: number | null
  /** An archived week's points, already known. */
  highlights: DigestHighlight[] | null
}

/** The list a stacked pin opened. `items` is null while it loads. */
export interface PlanningStack {
  id: string
  pick: StackPick
  items: StackItem[] | null
  /** More matched than one page holds. */
  more: boolean
  error: string | null
}

export type PlanningPanel = 'home' | 'filters' | 'draw' | 'name'
/** Which criteria the All filters panel edits. */
export type FiltersTarget = 'uk' | 'patch' | 'draft'

interface PlanningMonitorState {
  scope: MonitorScope
  patches: MonitorPatch[]
  patchesLoaded: boolean
  patchesError: string | null
  capabilities: FilterCapabilities | null
  activePatchId: string | null
  /** Criteria in force for Whole UK. With a patch in My patch, its saved criteria apply. */
  browseCriteria: MonitorCriteria
  viewport: PlanningViewport | null

  /** One selection shared by the list, the map and the detail card. */
  selected: MonitorRow | null
  hoveredKey: string | null
  hoverSource: 'map' | 'list' | null
  expandedKeys: string[]
  /** The list opened from a pin holding several applications; kept while one of them is open. */
  stack: PlanningStack | null
  /** A stacked pin under the pointer, for its tooltip. */
  hoverStack: { key: string; lngLat: LngLat; count: number } | null

  panel: PlanningPanel
  filtersTarget: FiltersTarget
  drawing: PlanningDrawing | null
  /** The new patch's filters in the name step, inherited from the view it was drawn from. */
  draftCriteria: MonitorCriteria | null

  summaryOpen: boolean
  /** The week the summary shows; null is the latest. */
  summaryRunId: string | null
  /** Set while an older week is shown: the map shows only that week's applications. */
  archivedWeek: { runId: string; points: DigestHighlight[] } | null

  menu: 'panel' | 'map' | null
  renaming: boolean
  deleteOpen: boolean
  /** Bumped when a save or watch should refetch. */
  revision: number

  setScope: (scope: MonitorScope) => void
  setPatches: (patches: MonitorPatch[], capabilities: FilterCapabilities) => void
  setPatchesError: (error: string | null) => void
  upsertPatch: (patch: MonitorPatch) => void
  removePatch: (patchId: string) => void
  setActivePatch: (patchId: string | null) => void
  setBrowseCriteria: (criteria: MonitorCriteria) => void
  setViewport: (viewport: PlanningViewport) => void
  select: (row: MonitorRow | null) => void
  setHovered: (key: string | null, source: 'map' | 'list') => void
  toggleExpanded: (key: string) => void
  openStack: (stack: PlanningStack) => void
  setStackItems: (id: string, items: StackItem[], more: boolean) => void
  setStackError: (id: string, error: string) => void
  /** From a detail card opened out of a stack, back to the stack's list. */
  backToStack: () => void
  setHoverStack: (hover: { key: string; lngLat: LngLat; count: number } | null) => void

  openFilters: (target: FiltersTarget) => void
  closeFilters: () => void
  setDraftCriteria: (criteria: MonitorCriteria) => void

  startDraw: (fromCriteria: MonitorCriteria) => void
  startBoundaryEdit: (vertices: LngLat[]) => void
  addVertex: (point: LngLat) => void
  undoVertex: () => void
  moveVertex: (index: number, point: LngLat) => void
  insertVertex: (index: number, point: LngLat) => void
  removeVertex: (index: number) => void
  closeShape: () => void
  clearDrawing: () => void
  toNameStep: () => void
  backToDraw: () => void
  endDrawing: () => void

  openSummary: (runId?: string | null) => void
  closeSummary: () => void
  showWeek: (runId: string | null, archived: { runId: string; points: DigestHighlight[] } | null) => void

  setMenu: (menu: 'panel' | 'map' | null) => void
  setRenaming: (renaming: boolean) => void
  setDeleteOpen: (open: boolean) => void
  markWatched: (applicationId: string, developmentId: string | null, watched: boolean) => void
  bump: () => void
  reset: () => void
}

const idle = {
  selected: null,
  stack: null,
  hoverStack: null,
  hoveredKey: null,
  hoverSource: null,
  panel: 'home' as PlanningPanel,
  drawing: null,
  draftCriteria: null,
  summaryOpen: false,
  summaryRunId: null,
  archivedWeek: null,
  menu: null,
  renaming: false,
  deleteOpen: false,
}

export const usePlanningMonitorStore = create<PlanningMonitorState>((set) => ({
  scope: 'uk',
  patches: [],
  patchesLoaded: false,
  patchesError: null,
  capabilities: null,
  activePatchId: null,
  browseCriteria: defaultCriteria(),
  viewport: null,
  expandedKeys: [],
  filtersTarget: 'uk',
  revision: 0,
  ...idle,

  setScope: (scope) =>
    set((s) => (scope === 'patch' && !s.activePatchId ? {} : { scope, selected: null, stack: null, expandedKeys: [], summaryOpen: false, archivedWeek: null })),
  // First load: open on My patch when a saved patch exists, otherwise Whole UK.
  setPatches: (patches, capabilities) =>
    set((s) => {
      const active = s.activePatchId && patches.some((p) => p.id === s.activePatchId) ? s.activePatchId : patches[0]?.id ?? null
      const patch = patches.find((p) => p.id === active)
      return {
        // Whole UK starts from the patch's filters, so switching scope only lifts the boundary.
        // Editing them there changes the browsing copy, never the saved patch.
        browseCriteria: !s.patchesLoaded && patch ? structuredClone(patch.criteria) : s.browseCriteria,
        patches,
        capabilities,
        patchesLoaded: true,
        patchesError: null,
        activePatchId: active,
        scope: s.patchesLoaded ? (active ? s.scope : 'uk') : active ? 'patch' : 'uk',
      }
    }),
  setPatchesError: (patchesError) => set({ patchesError, patchesLoaded: true }),
  upsertPatch: (patch) =>
    set((s) => ({
      patches: [patch, ...s.patches.filter((p) => p.id !== patch.id)],
      activePatchId: patch.id,
      browseCriteria: structuredClone(patch.criteria),
      scope: 'patch',
      selected: null,
      stack: null,
      revision: s.revision + 1,
    })),
  removePatch: (patchId) =>
    set((s) => {
      const patches = s.patches.filter((p) => p.id !== patchId)
      const activePatchId = s.activePatchId === patchId ? patches[0]?.id ?? null : s.activePatchId
      return { ...idle, patches, activePatchId, scope: activePatchId ? s.scope : 'uk', revision: s.revision + 1 }
    }),
  setActivePatch: (activePatchId) => set({ activePatchId, selected: null, stack: null, scope: activePatchId ? 'patch' : 'uk' }),
  setBrowseCriteria: (browseCriteria) => set({ browseCriteria, selected: null, stack: null }),
  setViewport: (viewport) => set({ viewport }),
  // Clearing the selection closes a stack too; opening something outside the stack leaves it.
  select: (selected) =>
    set((s) => ({
      selected,
      stack: selected && s.stack?.items?.some((item) => stackItemKey(item) === selected.key) ? s.stack : null,
    })),
  setHovered: (hoveredKey, source) => set({ hoveredKey, hoverSource: hoveredKey ? source : null }),
  openStack: (stack) => set({ stack, selected: null, hoverStack: null }),
  setStackItems: (id, items, more) =>
    set((s) => (s.stack?.id === id ? { stack: { ...s.stack, items, more, error: null } } : {})),
  setStackError: (id, error) =>
    set((s) => (s.stack?.id === id ? { stack: { ...s.stack, items: [], more: false, error } } : {})),
  backToStack: () => set({ selected: null }),
  setHoverStack: (hoverStack) => set({ hoverStack }),
  toggleExpanded: (key) =>
    set((s) => ({ expandedKeys: s.expandedKeys.includes(key) ? s.expandedKeys.filter((k) => k !== key) : [...s.expandedKeys, key] })),

  openFilters: (filtersTarget) => set({ panel: 'filters', filtersTarget, menu: null }),
  // Filters opened from the name step return there; otherwise home.
  closeFilters: () => set((s) => ({ panel: s.filtersTarget === 'draft' ? 'name' : 'home' })),
  setDraftCriteria: (draftCriteria) => set({ draftCriteria }),

  startDraw: (fromCriteria) =>
    set({
      ...idle,
      panel: 'draw',
      drawing: { mode: 'new', vertices: [], closed: false },
      draftCriteria: structuredClone(fromCriteria),
    }),
  startBoundaryEdit: (vertices) =>
    set({ ...idle, panel: 'home', scope: 'patch', drawing: { mode: 'edit', vertices, closed: true } }),
  addVertex: (point) =>
    set((s) => (s.drawing && !s.drawing.closed ? { drawing: { ...s.drawing, vertices: [...s.drawing.vertices, point] } } : {})),
  undoVertex: () =>
    set((s) => {
      if (!s.drawing || s.drawing.mode !== 'new') return {}
      // Undo after closing reopens the shape first, so the last point is not lost by surprise.
      if (s.drawing.closed) return { drawing: { ...s.drawing, closed: false } }
      return { drawing: { ...s.drawing, vertices: s.drawing.vertices.slice(0, -1) } }
    }),
  moveVertex: (index, point) =>
    set((s) => {
      if (!s.drawing) return {}
      const vertices = [...s.drawing.vertices]
      vertices[index] = point
      return { drawing: { ...s.drawing, vertices } }
    }),
  insertVertex: (index, point) =>
    set((s) => {
      if (!s.drawing) return {}
      const vertices = [...s.drawing.vertices]
      vertices.splice(index, 0, point)
      return { drawing: { ...s.drawing, vertices } }
    }),
  removeVertex: (index) =>
    set((s) => {
      // A closed shape keeps at least a triangle.
      if (!s.drawing || (s.drawing.closed && s.drawing.vertices.length <= 3)) return {}
      return { drawing: { ...s.drawing, vertices: s.drawing.vertices.filter((_, i) => i !== index) } }
    }),
  closeShape: () => set((s) => (s.drawing && s.drawing.vertices.length >= 3 ? { drawing: { ...s.drawing, closed: true } } : {})),
  clearDrawing: () => set((s) => (s.drawing ? { drawing: { ...s.drawing, vertices: [], closed: false }, panel: 'draw' } : {})),
  toNameStep: () => set((s) => (s.drawing?.closed ? { panel: 'name' } : {})),
  backToDraw: () => set({ panel: 'draw' }),
  endDrawing: () => set({ drawing: null, draftCriteria: null, panel: 'home' }),

  openSummary: (runId = null) => set({ summaryOpen: true, summaryRunId: runId, selected: null, stack: null, menu: null, scope: 'patch' }),
  closeSummary: () => set({ summaryOpen: false, summaryRunId: null, archivedWeek: null, stack: null }),
  showWeek: (summaryRunId, archivedWeek) => set({ summaryRunId, archivedWeek, stack: null }),

  setMenu: (menu) => set({ menu }),
  setRenaming: (renaming) => set({ renaming, menu: null, panel: 'home' }),
  setDeleteOpen: (deleteOpen) => set({ deleteOpen, menu: null }),
  markWatched: (applicationId, developmentId, watched) =>
    set((s) => ({
      selected:
        s.selected && (s.selected.applicationId === applicationId || (developmentId && s.selected.developmentId === developmentId))
          ? { ...s.selected, watched }
          : s.selected,
      revision: s.revision + 1,
    })),
  bump: () => set((s) => ({ revision: s.revision + 1 })),
  reset: () => set({ ...idle, expandedKeys: [] }),
}))

/** The user's one patch. */
export function selectPatch(s: Pick<PlanningMonitorState, 'patches' | 'activePatchId'>): MonitorPatch | null {
  return s.patches.find((p) => p.id === s.activePatchId) ?? null
}

/** The criteria in force: the patch's saved criteria in My patch, the browsing criteria in Whole UK. */
export function selectActiveCriteria(s: Pick<PlanningMonitorState, 'patches' | 'activePatchId' | 'browseCriteria' | 'scope'>): MonitorCriteria {
  if (s.scope === 'patch') return selectPatch(s)?.criteria ?? s.browseCriteria
  return s.browseCriteria
}

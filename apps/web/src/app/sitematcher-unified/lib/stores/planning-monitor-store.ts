import { create } from 'zustand'
import { defaultCriteria, type FilterCapabilities, type MonitorCriteria } from '@/lib/planning-monitor/criteria'
import type { BBox, MonitorGrouping, MonitorPatch, MonitorRow, MonitorScope } from '@/lib/planning-monitor/types'

/**
 * Planning mode's transient state. Saved patches and their criteria live in the database; this
 * store holds what the user is looking at: scope, active patch, grouping, viewport, selection,
 * and whether the criteria editor or a report is open. Browsing All UK or panning never changes a
 * saved patch.
 */

export interface PlanningViewport {
  bbox: BBox
  zoom: number
}

interface PlanningMonitorState {
  scope: MonitorScope
  patches: MonitorPatch[]
  patchesLoaded: boolean
  patchesError: string | null
  capabilities: FilterCapabilities | null
  activePatchId: string | null
  /** Criteria in force for All UK browsing when no patch exists. With a patch, its saved criteria apply. */
  browseCriteria: MonitorCriteria
  grouping: MonitorGrouping
  viewport: PlanningViewport | null
  selected: MonitorRow | null
  hoveredKey: string | null
  /** 'new' opens the editor for a new patch; a patch id edits that patch. */
  editor: 'new' | string | null
  reportRunId: string | null
  notificationsOpen: boolean
  mobilePane: 'map' | 'list'
  /** Bumped when a save or watch should refetch. */
  revision: number

  setScope: (scope: MonitorScope) => void
  setPatches: (patches: MonitorPatch[], capabilities: FilterCapabilities) => void
  setPatchesError: (error: string | null) => void
  upsertPatch: (patch: MonitorPatch) => void
  removePatch: (patchId: string) => void
  setActivePatch: (patchId: string | null) => void
  setGrouping: (grouping: MonitorGrouping) => void
  setViewport: (viewport: PlanningViewport) => void
  select: (row: MonitorRow | null) => void
  setHoveredKey: (key: string | null) => void
  openEditor: (target: 'new' | string) => void
  closeEditor: () => void
  openReport: (runId: string | null) => void
  setNotificationsOpen: (open: boolean) => void
  setMobilePane: (pane: 'map' | 'list') => void
  markWatched: (applicationId: string, developmentId: string | null, watched: boolean) => void
  bump: () => void
  reset: () => void
}

export const usePlanningMonitorStore = create<PlanningMonitorState>((set) => ({
  scope: 'uk',
  patches: [],
  patchesLoaded: false,
  patchesError: null,
  capabilities: null,
  activePatchId: null,
  browseCriteria: defaultCriteria(),
  grouping: 'developments',
  viewport: null,
  selected: null,
  hoveredKey: null,
  editor: null,
  reportRunId: null,
  notificationsOpen: false,
  mobilePane: 'map',
  revision: 0,

  setScope: (scope) => set((s) => (scope === 'patch' && !s.activePatchId ? {} : { scope, selected: null })),
  // First load: start in My patch when a saved patch exists, otherwise All UK.
  setPatches: (patches, capabilities) =>
    set((s) => {
      const active = s.activePatchId && patches.some((p) => p.id === s.activePatchId) ? s.activePatchId : patches[0]?.id ?? null
      return {
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
      scope: 'patch',
      selected: null,
      revision: s.revision + 1,
    })),
  removePatch: (patchId) =>
    set((s) => {
      const patches = s.patches.filter((p) => p.id !== patchId)
      const activePatchId = s.activePatchId === patchId ? patches[0]?.id ?? null : s.activePatchId
      return { patches, activePatchId, scope: activePatchId ? s.scope : 'uk', selected: null }
    }),
  setActivePatch: (activePatchId) => set({ activePatchId, selected: null, scope: activePatchId ? 'patch' : 'uk' }),
  setGrouping: (grouping) => set({ grouping, selected: null }),
  setViewport: (viewport) => set({ viewport }),
  select: (selected) => set({ selected }),
  setHoveredKey: (hoveredKey) => set({ hoveredKey }),
  openEditor: (editor) => set({ editor }),
  closeEditor: () => set({ editor: null }),
  openReport: (reportRunId) => set({ reportRunId }),
  setNotificationsOpen: (notificationsOpen) => set({ notificationsOpen }),
  setMobilePane: (mobilePane) => set({ mobilePane }),
  markWatched: (applicationId, developmentId, watched) =>
    set((s) => ({
      selected:
        s.selected && (s.selected.applicationId === applicationId || (developmentId && s.selected.developmentId === developmentId))
          ? { ...s.selected, watched }
          : s.selected,
      revision: s.revision + 1,
    })),
  bump: () => set((s) => ({ revision: s.revision + 1 })),
  reset: () => set({ selected: null, hoveredKey: null, editor: null, reportRunId: null, notificationsOpen: false }),
}))

/** The criteria in force: the active patch's saved criteria, or the browsing defaults. */
export function selectActiveCriteria(s: Pick<PlanningMonitorState, 'patches' | 'activePatchId' | 'browseCriteria'>): MonitorCriteria {
  return s.patches.find((p) => p.id === s.activePatchId)?.criteria ?? s.browseCriteria
}

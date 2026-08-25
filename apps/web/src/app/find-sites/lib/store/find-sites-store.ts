import { create } from 'zustand'
import type {
  FindSitesItem,
  FindSitesResponse,
  FindSitesSearchParams,
} from '@/lib/site-matching/find-sites-dto'
import { searchFindSites, FindSitesAbortError } from '../services/find-sites-service'

export type FindSitesStatus = 'idle' | 'loading' | 'ready' | 'error'

/** The editable brief the setup panel drives. Kept separate from the server DTO so the UI can
 *  hold in-flight edits before a search is run. */
export interface FindSitesBrief {
  preset: FindSitesSearchParams['preset']
  brandId: string | null
  brandName: string | null
  fasciaIds: string[] | null
  minMiles: number
}

export const DEFAULT_BRIEF: FindSitesBrief = {
  preset: 'drive-thru',
  brandId: null,
  brandName: null,
  fasciaIds: null,
  minMiles: 1,
}

interface FindSitesState {
  brief: FindSitesBrief
  status: FindSitesStatus
  error: string | null
  response: FindSitesResponse | null
  /** The parcel selected in the list / on the map / open in the detail panel. */
  selectedSiteId: string | null

  setBrief: (patch: Partial<FindSitesBrief>) => void
  /** Run the read-only search for the current brief. Cancels any in-flight request. */
  runSearch: () => Promise<void>
  select: (siteId: string | null) => void
  reset: () => void
}

// Module-scoped controller so a new search (or a reset) cancels the previous fetch. Kept out of
// the store state because it is not render-relevant.
let inFlight: AbortController | null = null

export const useFindSitesStore = create<FindSitesState>((set, get) => ({
  brief: DEFAULT_BRIEF,
  status: 'idle',
  error: null,
  response: null,
  selectedSiteId: null,

  setBrief: (patch) => set((s) => ({ brief: { ...s.brief, ...patch } })),

  runSearch: async () => {
    inFlight?.abort()
    const controller = new AbortController()
    inFlight = controller
    const { brief } = get()
    set({ status: 'loading', error: null })
    try {
      const response = await searchFindSites(
        {
          preset: brief.preset,
          brandId: brief.brandId,
          fasciaIds: brief.fasciaIds,
          minMiles: brief.minMiles,
        },
        controller.signal
      )
      if (controller.signal.aborted) return
      set({ status: 'ready', response, selectedSiteId: response.items[0]?.siteId ?? null })
    } catch (err) {
      if (err instanceof FindSitesAbortError || controller.signal.aborted) return
      set({ status: 'error', error: err instanceof Error ? err.message : 'Search failed' })
    } finally {
      if (inFlight === controller) inFlight = null
    }
  },

  select: (siteId) => set({ selectedSiteId: siteId }),

  reset: () => {
    inFlight?.abort()
    inFlight = null
    set({ status: 'idle', error: null, response: null, selectedSiteId: null, brief: DEFAULT_BRIEF })
  },
}))

/** Selector helper: the currently-selected item (or null). */
export function selectSelectedItem(s: FindSitesState): FindSitesItem | null {
  if (!s.selectedSiteId || !s.response) return null
  return s.response.items.find((i) => i.siteId === s.selectedSiteId) ?? null
}

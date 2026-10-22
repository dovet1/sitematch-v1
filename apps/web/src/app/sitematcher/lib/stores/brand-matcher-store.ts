import { create } from 'zustand'
import { fetchBrandMatches, fetchBrandMatcherStats } from '../services/brand-matcher-service'
import {
  BRAND_REPORT_MAX,
  type BrandMatcherResponse,
  type BrandMatcherSort,
  type BrandMatcherQueryUseClass,
} from '../../types/brand-matcher'

// Brand Matcher mode state. Deliberately NOT reset by the workspace's setMode: a surveyor who
// hops to Assess and back should find their ranked list where they left it.

export type BrandMatcherPhase = 'hero' | 'scanning' | 'results'

export interface BrandMatcherForm {
  sqft: string
  useClass: BrandMatcherQueryUseClass
  postcode: string
}

interface BrandMatcherState {
  phase: BrandMatcherPhase
  form: BrandMatcherForm
  // Set once the request resolves; the scanning screen hands over when its sequence finishes.
  result: BrandMatcherResponse | null
  elapsedMs: number | null
  error: string | null
  sort: BrandMatcherSort
  // Sector filter on the results (brandSector ids, or NO_SECTOR). Empty = every sector.
  sectors: string[]
  expandedId: string | null
  brandsTracked: number | null
  // Brands ticked for the PDF report (at most BRAND_REPORT_MAX), kept for this search only.
  selectedIds: string[]

  setForm: (patch: Partial<BrandMatcherForm>) => void
  loadStats: () => void
  run: (opts?: { widen?: boolean }) => Promise<void>
  showResults: () => void
  editSite: () => void
  setSort: (sort: BrandMatcherSort) => void
  setSectors: (sectors: string[]) => void
  setExpanded: (id: string | null) => void
  // 'full' when the brand could not be added because the report is at its limit.
  toggleSelected: (id: string) => 'added' | 'removed' | 'full'
  setSelected: (ids: string[]) => void
}

let inflight: AbortController | null = null
let statsRequested = false

export const useBrandMatcherStore = create<BrandMatcherState>((set, get) => ({
  phase: 'hero',
  form: { sqft: '', useClass: 'E', postcode: '' },
  result: null,
  elapsedMs: null,
  error: null,
  sort: 'best',
  sectors: [],
  expandedId: null,
  brandsTracked: null,
  selectedIds: [],

  setForm: (patch) => set((s) => ({ form: { ...s.form, ...patch }, error: null })),

  loadStats: () => {
    if (statsRequested) return
    statsRequested = true
    fetchBrandMatcherStats()
      .then((s) => set({ brandsTracked: s.brandsTracked }))
      .catch(() => {
        // The stat line is decoration; the form still works without it. Allow a retry.
        statsRequested = false
      })
  },

  run: async (opts) => {
    const { form } = get()
    const sqft = Number(form.sqft.replace(/[,\s]/g, ''))
    if (!Number.isFinite(sqft) || sqft <= 0) {
      set({ error: 'Enter the unit size in sq ft' })
      return
    }
    if (!form.postcode.trim()) {
      set({ error: 'Enter the site postcode' })
      return
    }

    inflight?.abort()
    const controller = new AbortController()
    inflight = controller
    const started = performance.now()
    set({ phase: 'scanning', result: null, error: null, expandedId: null, elapsedMs: null, selectedIds: [] })

    try {
      const result = await fetchBrandMatches(
        { sqft, useClass: form.useClass, postcode: form.postcode, widen: opts?.widen ?? false },
        controller.signal
      )
      if (inflight !== controller) return
      set({
        result,
        elapsedMs: performance.now() - started,
        // One card open at a time; the top match opens so the evidence is visible at once.
        expandedId: result.matches[0]?.brandId ?? null,
        form: { ...get().form, postcode: result.site.postcode },
      })
    } catch (e) {
      if (controller.signal.aborted) return
      set({ phase: 'hero', error: e instanceof Error ? e.message : 'Something went wrong' })
    } finally {
      if (inflight === controller) inflight = null
    }
  },

  showResults: () => {
    if (get().result) set({ phase: 'results' })
  },

  editSite: () => {
    inflight?.abort()
    inflight = null
    set({ phase: 'hero', error: null })
  },

  setSort: (sort) => set({ sort }),
  setSectors: (sectors) => set({ sectors }),
  setExpanded: (expandedId) => set({ expandedId }),

  toggleSelected: (id) => {
    const ids = get().selectedIds
    if (ids.includes(id)) {
      set({ selectedIds: ids.filter((x) => x !== id) })
      return 'removed'
    }
    if (ids.length >= BRAND_REPORT_MAX) return 'full'
    set({ selectedIds: [...ids, id] })
    return 'added'
  },
  setSelected: (ids) => set({ selectedIds: Array.from(new Set(ids)).slice(0, BRAND_REPORT_MAX) }),
}))

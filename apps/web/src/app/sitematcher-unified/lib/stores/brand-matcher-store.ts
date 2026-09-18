import { create } from 'zustand'
import { fetchBrandMatches, fetchBrandMatcherStats } from '../services/brand-matcher-service'
import type {
  BrandMatcherResponse,
  BrandMatcherSort,
  BrandMatcherUseClass,
} from '../../types/brand-matcher'

// Brand Matcher mode state. Deliberately NOT reset by the workspace's setMode: a surveyor who
// hops to Assess and back should find their ranked list where they left it.

export type BrandMatcherPhase = 'hero' | 'scanning' | 'results'

export interface BrandMatcherForm {
  sqft: string
  useClass: BrandMatcherUseClass
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
  expandedId: string | null
  brandsTracked: number | null

  setForm: (patch: Partial<BrandMatcherForm>) => void
  loadStats: () => void
  run: (opts?: { widen?: boolean }) => Promise<void>
  showResults: () => void
  editSite: () => void
  setSort: (sort: BrandMatcherSort) => void
  setExpanded: (id: string | null) => void
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
  expandedId: null,
  brandsTracked: null,

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
    set({ phase: 'scanning', result: null, error: null, expandedId: null, elapsedMs: null })

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
  setExpanded: (expandedId) => set({ expandedId }),
}))

'use client'

import { useEffect, useRef, useState } from 'react'
import type { FindSitesPreset } from '@/lib/site-matching/find-sites-dto'
import { useFindSitesStore } from '../lib/store/find-sites-store'

const PRESETS: { key: FindSitesPreset; name: string; blurb: string }[] = [
  { key: 'drive-thru', name: 'Drive-thru (small roadside)', blurb: '0.3–0.7 ac · fronting an A/B road' },
  { key: 'roadside', name: 'Roadside / commercial', blurb: '0.25–1.5 ac · near a classified road' },
  { key: 'retail', name: 'Retail / leisure (larger)', blurb: '1–6 ac · classified-road relationship' },
  { key: 'industrial', name: 'Industrial / logistics', blurb: '2–25 ac · strategic-road access' },
]

interface BrandHit {
  id: string
  name: string
}

export function RequirementSetup() {
  const brief = useFindSitesStore((s) => s.brief)
  const setBrief = useFindSitesStore((s) => s.setBrief)
  const runSearch = useFindSitesStore((s) => s.runSearch)
  const status = useFindSitesStore((s) => s.status)

  const [brandQuery, setBrandQuery] = useState('')
  const [hits, setHits] = useState<BrandHit[]>([])
  const [showHits, setShowHits] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  // Debounced brand autocomplete against the existing public endpoint.
  useEffect(() => {
    if (brief.brandId) return // already picked
    const q = brandQuery.trim()
    if (q.length < 2) {
      setHits([])
      return
    }
    const t = setTimeout(async () => {
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller
      try {
        const res = await fetch(`/api/public/brands/search?q=${encodeURIComponent(q)}&limit=8`, {
          signal: controller.signal,
        })
        if (!res.ok) return
        const data = (await res.json()) as { brands?: BrandHit[] }
        setHits((data.brands ?? []).map((b) => ({ id: b.id, name: b.name })))
        setShowHits(true)
      } catch {
        /* aborted / offline — ignore */
      }
    }, 220)
    return () => clearTimeout(t)
  }, [brandQuery, brief.brandId])

  const pickBrand = (b: BrandHit) => {
    setBrief({ brandId: b.id, brandName: b.name })
    setBrandQuery(b.name)
    setShowHits(false)
  }
  const clearBrand = () => {
    setBrief({ brandId: null, brandName: null })
    setBrandQuery('')
    setHits([])
  }

  const loading = status === 'loading'

  return (
    <div className="space-y-4">
      <div>
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-sm-ink2">
          Requirement
        </label>
        <div className="space-y-1.5">
          {PRESETS.map((p) => {
            const active = brief.preset === p.key
            return (
              <button
                key={p.key}
                type="button"
                onClick={() => setBrief({ preset: p.key })}
                className={`w-full rounded-lg border px-3 py-2 text-left transition-colors ${
                  active
                    ? 'border-sm-violet bg-sm-violet/5'
                    : 'border-sm-border bg-sm-surface hover:border-sm-violet/40'
                }`}
              >
                <div className="text-sm font-medium text-sm-ink">{p.name}</div>
                <div className="text-xs text-sm-ink2">{p.blurb}</div>
              </button>
            )
          })}
        </div>
      </div>

      <div className="relative">
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-sm-ink2">
          Brand <span className="font-normal normal-case text-sm-ink3">— optional (existing-estate distance)</span>
        </label>
        {brief.brandId ? (
          <div className="flex items-center justify-between rounded-lg border border-sm-border bg-sm-surface px-3 py-2">
            <span className="text-sm font-medium text-sm-ink">{brief.brandName}</span>
            <button type="button" onClick={clearBrand} className="text-xs font-medium text-sm-violet hover:underline">
              Clear
            </button>
          </div>
        ) : (
          <>
            <input
              type="text"
              value={brandQuery}
              onChange={(e) => setBrandQuery(e.target.value)}
              onFocus={() => hits.length && setShowHits(true)}
              placeholder="Search a brand to avoid cannibalising its estate…"
              className="w-full rounded-lg border border-sm-border bg-sm-surface px-3 py-2 text-sm text-sm-ink placeholder:text-sm-ink3 focus:border-sm-violet focus:outline-none"
            />
            {showHits && hits.length > 0 && (
              <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-sm-border bg-sm-surface shadow-lg">
                {hits.map((b) => (
                  <li key={b.id}>
                    <button
                      type="button"
                      onClick={() => pickBrand(b)}
                      className="w-full px-3 py-2 text-left text-sm text-sm-ink hover:bg-sm-violet/5"
                    >
                      {b.name}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>

      {brief.brandId && (
        <div>
          <label className="mb-1 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-sm-ink2">
            <span>Min. distance from existing estate</span>
            <span className="font-mono text-sm-ink">{brief.minMiles} mi</span>
          </label>
          <input
            type="range"
            min={0}
            max={5}
            step={0.5}
            value={brief.minMiles}
            onChange={(e) => setBrief({ minMiles: Number(e.target.value) })}
            className="w-full accent-sm-violet"
          />
        </div>
      )}

      <button
        type="button"
        onClick={() => runSearch()}
        disabled={loading}
        className="w-full rounded-lg bg-sm-violet px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-sm-violet-deep disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? 'Searching real Canterbury parcels…' : 'Find parcels'}
      </button>
    </div>
  )
}

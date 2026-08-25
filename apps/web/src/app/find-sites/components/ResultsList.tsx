'use client'

import type { FindSitesResponse } from '@/lib/site-matching/find-sites-dto'
import { useFindSitesStore } from '../lib/store/find-sites-store'
import { TIER_STYLES, TIER_ORDER } from '../lib/tier-style'

function acres(a: number | null): string {
  return a == null ? '—' : `${a.toFixed(2)} ac`
}

function TierBar({ response }: { response: FindSitesResponse }) {
  const total = TIER_ORDER.reduce((n, t) => n + response.tiers[t], 0)
  return (
    <div>
      <div className="flex h-2 w-full overflow-hidden rounded-full">
        {TIER_ORDER.map((t) => {
          const pct = total > 0 ? (100 * response.tiers[t]) / total : 0
          if (pct === 0) return null
          return <div key={t} style={{ width: `${pct}%`, background: TIER_STYLES[t].color }} title={`${TIER_STYLES[t].label}: ${response.tiers[t]}`} />
        })}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-sm-ink2">
        {TIER_ORDER.map((t) => (
          <span key={t} className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-full" style={{ background: TIER_STYLES[t].color }} />
            {TIER_STYLES[t].short} {response.tiers[t].toLocaleString()}
          </span>
        ))}
      </div>
    </div>
  )
}

export function ResultsList() {
  const response = useFindSitesStore((s) => s.response)
  const status = useFindSitesStore((s) => s.status)
  const error = useFindSitesStore((s) => s.error)
  const selectedSiteId = useFindSitesStore((s) => s.selectedSiteId)
  const select = useFindSitesStore((s) => s.select)

  if (status === 'idle') {
    return (
      <p className="px-1 py-6 text-sm text-sm-ink2">
        Pick a requirement and search to surface registered land parcels in Canterbury that align
        with its measurable criteria.
      </p>
    )
  }
  if (status === 'loading') {
    return <p className="px-1 py-6 text-sm text-sm-ink2">Scoring the real candidate universe…</p>
  }
  if (status === 'error') {
    return <p className="px-1 py-6 text-sm text-red-600">Search failed: {error}</p>
  }
  if (!response) return null

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-sm-border bg-sm-surface p-3">
        <div className="flex items-baseline justify-between">
          <span className="text-xs font-semibold uppercase tracking-wide text-sm-ink2">Result tiers</span>
          <span className="text-xs text-sm-ink3">
            {response.eligibleCount.toLocaleString()} of {response.universeSize.toLocaleString()} eligible
          </span>
        </div>
        <div className="mt-2">
          <TierBar response={response} />
        </div>
        <p className="mt-2 text-[11px] leading-snug text-sm-ink3">
          Tiers are an ordered signal, not a suitability %. Land use is classified on{' '}
          {response.crossTab.pctClassifiedGivenRoadside}% of roadside parcels vs{' '}
          {response.crossTab.pctClassifiedGivenNoRoad}% off-road.
        </p>
      </div>

      {response.items.length === 0 ? (
        <p className="px-1 py-4 text-sm text-sm-ink2">No eligible parcels — every candidate failed a hard gate.</p>
      ) : (
        <ul className="space-y-1.5">
          {response.items.map((item) => {
            const style = TIER_STYLES[item.tier]
            const active = item.siteId === selectedSiteId
            return (
              <li key={item.siteId}>
                <button
                  type="button"
                  onClick={() => select(item.siteId)}
                  className={`w-full rounded-lg border px-3 py-2.5 text-left transition-colors ${
                    active ? 'border-sm-violet bg-sm-violet/5' : 'border-sm-border bg-sm-surface hover:border-sm-violet/40'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 text-sm font-medium text-sm-ink">
                      <span className="text-sm-ink3">#{item.rank}</span>
                      {item.name || 'Registered title'}
                    </span>
                    <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${style.chip}`}>
                      {style.short}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-sm-ink2">
                    <span>{acres(item.features.areaAcres)}</span>
                    {item.oversized && <span className="text-amber-600">oversized title</span>}
                    <span className="text-sm-ink3">·</span>
                    <span>{item.features.currentLandUse ?? 'land use unknown'}</span>
                  </div>
                  <div className="mt-1 text-[11px] text-sm-ink3">
                    ✓ {item.evidence.passed.length} · ~ {item.evidence.partial.length} · ✗{' '}
                    {item.evidence.failed.length} · ? {item.evidence.unknown.length}
                  </div>
                </button>
              </li>
            )
          })}
        </ul>
      )}
      {response.truncated && (
        <p className="px-1 text-[11px] text-sm-ink3">
          Showing the top {response.items.length}. {response.eligibleCount.toLocaleString()} parcels are eligible in total.
        </p>
      )}
    </div>
  )
}

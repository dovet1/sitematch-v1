'use client'

import { useMemo } from 'react'
import { ChevronDown, Download, Store } from 'lucide-react'
import { useBrandMatcherStore } from '../../../lib/stores/brand-matcher-store'
import {
  formatSqft,
  isSparse,
  matchesToCsv,
  sortMatches,
  classLabel,
} from '../../../lib/brand-matcher'
import type { BrandMatcherResponse, BrandMatcherSort } from '../../../types/brand-matcher'
import { BrandMatchCard } from './BrandMatchCard'

const SORTS: { id: BrandMatcherSort; label: string }[] = [
  { id: 'best', label: 'Best match' },
  { id: 'acquisitive', label: 'Most acquisitive' },
  { id: 'gap', label: 'Furthest nearest store' },
  { id: 'name', label: 'Name A–Z' },
]

function downloadCsv(result: BrandMatcherResponse, sort: BrandMatcherSort) {
  const csv = matchesToCsv(sortMatches(result.matches, sort), result.query)
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `sitematcher-brands-${result.site.postcode.replace(/\s+/g, '')}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export function BrandMatcherResults() {
  const result = useBrandMatcherStore((s) => s.result)
  const elapsedMs = useBrandMatcherStore((s) => s.elapsedMs)
  const sort = useBrandMatcherStore((s) => s.sort)
  const expandedId = useBrandMatcherStore((s) => s.expandedId)
  const setSort = useBrandMatcherStore((s) => s.setSort)
  const setExpanded = useBrandMatcherStore((s) => s.setExpanded)
  const editSite = useBrandMatcherStore((s) => s.editSite)
  const run = useBrandMatcherStore((s) => s.run)

  const sorted = useMemo(() => (result ? sortMatches(result.matches, sort) : []), [result, sort])
  if (!result) return null

  const { site, query } = result
  // Under Best match the brands with acquisitive evidence rank first; mark where the list turns
  // to brands matched on size, location type and distance alone.
  const firstSparse = sort === 'best' ? sorted.findIndex(isSparse) : -1
  const showDivider = firstSparse > 0

  return (
    <div>
      <header className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-4 border-b border-sm-border bg-sm-surface/95 px-8 py-4 backdrop-blur">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <h1 className="text-[22px] font-bold tracking-[-0.02em] text-sm-ink">
              {sorted.length} {sorted.length === 1 ? 'brand' : 'brands'} matched
            </h1>
            {elapsedMs != null && (
              <span className="rounded-full bg-[#EAF8F1] px-2 py-0.5 text-[11.5px] font-semibold text-[#177E4E]">
                in {(elapsedMs / 1000).toFixed(1)}s
              </span>
            )}
            {query.widen && (
              <span className="rounded-full bg-[#FBF7EE] px-2 py-0.5 text-[11.5px] font-semibold text-[#B7860B]">
                widened criteria
              </span>
            )}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Chip>{formatSqft(query.sqft)} sq ft</Chip>
            <Chip>{classLabel(query.useClass)}</Chip>
            <Chip>{site.postcode}</Chip>
            {site.centre && (
              <span
                className="inline-flex items-center gap-1.5 rounded-full bg-[#EAF8F1] px-3 py-1 text-[12.5px] font-medium text-[#177E4E]"
                title={site.centre.classification}
              >
                <Store size={12} />
                {site.centre.name}
              </span>
            )}
            <button
              type="button"
              onClick={editSite}
              className="rounded-full border border-sm-border px-3 py-1 text-[12.5px] font-medium text-sm-ink2 transition-colors hover:border-sm-border-hard hover:text-sm-ink"
            >
              Edit site
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <label className="relative">
            <span className="sr-only">Sort</span>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as BrandMatcherSort)}
              className="appearance-none rounded-xl border border-sm-border bg-sm-surface py-2.5 pl-4 pr-9 text-[13.5px] font-medium text-sm-ink outline-none hover:border-sm-border-hard"
            >
              {SORTS.map((s) => (
                <option key={s.id} value={s.id}>
                  Sort: {s.label}
                </option>
              ))}
            </select>
            <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm-ink3" />
          </label>
          <button
            type="button"
            onClick={() => downloadCsv(result, sort)}
            disabled={sorted.length === 0}
            className="inline-flex items-center gap-2 rounded-xl bg-sm-violet px-4 py-2.5 text-[13.5px] font-semibold text-white transition-colors hover:bg-sm-violet-deep disabled:opacity-50"
          >
            <Download size={15} />
            Export list
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-[1480px] space-y-4 px-8 py-6">
        {sorted.map((m, i) => (
          <div key={m.brandId}>
            {showDivider && i === firstSparse && (
              <p className="mb-4 mt-2 text-[13px] text-sm-ink3">
                Lower-ranked brands are matched on size, location type and distance alone.
              </p>
            )}
            <BrandMatchCard
              match={m}
              rank={i + 1}
              query={query}
              site={site}
              expanded={expandedId === m.brandId}
              onExpandedChange={(open) => setExpanded(open ? m.brandId : null)}
            />
          </div>
        ))}

        <EndCard
          empty={sorted.length === 0}
          widened={!!query.widen}
          onWiden={() => void run({ widen: true })}
          onEdit={editSite}
        />
      </div>
    </div>
  )
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-sm-violet-tint px-3 py-1 text-[12.5px] font-medium text-sm-violet-deep">
      {children}
    </span>
  )
}

function EndCard({
  empty,
  widened,
  onWiden,
  onEdit,
}: {
  empty: boolean
  widened: boolean
  onWiden: () => void
  onEdit: () => void
}) {
  return (
    <div className="rounded-2xl border border-dashed border-sm-border-hard bg-sm-surface px-6 py-8 text-center">
      <h2 className="text-[16px] font-semibold text-sm-ink">
        {empty ? 'No brands fit this unit yet' : 'That’s every brand that fits your unit'}
      </h2>
      <p className="mx-auto mt-1.5 max-w-[640px] text-[13.5px] text-sm-ink2">
        {widened
          ? 'These results already allow a wider size range and any use class. Try a different size or location to see more.'
          : 'Widen the size range or use class to see more, or save this site and we’ll alert you when a new requirement matches it.'}
      </p>
      <div className="mt-4 flex flex-wrap justify-center gap-2.5">
        <button
          type="button"
          disabled
          title="Coming soon"
          className="cursor-not-allowed rounded-xl bg-sm-violet px-4 py-2.5 text-[13.5px] font-semibold text-white opacity-50"
        >
          Alert me on new matches
          <span className="ml-2 rounded bg-white/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
            Soon
          </span>
        </button>
        {widened ? (
          <button
            type="button"
            onClick={onEdit}
            className="rounded-xl border border-sm-border px-4 py-2.5 text-[13.5px] font-semibold text-sm-ink transition-colors hover:border-sm-border-hard"
          >
            Edit site
          </button>
        ) : (
          <button
            type="button"
            onClick={onWiden}
            className="rounded-xl border border-sm-border px-4 py-2.5 text-[13.5px] font-semibold text-sm-ink transition-colors hover:border-sm-border-hard"
          >
            Widen criteria
          </button>
        )}
      </div>
    </div>
  )
}

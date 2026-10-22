'use client'

import { useMemo, useState } from 'react'
import { ChevronDown, Store } from 'lucide-react'
import { useBrandMatcherStore } from '../../../lib/stores/brand-matcher-store'
import {
  filterBySector,
  formatSqft,
  isSparse,
  sortMatches,
  classLabel,
  sectorOptions,
} from '../../../lib/brand-matcher'
import { byFit } from '../../../lib/brand-report'
import { BRAND_REPORT_MAX, type BrandMatcherSort } from '../../../types/brand-matcher'
import { BrandMatchCard, ROW_GRID } from './BrandMatchCard'
import { BrandSectorFilter } from './BrandSectorFilter'
import {
  BrandReportDialog,
  EMPTY_TOAST,
  ExportMenu,
  LIMIT_TOAST,
  SelectionBar,
  Toast,
  useToast,
} from './BrandReportExport'

const SORTS: { id: BrandMatcherSort; label: string }[] = [
  { id: 'best', label: 'Best match' },
  { id: 'acquisitive', label: 'Most acquisitive' },
  { id: 'gap', label: 'Furthest nearest store' },
  { id: 'name', label: 'Name A–Z' },
]

export function BrandMatcherResults() {
  const result = useBrandMatcherStore((s) => s.result)
  const elapsedMs = useBrandMatcherStore((s) => s.elapsedMs)
  const sort = useBrandMatcherStore((s) => s.sort)
  const expandedId = useBrandMatcherStore((s) => s.expandedId)
  const setSort = useBrandMatcherStore((s) => s.setSort)
  const sectors = useBrandMatcherStore((s) => s.sectors)
  const setSectors = useBrandMatcherStore((s) => s.setSectors)
  const setExpanded = useBrandMatcherStore((s) => s.setExpanded)
  const editSite = useBrandMatcherStore((s) => s.editSite)
  const run = useBrandMatcherStore((s) => s.run)
  const selectedIds = useBrandMatcherStore((s) => s.selectedIds)
  const toggleSelected = useBrandMatcherStore((s) => s.toggleSelected)
  const setSelected = useBrandMatcherStore((s) => s.setSelected)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [toast, showToast] = useToast()

  const sectorChoices = useMemo(() => (result ? sectorOptions(result.matches) : []), [result])
  // The selection outlives a new search; a sector the new results don't contain is ignored
  // rather than filtering the list to nothing.
  const activeSectors = useMemo(
    () => sectors.filter((id) => sectorChoices.some((o) => o.id === id)),
    [sectors, sectorChoices]
  )
  const sorted = useMemo(
    () => (result ? sortMatches(filterBySector(result.matches, activeSectors), sort) : []),
    [result, activeSectors, sort]
  )
  const selectedMatches = useMemo(
    () => (result ? result.matches.filter((m) => selectedIds.includes(m.brandId)) : []),
    [result, selectedIds]
  )
  if (!result) return null
  const filtered = activeSectors.length > 0
  const full = selectedIds.length >= BRAND_REPORT_MAX

  const toggle = (id: string) => {
    if (toggleSelected(id) === 'full') showToast(LIMIT_TOAST)
  }
  const openReport = () => {
    if (selectedIds.length === 0) showToast(EMPTY_TOAST)
    else setDialogOpen(true)
  }

  const { site, query } = result
  // Under Best match the brands with acquisitive evidence rank first; mark where the list turns
  // to brands with none.
  const firstSparse = sort === 'best' ? sorted.findIndex(isSparse) : -1
  const showDivider = firstSparse > 0

  return (
    <div>
      {/* The summary bar and the column headings stick together, so the headings stay in view while
          the cards scroll under them. */}
      <header className="sticky top-0 z-10 border-b border-sm-border bg-sm-surface/95 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-4 px-8 py-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <h1 className="text-[22px] font-bold tracking-[-0.02em] text-sm-ink">
                {filtered && `${sorted.length} of `}
                {filtered ? result.matches.length : sorted.length}{' '}
                {(filtered ? result.matches.length : sorted.length) === 1 ? 'brand' : 'brands'} matched
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
            {sectorChoices.length > 1 && (
              <BrandSectorFilter options={sectorChoices} selected={activeSectors} onChange={setSectors} />
            )}
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
            <ExportMenu
              selected={selectedIds.length}
              disabled={sorted.length === 0}
              onPdf={openReport}
            />
          </div>
        </div>
        <div className="mx-auto max-w-[1480px] px-8">
          {sorted.length > 0 && (
            <div
              className={`hidden gap-3.5 whitespace-nowrap px-[22px] pb-2.5 text-[11px] font-bold uppercase tracking-[0.02em] text-[#8A8895] lg:grid ${ROW_GRID}`}
            >
              <span />
              <span />
              <span>Brand</span>
              <span className="grid grid-cols-5 gap-2.5 [&>span]:truncate">
                <span>Unit size</span>
                <span>Use class</span>
                <span>Acquisitive</span>
                <span title="Demographics">Demographics</span>
                <span title="Nearest store">Nearest store</span>
              </span>
              <span>Turnover</span>
              <span className="text-right">Fit / 100</span>
              <span />
            </div>
          )}
        </div>
      </header>

      <div className={`mx-auto max-w-[1480px] space-y-2.5 px-8 pt-6 ${selectedIds.length > 0 ? 'pb-28' : 'pb-6'}`}>
        {sorted.map((m, i) => (
          <div key={m.brandId}>
            {showDivider && i === firstSparse && (
              <p className="mb-2.5 mt-4 text-[13px] text-sm-ink3">
                We haven&apos;t found evidence that the brands below are acquiring at the moment.
              </p>
            )}
            <BrandMatchCard
              match={m}
              query={query}
              site={site}
              expanded={expandedId === m.brandId}
              onExpandedChange={(open) => setExpanded(open ? m.brandId : null)}
              selection={{
                selected: selectedIds.includes(m.brandId),
                limited: full && !selectedIds.includes(m.brandId),
                onToggle: () => toggle(m.brandId),
              }}
            />
          </div>
        ))}

        <EndCard
          empty={sorted.length === 0}
          filtered={filtered}
          onClearSectors={() => setSectors([])}
          widened={!!query.widen}
          onWiden={() => void run({ widen: true })}
          onEdit={editSite}
        />
      </div>

      {/* The selection bar and toast float over the bottom of the results pane, centred on it. */}
      <div className="pointer-events-none sticky bottom-0 z-20 h-0">
        <div className="absolute bottom-[22px] left-0 right-0 flex flex-col items-center gap-3 px-4">
          {toast && <Toast message={toast} />}
          {selectedIds.length > 0 && !dialogOpen && (
            <SelectionBar
              count={selectedIds.length}
              onSelectTop={() => setSelected(byFit(sorted).slice(0, BRAND_REPORT_MAX).map((m) => m.brandId))}
              onClear={() => setSelected([])}
              onCreate={openReport}
            />
          )}
        </div>
      </div>

      {dialogOpen && (
        <BrandReportDialog
          matches={selectedMatches}
          query={query}
          onRemove={(id) => toggleSelected(id)}
          onClose={() => setDialogOpen(false)}
        />
      )}
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
  filtered,
  onClearSectors,
  widened,
  onWiden,
  onEdit,
}: {
  empty: boolean
  filtered: boolean
  onClearSectors: () => void
  widened: boolean
  onWiden: () => void
  onEdit: () => void
}) {
  if (filtered) {
    return (
      <div className="rounded-2xl border border-dashed border-sm-border-hard bg-sm-surface px-6 py-8 text-center">
        <h2 className="text-[16px] font-semibold text-sm-ink">
          {empty ? 'No brands in these sectors fit this unit' : 'That’s every brand in these sectors that fits your unit'}
        </h2>
        <p className="mx-auto mt-1.5 max-w-[640px] text-[13.5px] text-sm-ink2">
          Clear the sector filter to see brands in every sector.
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-2.5">
          <button
            type="button"
            onClick={onClearSectors}
            className="rounded-xl border border-sm-border px-4 py-2.5 text-[13.5px] font-semibold text-sm-ink transition-colors hover:border-sm-border-hard"
          >
            Show all sectors
          </button>
        </div>
      </div>
    )
  }
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

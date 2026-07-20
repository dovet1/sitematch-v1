'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  MapPin,
  X,
  ChevronRight,
  Loader2,
  PanelRightClose,
  PanelRightOpen,
  Target,
  Download,
  Check,
} from 'lucide-react'
import { getClearbitLogoUrl } from '@/lib/clearbit-logo'
import { useWorkspaceStore } from '../../lib/stores/unified-workspace-store'
import { toFilterSet } from '../../lib/services/gaps-service'
import { exportBUAsToCSV } from '@/lib/buas/export-utils'
import type {
  BUAResult,
  GapItem,
  InspectorTab,
  MissingFascia,
  MissingBrand,
  PlanningApplication,
  PresentBrand,
  RequirementLocation,
} from '../../types/unified-workspace'
import type { CatchmentData } from '../../lib/hooks/useCatchment'
import type { Landscape } from '../../lib/hooks/useAreaData'
import { BrandFilterBar, type FilterOption } from './BrandFilterBar'
import { CatchmentTab } from './CatchmentTab'

// Small circular initials avatar (fallback when no logo is available).
export function Avatar({ label, size = 36 }: { label: string; size?: number }) {
  const initials = label.trim().slice(0, 2).toUpperCase()
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-lg bg-sm-violet-tint-soft font-mono text-[11px] font-semibold text-sm-violet-deep"
      style={{ width: size, height: size }}
    >
      {initials}
    </span>
  )
}

// Brand/company logo with a logo.dev(domain) → uploaded logo_url → initials
// fallback chain, mirroring the assess-area map pins. `logoUrl` must be an
// uploaded-only URL (never a logo.dev URL) so the chain can't double-attempt.
export function BrandLogo({
  label,
  domain,
  logoUrl,
  size = 36,
}: {
  label: string
  domain?: string | null
  logoUrl?: string | null
  size?: number
}) {
  const sources: string[] = []
  // getClearbitLogoUrl returns null when the token is missing or the domain is
  // invalid — guard for that and continue down the fallback chain.
  const dev = domain ? getClearbitLogoUrl(domain, 64) : null
  if (dev) sources.push(dev)
  if (logoUrl && logoUrl !== dev) sources.push(logoUrl)

  const [idx, setIdx] = useState(0)
  useEffect(() => {
    setIdx(0)
  }, [domain, logoUrl])

  if (sources.length === 0 || idx >= sources.length) {
    return <Avatar label={label} size={size} />
  }
  return (
    <img
      src={sources[idx]}
      alt=""
      onError={() => setIdx((i) => i + 1)}
      className="shrink-0 rounded-lg border border-sm-border bg-white object-contain"
      style={{ width: size, height: size }}
    />
  )
}

export function Kicker({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-mono text-[9.5px] font-semibold uppercase tracking-wider text-sm-ink3">
      {children}
    </span>
  )
}

/* ---------- Find Gaps: ranked results list ---------- */

const TEAL = '#0E7C86'

function popShort(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}m`
  if (n >= 1000) return `${Math.round(n / 1000)}k`
  return String(n)
}

function joinLabels(items: GapItem[]): string {
  const labels = items.map((i) => i.label)
  if (labels.length <= 1) return labels[0] ?? ''
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`
  return `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`
}

function radiusPhrase(km: number): string {
  return km === 0 ? 'in the town' : `within ${km} km`
}

// "Two boxes, one list" onboarding shown before any filter is added.
function FindEmpty() {
  const points = [
    ['Box 1', 'the brands/categories a town is missing'],
    ['Box 2', 'the brands/categories it must already have'],
    ['Both must be true', 'results match every box (AND)'],
    ['Export as CSV', 'take the shortlist away with you'],
  ]
  return (
    <div className="px-[18px] py-8">
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-sm-violet-tint-soft text-sm-violet">
        <Target size={20} />
      </span>
      <h3 className="mt-4 text-[19px] font-bold tracking-[-0.3px] text-sm-ink">
        Two boxes, one list
      </h3>
      <p className="mt-1.5 text-[13px] leading-relaxed text-sm-ink3">
        Fill the two boxes on the left to build a location strategy. We&apos;ll show every UK
        town that matches — your white space, ready to work.
      </p>
      <ul className="mt-4 space-y-2.5">
        {points.map(([k, v]) => (
          <li key={k} className="flex items-start gap-2.5">
            <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-sm-violet text-white">
              <Check size={10} />
            </span>
            <span className="text-[12.5px] leading-snug text-sm-ink2">
              <b className="font-semibold text-sm-ink">{k}</b> — {v}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function FindResults({
  results,
  total,
  loading,
  error,
  onCollapse,
}: {
  results: BUAResult[]
  total: number
  loading: boolean
  error: string | null
  onCollapse: () => void
}) {
  const selectArea = useWorkspaceStore((s) => s.selectArea)
  const missingItems = useWorkspaceStore((s) => s.missingItems)
  const haveItems = useWorkspaceStore((s) => s.haveItems)
  const missingRadius = useWorkspaceStore((s) => s.missingRadius)
  const haveRadius = useWorkspaceStore((s) => s.haveRadius)
  const gapSort = useWorkspaceStore((s) => s.gapSort)
  const setGapSort = useWorkspaceStore((s) => s.setGapSort)
  const gapRules = useWorkspaceStore((s) => s.gapRules)
  const populationRange = useWorkspaceStore((s) => s.populationRange)
  const showSubFiveK = useWorkspaceStore((s) => s.showSubFiveK)
  const [exporting, setExporting] = useState(false)

  const hasQuery = missingItems.length > 0 || haveItems.length > 0
  const pct = total > 0 ? Math.max(4, Math.round((results.length / total) * 100)) : 0

  const sorted = useMemo(() => {
    const arr = [...results]
    if (gapSort === 'az') {
      arr.sort((a, b) => a.name.localeCompare(b.name))
    } else {
      arr.sort((a, b) => (b.pop_final ?? b.pop) - (a.pop_final ?? a.pop))
    }
    return arr
  }, [results, gapSort])

  const missingTag = missingItems.map((i) => i.label).join(', ')
  const haveTag = haveItems.map((i) => i.label).join(', ')

  const handleExport = async () => {
    if (!hasQuery || exporting) return
    setExporting(true)
    try {
      const targetNames: Record<string, string> = {}
      for (const item of [...missingItems, ...haveItems]) {
        for (const tid of item.targetIds) targetNames[tid] = item.label
      }
      await exportBUAsToCSV(
        {
          minPop: showSubFiveK ? 0 : populationRange[0],
          maxPop: populationRange[1],
          filterSet: toFilterSet(gapRules),
        },
        targetNames
      )
    } catch (e) {
      console.error('Export failed', e)
    } finally {
      setExporting(false)
    }
  }

  return (
    <aside className="flex w-[404px] shrink-0 flex-col overflow-hidden border-l border-sm-border bg-sm-surface">
      <div className="relative border-b border-sm-border-soft px-[18px] py-[18px]">
        <button
          type="button"
          onClick={onCollapse}
          aria-label="Hide right panel"
          title="Hide right panel"
          className="absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-lg text-sm-ink3 hover:bg-sm-bg hover:text-sm-ink"
        >
          <PanelRightClose size={16} />
        </button>

        {hasQuery ? (
          <>
            <Kicker>You&apos;re looking for</Kicker>
            <div className="mt-2 rounded-[12px] bg-[#f6f4ef] px-3.5 py-3 text-[13px] leading-relaxed text-sm-ink2">
              Towns{' '}
              {missingItems.length > 0 && (
                <>
                  missing <b className="font-semibold text-sm-ink">{joinLabels(missingItems)}</b>
                  {missingRadius > 0 && <> {radiusPhrase(missingRadius)}</>}
                </>
              )}
              {missingItems.length > 0 && haveItems.length > 0 && ', '}
              {haveItems.length > 0 && (
                <>
                  that have <b className="font-semibold text-sm-ink">{joinLabels(haveItems)}</b>{' '}
                  {radiusPhrase(haveRadius)}
                </>
              )}
              , with a population of{' '}
              <b className="font-semibold text-sm-ink">
                {popShort(showSubFiveK ? 0 : populationRange[0])}–{popShort(populationRange[1])}
              </b>
              .
            </div>

            <div className="mt-4 flex items-center justify-between">
              <div>
                <Kicker>Matching towns</Kicker>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-[24px] font-semibold tracking-[-0.5px] text-sm-ink">
                    {results.length.toLocaleString()}
                  </span>
                  <Kicker>of {total.toLocaleString()}</Kicker>
                </div>
              </div>
              <button
                type="button"
                onClick={handleExport}
                disabled={exporting || results.length === 0}
                className="inline-flex items-center gap-1.5 rounded-lg bg-sm-ink px-3 py-2 text-[12.5px] font-semibold text-white disabled:opacity-50"
              >
                {exporting ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <Download size={13} />
                )}
                Export CSV
              </button>
            </div>
            <span className="mt-2 block h-[3px] w-full overflow-hidden rounded-full bg-sm-border-soft">
              <span
                className="block h-full bg-sm-violet transition-all"
                style={{ width: `${pct}%` }}
              />
            </span>

            <div className="mt-3 flex items-center gap-2">
              <Kicker>Sort</Kicker>
              {(['pop', 'az'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setGapSort(s)}
                  className={
                    'rounded-full px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-wide transition-colors ' +
                    (gapSort === s
                      ? 'bg-sm-ink text-white'
                      : 'border border-sm-border-soft text-sm-ink3 hover:text-sm-ink')
                  }
                >
                  {s === 'pop' ? 'Population ↓' : 'A–Z'}
                </button>
              ))}
              {loading && <Loader2 size={11} className="ml-auto animate-spin text-sm-ink3" />}
            </div>
          </>
        ) : (
          <>
            <Kicker>Find Gaps</Kicker>
            <h2 className="mt-1.5 text-[20px] font-semibold tracking-[-0.3px] text-sm-ink">
              Your shortlist
            </h2>
          </>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {!hasQuery && <FindEmpty />}
        {hasQuery && error && (
          <div className="px-[18px] py-6 text-center text-[12.5px] text-[#B23A2C]">
            {error}
          </div>
        )}
        {hasQuery && !error && results.length === 0 && !loading && (
          <div className="px-[18px] py-8 text-center text-[12.5px] text-sm-ink3">
            No built-up areas match these filters. Loosen a rule or widen the
            population range.
          </div>
        )}
        {hasQuery &&
          sorted.map((b) => {
            const pop = b.pop_final ?? b.pop
            return (
              <button
                key={b.gsscode}
                type="button"
                onClick={() =>
                  selectArea({
                    id: b.gsscode,
                    name: b.name,
                    center: [b.centroid_lon, b.centroid_lat],
                    population: pop ?? undefined,
                    kind: 'bua',
                  })
                }
                className="grid w-full grid-cols-[1fr_auto] items-center gap-3 border-b border-sm-border-soft px-[18px] py-[13px] text-left hover:bg-sm-bg"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <MapPin size={16} className="shrink-0 text-sm-violet" />
                    <span className="truncate text-[15px] font-medium text-sm-ink">
                      {b.name}
                    </span>
                  </div>
                  <div className="ml-6 mt-1 font-mono text-[10px] uppercase tracking-wide text-sm-ink3">
                    Pop {(pop ?? 0).toLocaleString()}
                  </div>
                  {(missingTag || haveTag) && (
                    <div className="ml-6 mt-1.5 flex flex-wrap gap-1.5">
                      {missingTag && (
                        <span className="rounded-full bg-sm-violet-tint-soft px-2 py-0.5 text-[10.5px] font-medium text-sm-violet-deep">
                          Missing {missingTag}
                        </span>
                      )}
                      {haveTag && (
                        <span
                          className="rounded-full px-2 py-0.5 text-[10.5px] font-medium"
                          style={{ background: '#eef6f6', color: TEAL }}
                        >
                          {haveTag} {radiusPhrase(haveRadius)}
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <ChevronRight size={14} className="text-sm-ink4" />
              </button>
            )
          })}
      </div>
    </aside>
  )
}

/* ---------- Opportunity: the landscape around an area / dropped point ---------- */

function MissingRow({
  m,
  onOpen,
}: {
  m: MissingBrand
  onOpen: (m: MissingFascia) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen(m.representative)}
      className="grid grid-cols-[36px_1fr_auto] items-center gap-3 rounded-xl border border-sm-border bg-sm-surface p-3 text-left hover:bg-sm-bg"
    >
      <BrandLogo label={m.brandName} domain={m.logoDomain} logoUrl={m.logoUrl} />
      <div className="min-w-0">
        <div className="truncate text-[14px] font-semibold text-sm-ink">
          {m.brandName}
        </div>
        {(m.categoryName || m.nearestStoreDistance != null) && (
          <div className="mt-0.5 truncate font-mono text-[10px] uppercase tracking-wide text-sm-ink3">
            {m.categoryName}
            {m.nearestStoreDistance != null && (
              <>
                {m.categoryName ? ' · ' : ''}
                {'nearest '}
                {(m.nearestStoreDistance / 1000).toFixed(1)} km
              </>
            )}
          </div>
        )}
      </div>
      <ChevronRight size={15} className="text-sm-ink4" />
    </button>
  )
}

// Promoted "wants to open here" row for an occupier with a live requirement
// whose target location falls within the active catchment.
function RequirementRow({
  req,
  onOpen,
}: {
  req: RequirementLocation
  onOpen: (requirementId: string) => void
}) {
  const sizeRange = formatRequirementSizeRange(req)
  return (
    <button
      type="button"
      onClick={() => onOpen(req.requirementId)}
      className="rounded-xl border border-sm-violet-tint bg-sm-violet-tint-soft p-3 text-left hover:brightness-[0.98]"
    >
      <div className="mb-2 flex items-center gap-1.5">
        <span className="rounded-full bg-sm-violet px-2 py-[3px] font-mono text-[9.5px] font-semibold uppercase tracking-wider text-white">
          Requirement
        </span>
        <span className="font-mono text-[9.5px] font-semibold uppercase tracking-wider text-sm-violet-deep">
          Wants to open here
        </span>
      </div>
      <div className="grid grid-cols-[36px_1fr_auto] items-center gap-3">
        <BrandLogo
          label={req.companyName}
          domain={req.companyDomain}
          logoUrl={req.logoUrl}
        />
        <div className="min-w-0">
          <div className="truncate text-[14px] font-semibold text-sm-ink">
            {req.companyName}
          </div>
          {sizeRange && (
            <div className="mt-0.5 truncate font-mono text-[10px] uppercase tracking-wide text-sm-ink3">
              {sizeRange}
            </div>
          )}
        </div>
        <ChevronRight size={15} className="text-sm-violet-deep" />
      </div>
    </button>
  )
}

function formatRequirementSizeRange(req: RequirementLocation): string | null {
  if (req.siteSizeMin != null || req.siteSizeMax != null) {
    return formatRange(req.siteSizeMin, req.siteSizeMax, 'sq ft')
  }
  if (req.siteAcreageMin != null || req.siteAcreageMax != null) {
    return formatRange(req.siteAcreageMin, req.siteAcreageMax, 'acres', 2)
  }
  if (req.dwellingCountMin != null || req.dwellingCountMax != null) {
    return formatRange(req.dwellingCountMin, req.dwellingCountMax, 'dwellings')
  }
  return null
}

function formatRange(
  min: number | null,
  max: number | null,
  unit: string,
  maximumFractionDigits = 0
): string {
  const format = (value: number) =>
    value.toLocaleString('en-GB', { maximumFractionDigits })

  if (min != null && max != null) {
    if (min === max) return `${format(min)} ${unit}`
    return `${format(min)}-${format(max)} ${unit}`
  }
  if (min != null) return `From ${format(min)} ${unit}`
  return `Up to ${format(max ?? 0)} ${unit}`
}

function TradingRow({ b }: { b: PresentBrand }) {
  const count = `${b.storeCount} ${b.storeCount === 1 ? 'store' : 'stores'}`
  const setHoveredBrandId = useWorkspaceStore((s) => s.setHoveredBrandId)
  const setBrandInfoId = useWorkspaceStore((s) => s.setBrandInfoId)
  return (
    <button
      type="button"
      onClick={() => setBrandInfoId(b.brandId)}
      onMouseEnter={() => setHoveredBrandId(b.brandId)}
      onMouseLeave={() => setHoveredBrandId(null)}
      className="grid w-full cursor-pointer grid-cols-[28px_1fr] items-center gap-3 border-b border-sm-border-soft px-[18px] py-2.5 text-left transition-colors hover:bg-sm-bg"
    >
      <BrandLogo
        label={b.brandName}
        domain={b.logoDomain}
        logoUrl={b.logoUrl}
        size={28}
      />
      <div className="min-w-0">
        <div className="truncate text-[13px] font-medium text-sm-ink2">
          {b.brandName}
        </div>
        <div className="mt-0.5 truncate font-mono text-[10px] uppercase tracking-wide text-sm-ink3">
          {b.town ? `${count} · ${b.town}` : count}
        </div>
      </div>
    </button>
  )
}

function MissingBody({
  loading,
  missing,
  requirements,
  areaName,
  onOpenReq,
  onOpenBrand,
}: {
  loading: boolean
  missing: MissingBrand[]
  requirements: RequirementLocation[]
  areaName: string
  onOpenReq: (requirementId: string) => void
  onOpenBrand: (m: MissingFascia) => void
}) {
  const gapCount = requirements.length + missing.length
  return (
    <>
      {loading && (
        <div className="flex items-center gap-2 px-[18px] py-4 text-[12.5px] text-sm-ink3">
          <Loader2 size={13} className="animate-spin" /> Reading the landscape…
        </div>
      )}

      <div className="px-[18px] pt-[18px]">
        <div className="flex items-baseline justify-between">
          <div className="text-[17px] font-semibold tracking-[-0.3px] text-sm-ink">
            The gap · brands missing here
          </div>
          <span className="font-mono text-[12px] text-sm-ink2">{gapCount}</span>
        </div>
        <p className="mt-1 text-[12.5px] leading-relaxed text-sm-ink3">
          {requirements.length > 0
            ? `Occupiers with a live requirement naming ${areaName} show first, then established brands with no presence here.`
            : 'Established brands with no presence nearby that fit this location.'}
        </p>
      </div>
      <div className="flex flex-col gap-2 px-[18px] pb-[18px] pt-2.5">
        {!loading && gapCount === 0 && (
          <div className="rounded-xl border border-dashed border-sm-border bg-sm-bg px-3 py-3.5 text-center text-[12.5px] text-sm-ink3">
            No missing brands found for this catchment.
          </div>
        )}
        {requirements.map((r) => (
          <RequirementRow key={r.id} req={r} onOpen={onOpenReq} />
        ))}
        {missing.map((m) => (
          <MissingRow key={m.brandId} m={m} onOpen={onOpenBrand} />
        ))}
      </div>
    </>
  )
}

function PresentBody({
  loading,
  present,
}: {
  loading: boolean
  present: PresentBrand[]
}) {
  return (
    <>
      {loading && (
        <div className="flex items-center gap-2 px-[18px] py-4 text-[12.5px] text-sm-ink3">
          <Loader2 size={13} className="animate-spin" /> Reading the landscape…
        </div>
      )}

      <div className="px-[18px] pt-[18px]">
        <div className="flex items-baseline justify-between">
          <div className="text-[17px] font-semibold tracking-[-0.3px] text-sm-ink">
            Already trading here
          </div>
          <span className="font-mono text-[12px] text-sm-ink2">
            {present.length}
          </span>
        </div>
        <p className="mt-1 text-[12.5px] leading-relaxed text-sm-ink3">
          Brands with an established presence within this catchment.
        </p>
      </div>
      <div className="pt-2.5">
        {!loading && present.length === 0 && (
          <div className="px-[18px] py-3 text-[12.5px] text-sm-ink3">
            No brands trading within this catchment.
          </div>
        )}
        {present.map((b) => (
          <TradingRow key={b.brandId} b={b} />
        ))}
      </div>
    </>
  )
}

const OPP_TABS: { id: InspectorTab; label: string }[] = [
  { id: 'missing', label: 'Missing Brands' },
  { id: 'present', label: 'Present Brands' },
  { id: 'catchment', label: 'Catchment' },
  { id: 'planning', label: 'Planning' },
]

// app_state → badge colour: green for permitted, red for rejected, amber for
// still-undecided applications.
export function planningStateBadgeClass(state: string): string {
  const s = state.toLowerCase()
  if (s === 'permitted') return 'bg-emerald-600'
  if (s === 'rejected') return 'bg-rose-600'
  return 'bg-amber-600'
}

function formatPlanningDate(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function PlanningRow({
  app,
  onOpen,
}: {
  app: PlanningApplication
  onOpen: (app: PlanningApplication) => void
}) {
  const date =
    formatPlanningDate(app.decidedDate) ?? formatPlanningDate(app.dateValidated)
  const subline = [app.appType, app.appSize, date].filter(Boolean).join(' · ')
  return (
    <button
      type="button"
      onClick={() => onOpen(app)}
      className="grid cursor-pointer grid-cols-[1fr_auto] items-center gap-3 rounded-xl border border-sm-border bg-sm-surface p-3 text-left transition-colors hover:bg-sm-bg"
    >
      <div className="min-w-0">
        <div className="mb-1.5 flex items-center gap-1.5">
          <span
            className={
              'rounded-full px-2 py-[3px] font-mono text-[9.5px] font-semibold uppercase tracking-wider text-white ' +
              planningStateBadgeClass(app.appState)
            }
          >
            {app.appState}
          </span>
        </div>
        <div className="truncate text-[13px] font-medium text-sm-ink2">
          {app.address || app.name}
        </div>
        {subline && (
          <div className="mt-0.5 truncate font-mono text-[10px] uppercase tracking-wide text-sm-ink3">
            {subline}
          </div>
        )}
      </div>
      <ChevronRight size={15} className="text-sm-ink4" />
    </button>
  )
}

function PlanningBody({
  loading,
  error,
  truncated,
  applications,
  onOpen,
}: {
  loading: boolean
  error: string | null
  truncated: boolean
  applications: PlanningApplication[]
  onOpen: (app: PlanningApplication) => void
}) {
  return (
    <>
      {loading && (
        <div className="flex items-center gap-2 px-[18px] py-4 text-[12.5px] text-sm-ink3">
          <Loader2 size={13} className="animate-spin" /> Reading planning
          applications…
        </div>
      )}

      <div className="px-[18px] pt-[18px]">
        <div className="flex items-baseline justify-between">
          <div className="text-[17px] font-semibold tracking-[-0.3px] text-sm-ink">
            Planning applications
          </div>
          <span className="font-mono text-[12px] text-sm-ink2">
            {applications.length}
          </span>
        </div>
        <p className="mt-1 text-[12.5px] leading-relaxed text-sm-ink3">
          Large planning applications inside this area from the last two years.
        </p>
      </div>
      <div className="flex flex-col gap-2 px-[18px] pb-[18px] pt-2.5">
        {error && !loading && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-3.5 text-[12.5px] text-rose-700">
            {error}
          </div>
        )}
        {truncated && !loading && !error && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-[12.5px] text-amber-800">
            Showing a subset of applications for this area.
          </div>
        )}
        {!loading && !error && applications.length === 0 && (
          <div className="rounded-xl border border-dashed border-sm-border bg-sm-bg px-3 py-3.5 text-center text-[12.5px] text-sm-ink3">
            No large planning applications found in this area.
          </div>
        )}
        {!error &&
          applications.map((app) => (
            <PlanningRow key={app.name} app={app} onOpen={onOpen} />
          ))}
      </div>
    </>
  )
}

function Opportunity({
  title,
  areaName,
  subtitle,
  landscape,
  presentBrands,
  missingBrands,
  requirements,
  catchmentData,
  categoryOptions,
  brandOptions,
  planningApplications,
  planningLoading,
  planningError,
  planningTruncated,
  onClose,
  onCollapse,
  onOpenReq,
  onOpenBrand,
  onOpenPlanning,
}: {
  title: string
  areaName: string
  subtitle: string
  landscape: Landscape
  presentBrands: PresentBrand[]
  missingBrands: MissingBrand[]
  requirements: RequirementLocation[]
  catchmentData: CatchmentData
  categoryOptions: FilterOption[]
  brandOptions: FilterOption[]
  planningApplications: PlanningApplication[]
  planningLoading: boolean
  planningError: string | null
  planningTruncated: boolean
  onClose: () => void
  onCollapse: () => void
  onOpenReq: (requirementId: string) => void
  onOpenBrand: (m: MissingFascia) => void
  onOpenPlanning: (app: PlanningApplication) => void
}) {
  const tab = useWorkspaceStore((s) => s.tab)
  const setTab = useWorkspaceStore((s) => s.setTab)
  const view = useWorkspaceStore((s) => s.view)
  const area = useWorkspaceStore((s) => s.area)
  const assessPoint = useWorkspaceStore((s) => s.assessPoint)
  const comparePair = useWorkspaceStore((s) => s.comparePair)
  const brandFilterCategoryIds = useWorkspaceStore((s) => s.brandFilterCategoryIds)
  const brandFilterBrandIds = useWorkspaceStore((s) => s.brandFilterBrandIds)
  const setBrandFilterCategoryIds = useWorkspaceStore(
    (s) => s.setBrandFilterCategoryIds
  )
  const setBrandFilterBrandIds = useWorkspaceStore((s) => s.setBrandFilterBrandIds)
  const clearBrandFilters = useWorkspaceStore((s) => s.clearBrandFilters)

  const agg = catchmentData.rawData?.aggregated as
    | { population_total?: number; affluence?: { avg_raw_score?: number } }
    | undefined
  const hasMetrics = !catchmentData.error && agg != null
  const popLabel = hasMetrics && agg?.population_total != null
    ? agg.population_total.toLocaleString()
    : '—'
  const affluenceLabel = hasMetrics && agg?.affluence?.avg_raw_score != null
    ? agg.affluence.avg_raw_score.toFixed(1)
    : '—'
  const metricsDimmed = hasMetrics && catchmentData.loading

  return (
    <aside className="flex w-[404px] shrink-0 flex-col overflow-hidden border-l border-sm-border bg-sm-surface">
      <div className="border-b border-sm-border-soft px-[18px] py-[18px]">
        <div className="flex items-start justify-between gap-2.5">
          <div className="min-w-0">
            <Kicker>{subtitle}</Kicker>
            <div className="mt-1 truncate text-[24px] font-semibold tracking-[-0.5px] text-sm-ink">
              {title}
            </div>
            <div
              className={
                'mt-3 grid grid-cols-2 gap-2 transition-opacity ' +
                (metricsDimmed ? 'opacity-50' : 'opacity-100')
              }
            >
              <div className="rounded-lg border border-sm-border-soft bg-sm-violet/[0.06] px-2.5 py-1.5">
                <div className="text-[9.5px] font-medium uppercase tracking-wide text-sm-ink3">
                  Population
                </div>
                <div className="mt-0.5 text-[17px] font-semibold leading-none text-sm-ink">
                  {popLabel}
                </div>
              </div>
              <div className="rounded-lg border border-sm-border-soft bg-emerald-500/[0.07] px-2.5 py-1.5">
                <div className="text-[9.5px] font-medium uppercase tracking-wide text-sm-ink3">
                  Affluence
                </div>
                <div className="mt-0.5 text-[17px] font-semibold leading-none text-sm-ink">
                  {affluenceLabel}
                </div>
              </div>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={onCollapse}
              aria-label="Hide right panel"
              title="Hide right panel"
              className="rounded-lg border border-sm-border bg-sm-surface p-1.5 text-sm-ink3 hover:text-sm-ink2"
            >
              <PanelRightClose size={13} />
            </button>
            <button
              type="button"
              onClick={onClose}
              title="Close"
              className="rounded-lg border border-sm-border bg-sm-surface p-1.5 text-sm-ink3 hover:text-sm-ink2"
            >
              <X size={13} />
            </button>
          </div>
        </div>
      </div>

      <div className="flex shrink-0 border-b border-sm-border">
        {OPP_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={
              'relative px-[18px] py-2.5 text-[13px] font-medium transition-colors ' +
              (tab === t.id
                ? 'text-sm-ink after:absolute after:inset-x-[18px] after:-bottom-px after:h-0.5 after:bg-sm-violet'
                : 'text-sm-ink3 hover:text-sm-ink2')
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab !== 'catchment' && tab !== 'planning' && (
        <BrandFilterBar
          categoryOptions={categoryOptions}
          brandOptions={brandOptions}
          selectedCategoryIds={brandFilterCategoryIds}
          selectedBrandIds={brandFilterBrandIds}
          onCategoryChange={setBrandFilterCategoryIds}
          onBrandChange={setBrandFilterBrandIds}
          onClear={clearBrandFilters}
        />
      )}

      <div className="min-h-0 flex-1 overflow-y-auto">
        {tab === 'catchment' ? (
          <CatchmentTab data={catchmentData} />
        ) : tab === 'planning' ? (
          <PlanningBody
            loading={planningLoading}
            error={planningError}
            truncated={planningTruncated}
            applications={planningApplications}
            onOpen={onOpenPlanning}
          />
        ) : tab === 'present' ? (
          <PresentBody loading={landscape.loading} present={presentBrands} />
        ) : (
          <MissingBody
            loading={landscape.loading}
            missing={missingBrands}
            requirements={requirements}
            areaName={areaName}
            onOpenReq={onOpenReq}
            onOpenBrand={onOpenBrand}
          />
        )}
      </div>
    </aside>
  )
}

/* ---------- Router: decide which inspector to render ---------- */

export function UInspector({
  hidden,
  onToggle,
  findResults,
  findTotal,
  findLoading,
  findError,
  landscape,
  presentBrands,
  missingBrands,
  requirements,
  catchment,
  categoryOptions,
  brandOptions,
  planningApplications,
  planningLoading,
  planningError,
  planningTruncated,
}: {
  hidden: boolean
  onToggle: () => void
  findResults: BUAResult[]
  findTotal: number
  findLoading: boolean
  findError: string | null
  landscape: Landscape
  presentBrands: PresentBrand[]
  missingBrands: MissingBrand[]
  requirements: RequirementLocation[]
  catchment: CatchmentData
  categoryOptions: FilterOption[]
  brandOptions: FilterOption[]
  planningApplications: PlanningApplication[]
  planningLoading: boolean
  planningError: string | null
  planningTruncated: boolean
}) {
  const view = useWorkspaceStore((s) => s.view)
  const area = useWorkspaceStore((s) => s.area)
  const assessPoint = useWorkspaceStore((s) => s.assessPoint)
  const comparePair = useWorkspaceStore((s) => s.comparePair)
  const activeCompareArm = useWorkspaceStore((s) => s.activeCompareArm)
  const selectArea = useWorkspaceStore((s) => s.selectArea)
  const setAssessPoint = useWorkspaceStore((s) => s.setAssessPoint)
  const setReqModal = useWorkspaceStore((s) => s.setReqModal)
  const setBrandModal = useWorkspaceStore((s) => s.setBrandModal)
  const setPlanningModal = useWorkspaceStore((s) => s.setPlanningModal)

  if (hidden) {
    return (
      <aside className="flex w-11 shrink-0 flex-col items-center border-l border-sm-border bg-sm-surface pt-3">
        <button
          type="button"
          onClick={onToggle}
          aria-label="Show right panel"
          title="Show right panel"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-sm-ink3 hover:bg-sm-bg hover:text-sm-ink"
        >
          <PanelRightOpen size={16} />
        </button>
      </aside>
    )
  }

  // A selected BUA takes priority over everything.
  if (area) {
    return (
      <Opportunity
        title={area.name}
        areaName={area.name}
        subtitle={area.region ? `Opportunity · ${area.region}` : 'Opportunity'}
        landscape={landscape}
        presentBrands={presentBrands}
        missingBrands={missingBrands}
        requirements={requirements}
        catchmentData={catchment}
        categoryOptions={categoryOptions}
        brandOptions={brandOptions}
        planningApplications={planningApplications}
        planningLoading={planningLoading}
        planningError={planningError}
        planningTruncated={planningTruncated}
        onClose={() => selectArea(null)}
        onCollapse={onToggle}
        onOpenReq={setReqModal}
        onOpenBrand={setBrandModal}
        onOpenPlanning={setPlanningModal}
      />
    )
  }

  // Assess mode with a dropped point: read the landscape around it. While
  // comparing, the header follows the active arm (Pin A / Pin B) so the figures
  // and label stay in sync with the pin being edited.
  if (view === 'assess' && assessPoint) {
    const activePoint = comparePair ? comparePair[activeCompareArm] : assessPoint
    const title = comparePair
      ? `Pin ${activeCompareArm.toUpperCase()}`
      : 'Dropped point'
    return (
      <Opportunity
        title={title}
        areaName="this location"
        subtitle={`${activePoint.lat.toFixed(4)}, ${activePoint.lng.toFixed(4)}`}
        landscape={landscape}
        presentBrands={presentBrands}
        missingBrands={missingBrands}
        requirements={requirements}
        catchmentData={catchment}
        categoryOptions={categoryOptions}
        brandOptions={brandOptions}
        planningApplications={planningApplications}
        planningLoading={planningLoading}
        planningError={planningError}
        planningTruncated={planningTruncated}
        onClose={() => setAssessPoint(null)}
        onCollapse={onToggle}
        onOpenReq={setReqModal}
        onOpenBrand={setBrandModal}
        onOpenPlanning={setPlanningModal}
      />
    )
  }

  // Find mode with no selection: the ranked results list.
  if (view === 'find') {
    return (
      <FindResults
        results={findResults}
        total={findTotal}
        loading={findLoading}
        error={findError}
        onCollapse={onToggle}
      />
    )
  }

  return null
}

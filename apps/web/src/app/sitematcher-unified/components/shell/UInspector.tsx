'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
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
  GapResult,
  GapItem,
  InspectorTab,
  MissingFascia,
  MissingBrand,
  NationwideRequirement,
  PlanningApplication,
  PlanningProgress,
  PlanningTruncationReason,
  PresentBrand,
  RequirementLocation,
  RequirementSummary,
} from '../../types/unified-workspace'
import type { CatchmentData } from '../../lib/hooks/useCatchment'
import type { Landscape } from '../../lib/hooks/useAreaData'
import type { FloorAreaProfiles } from '../../lib/hooks/useFloorAreaProfiles'
import { BrandFilterBar, type FilterOption } from './BrandFilterBar'
import { CatchmentTab } from './CatchmentTab'
import {
  ObservedSize,
  MeasuredShops,
  FasciaSizes,
  NearMissTag,
  NoSizeChip,
  GroupHeader,
  SizeFootnote,
} from './SizeBlocks'
import {
  bandById,
  bandFitCounts,
  classify,
  entrySampleCount,
  formatMeasuredShops,
  formatSqFtRange,
  measuredFootnote,
  matchingProfiles,
  measuredRange,
  partitionBySize,
  unknownCount,
  type FloorAreaProfile,
  type MeasuredEstate,
  type SizeBand,
  type SizeBandId,
  type SizeEntry,
  type SizeFit,
} from '../../lib/size-filter'

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

function radiusPhrase(km: number, areaLabel = 'town'): string {
  return km === 0 ? `in the ${areaLabel}` : `within ${km} km`
}

// "Two boxes, one list" onboarding shown before any filter is added.
function FindEmpty({ geography }: { geography: 'town' | 'retail_centre' }) {
  const noun = geography === 'town' ? 'town' : 'retail centre'
  const points = [
    ['Box 1', `the brands/categories a ${noun} is missing`],
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
        Fill the two boxes on the left to build a location strategy. We&apos;ll show every UK{' '}
        {noun} that matches — your white space, ready to work.
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
  results: GapResult[]
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
  const gapGeography = useWorkspaceStore((s) => s.gapGeography)
  const retailForms = useWorkspaceStore((s) => s.retailForms)
  const retailClassifications = useWorkspaceStore((s) => s.retailClassifications)
  const [exporting, setExporting] = useState(false)

  const hasQuery = missingItems.length > 0 || haveItems.length > 0
  const pct = total > 0 ? Math.max(4, Math.round((results.length / total) * 100)) : 0

  const sorted = useMemo(() => {
    const arr = [...results]
    if (gapSort === 'az') {
      arr.sort((a, b) => a.name.localeCompare(b.name))
    } else if (gapSort === 'retail_count') {
      arr.sort((a, b) =>
        ('retail_count' in b ? b.retail_count ?? -1 : -1) -
        ('retail_count' in a ? a.retail_count ?? -1 : -1)
      )
    } else {
      arr.sort((a, b) =>
        ('pop' in b ? b.pop_final ?? b.pop : 0) -
        ('pop' in a ? a.pop_final ?? a.pop : 0)
      )
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
          geography: gapGeography,
          ...(gapGeography === 'town'
            ? {
                minPop: showSubFiveK ? 0 : populationRange[0],
                maxPop: populationRange[1],
              }
            : { retailForms, retailClassifications }),
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
              {gapGeography === 'town' ? 'Towns' : 'Retail centres'}{' '}
              {missingItems.length > 0 && (
                <>
                  missing <b className="font-semibold text-sm-ink">{joinLabels(missingItems)}</b>
                  {missingRadius > 0 && <> {radiusPhrase(missingRadius, gapGeography === 'town' ? 'town' : 'retail centre')}</>}
                </>
              )}
              {missingItems.length > 0 && haveItems.length > 0 && ', '}
              {haveItems.length > 0 && (
                <>
                  that have <b className="font-semibold text-sm-ink">{joinLabels(haveItems)}</b>{' '}
                  {radiusPhrase(haveRadius, gapGeography === 'town' ? 'town' : 'retail centre')}
                </>
              )}
              {gapGeography === 'town' && (
                <>
                  , with a population of{' '}
                  <b className="font-semibold text-sm-ink">
                    {popShort(showSubFiveK ? 0 : populationRange[0])}–{popShort(populationRange[1])}
                  </b>
                </>
              )}
              .
            </div>

            <div className="mt-4 flex items-center justify-between">
              <div>
                <Kicker>
                  Matching {gapGeography === 'town' ? 'towns' : 'retail centres'}
                </Kicker>
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
              {(gapGeography === 'town'
                ? (['pop', 'az'] as const)
                : (['retail_count', 'az'] as const)
              ).map((s) => (
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
                  {s === 'pop'
                    ? 'Population ↓'
                    : s === 'retail_count'
                      ? 'Retail units ↓'
                      : 'A–Z'}
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
        {!hasQuery && <FindEmpty geography={gapGeography} />}
        {hasQuery && error && (
          <div className="px-[18px] py-6 text-center text-[12.5px] text-[#B23A2C]">
            {error}
          </div>
        )}
        {hasQuery && !error && results.length === 0 && !loading && (
          <div className="px-[18px] py-8 text-center text-[12.5px] text-sm-ink3">
            No {gapGeography === 'town' ? 'towns' : 'retail centres'} match these
            filters. Loosen a rule
            {gapGeography === 'town' ? ' or widen the population range' : ' or type filter'}.
          </div>
        )}
        {hasQuery &&
          sorted.map((b) => {
            const isRetail = 'rc_id' in b
            const pop = !isRetail ? b.pop_final ?? b.pop : null
            return (
              <button
                key={isRetail ? b.rc_id : b.gsscode}
                type="button"
                onClick={() =>
                  selectArea({
                    id: isRetail ? b.rc_id : b.gsscode,
                    name: b.name,
                    center: [b.centroid_lon, b.centroid_lat],
                    population: pop ?? undefined,
                    kind: isRetail ? 'retail_centre' : 'bua',
                    region: isRetail ? b.region_name ?? undefined : undefined,
                    classification: isRetail ? b.classification : undefined,
                    retailCount: isRetail ? b.retail_count ?? undefined : undefined,
                    retailForm: isRetail ? b.form : undefined,
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
                    {isRetail
                      ? `${b.classification} · ${(b.retail_count ?? 0).toLocaleString()} retail units`
                      : `Pop ${(pop ?? 0).toLocaleString()}`}
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
                          {haveTag} {radiusPhrase(haveRadius, gapGeography === 'town' ? 'town' : 'retail centre')}
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

// The size the filter reads a brand by, and how it is drawn. A brand with more
// than one profile trades in more than one format, and gets a row per fascia:
// one median across Tesco Express and Tesco Extra describes neither.
function fasciaHeading(
  all: FloorAreaProfile[],
  shown: FloorAreaProfile[],
  band: SizeBand | null
): string {
  if (!band) return 'Trades across formats · filter by size to narrow'
  return shown.length < all.length ? 'Matching format' : 'Trades across formats'
}

function SizeDetail({
  profiles,
  measured,
  band,
  label,
}: {
  profiles: FloorAreaProfile[]
  measured: MeasuredEstate | null
  band: SizeBand | null
  label?: string | null
}) {
  // A brand below the profile sample floor still has something to say — its
  // shops, shown as shops rather than as a distribution.
  if (profiles.length === 0 && measured)
    return <MeasuredShops measured={measured} label={label ?? undefined} />
  if (profiles.length === 0) return null
  if (profiles.length === 1)
    return <ObservedSize profile={profiles[0]} label={label} />
  const shown = matchingProfiles(profiles, band)
  return (
    <FasciaSizes profiles={shown} heading={fasciaHeading(profiles, shown, band)} />
  )
}

function MissingRow({
  m,
  profiles,
  measured,
  band,
  fit,
  onOpen,
}: {
  m: MissingBrand
  profiles: FloorAreaProfile[]
  measured: MeasuredEstate | null
  band: SizeBand | null
  fit: SizeFit | null
  onOpen: (m: MissingFascia) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen(m.representative)}
      className={
        'grid grid-cols-[36px_1fr_auto] items-start gap-3 rounded-xl border bg-sm-surface p-3 text-left hover:bg-sm-bg ' +
        (fit === 'near' ? 'border-[#F0DEBE]' : 'border-sm-border')
      }
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
        <SizeDetail profiles={profiles} measured={measured} band={band} />
        {/* "We don't know" only needs saying once the user is filtering on size. */}
        {profiles.length === 0 && !measured && band && <NoSizeChip />}
        {fit === 'near' && <NearMissTag />}
      </div>
      <ChevronRight size={15} className="mt-0.5 text-sm-ink4" />
    </button>
  )
}

// Promoted "wants to open here" row for an occupier with a live requirement
// whose target location falls within the active catchment. The requirement is
// the current, authoritative claim, so it leads the card; the measured estate
// sits below it under its own label, never merged into the same figure.
function RequirementRow({
  req,
  nationwide = false,
  profiles,
  measured,
  band,
  fit,
  onOpen,
}: {
  req: RequirementSummary
  nationwide?: boolean
  profiles: FloorAreaProfile[]
  measured: MeasuredEstate | null
  band: SizeBand | null
  fit: SizeFit | null
  onOpen: (requirementId: string) => void
}) {
  const sizeRange = formatRequirementSizeRange(req)
  return (
    <button
      type="button"
      onClick={() => onOpen(req.requirementId)}
      className={
        'rounded-xl border bg-sm-violet-tint-soft p-3 text-left hover:brightness-[0.98] ' +
        (fit === 'near' ? 'border-[#F0DEBE]' : 'border-sm-violet-tint')
      }
    >
      <div className="mb-2 flex items-center gap-1.5">
        <span className="rounded-full bg-sm-violet px-2 py-[3px] font-mono text-[9.5px] font-semibold uppercase tracking-wider text-white">
          Requirement
        </span>
        <span className="font-mono text-[9.5px] font-semibold uppercase tracking-wider text-sm-violet-deep">
          {nationwide ? 'Searching nationwide' : 'Wants to open here'}
        </span>
      </div>
      <div className="grid grid-cols-[36px_1fr_auto] items-start gap-3">
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
          <SizeDetail
            profiles={profiles}
            measured={measured}
            band={band}
            label="Estate today"
          />
          {fit === 'near' && <NearMissTag />}
        </div>
        <ChevronRight size={15} className="mt-0.5 text-sm-violet-deep" />
      </div>
    </button>
  )
}

function formatRequirementSizeRange(req: RequirementSummary): string | null {
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

function TradingRow({
  b,
  profiles,
  measured,
  band,
  fit,
}: {
  b: PresentBrand
  profiles: FloorAreaProfile[]
  measured: MeasuredEstate | null
  band: SizeBand | null
  fit: SizeFit | null
}) {
  const count = `${b.storeCount} ${b.storeCount === 1 ? 'store' : 'stores'}`
  const meta = b.town ? `${count} · ${b.town}` : count
  const setHoveredBrandId = useWorkspaceStore((s) => s.setHoveredBrandId)
  const setBrandInfoId = useWorkspaceStore((s) => s.setBrandInfoId)
  return (
    <button
      type="button"
      onClick={() => setBrandInfoId(b.brandId)}
      onMouseEnter={() => setHoveredBrandId(b.brandId)}
      onMouseLeave={() => setHoveredBrandId(null)}
      className={
        'grid w-full cursor-pointer grid-cols-[28px_1fr] items-start gap-3 border-b px-[18px] py-2.5 text-left transition-colors hover:bg-sm-bg ' +
        (fit === 'near' ? 'border-[#F0DEBE] bg-[#FEFCF7]' : 'border-sm-border-soft')
      }
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
          {meta}
        </div>
        {/* On Present, the observed block answers "which of their local formats
            would my unit be?", so it carries no second label. */}
        <SizeDetail profiles={profiles} measured={measured} band={band} />
        {profiles.length === 0 && !measured && band && <NoSizeChip />}
        {fit === 'near' && <NearMissTag />}
      </div>
    </button>
  )
}

// The simplified row used by both demoted groups. `dimmed` is the "outside"
// treatment: still there, still callable, just not the answer to this question.
function DemotedRow({
  name,
  meta,
  domain,
  logoUrl,
  profiles,
  measured,
  dimmed,
  onClick,
}: {
  name: string
  meta: string | null
  domain: string | null
  logoUrl: string | null
  profiles: FloorAreaProfile[]
  measured?: MeasuredEstate | null
  dimmed?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        'grid w-full grid-cols-[28px_1fr_auto] items-center gap-3 rounded-xl border border-sm-border-soft bg-sm-surface px-3 py-2.5 text-left hover:bg-sm-bg ' +
        (dimmed ? 'opacity-[0.72]' : '')
      }
    >
      <BrandLogo label={name} domain={domain} logoUrl={logoUrl} size={28} />
      <div className="min-w-0">
        <div className="truncate text-[13px] font-semibold text-sm-ink">{name}</div>
        {profiles.length > 0 || measured ? (
          <div className="mt-0.5">
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-[11px] text-sm-ink3">
                {profiles.length > 0
                  ? formatSqFtRange(
                      Math.min(...profiles.map((p) => p.p25SqFt)),
                      Math.max(...profiles.map((p) => p.p75SqFt))
                    )
                  : formatMeasuredShops(measured!)}
              </span>
              <span className="text-[10px] text-sm-ink4">sq ft GIA</span>
            </div>
            {/* A demoted brand is exactly where thin evidence needs stating: a
                brand pushed out of the list on two measured shops of thirty
                should show that it was two of thirty. */}
            {profiles.length === 0 && measured && (
              <div className="text-[10px] text-sm-ink4">
                {measuredFootnote(measured)}
              </div>
            )}
          </div>
        ) : (
          meta && (
            <div className="mt-0.5 truncate font-mono text-[10px] uppercase tracking-wide text-sm-ink3">
              {meta}
            </div>
          )
        )}
      </div>
      <ChevronRight size={14} className="text-sm-ink4" />
    </button>
  )
}

// The two groups a size band creates below the main list. They are the whole
// point of not hard-filtering: a brand whose size we've never measured is a
// different answer from one that doesn't fit, and neither is a "no".
function DemotedGroup({
  title,
  note,
  count,
  open,
  onToggle,
  children,
}: {
  title: string
  note?: string
  count: number
  open: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <div className="mt-3">
      <GroupHeader title={title} count={count} open={open} onToggle={onToggle} />
      {note && (
        <p className="mb-2 text-[11px] leading-[1.5] text-sm-ink3">{note}</p>
      )}
      {open && <div className="flex flex-col gap-2">{children}</div>}
    </div>
  )
}

// One row of the Missing tab before the size filter has had its say: either a
// live requirement or an established brand with no presence here.
type MissingItem =
  | {
      kind: 'req'
      key: string
      req: RequirementSummary
      brandId: string | null
      nationwide: boolean
    }
  | { kind: 'brand'; key: string; brand: MissingBrand; brandId: string }

function missingEntry(
  item: MissingItem,
  profilesFor: (brandId: string | null) => FloorAreaProfile[],
  measuredFor: (brandId: string | null) => MeasuredEstate | null
): SizeEntry {
  const profiles = profilesFor(item.brandId)
  const measured = profiles.length === 0 ? measuredFor(item.brandId) : null
  if (item.kind === 'req') {
    return {
      key: item.key,
      hasRequirement:
        item.req.siteSizeMin != null || item.req.siteSizeMax != null,
      // Only a sq ft requirement is a size claim; acreage and dwelling counts
      // describe a different kind of site and must not be matched as floor area.
      requirement: {
        min: item.req.siteSizeMin,
        max: item.req.siteSizeMax,
      },
      profiles,
      measured,
      sampleCount: entrySampleCount(profiles),
      name: item.req.companyName,
    }
  }
  return {
    key: item.key,
    hasRequirement: false,
    requirement: null,
    profiles,
    measured,
    // A handful of measured shops is real evidence but a small amount of it, so
    // these sort below a brand with a full distribution inside the same tier.
    sampleCount: entrySampleCount(profiles) || (measured?.measuredSqFt.length ?? 0),
    name: item.brand.brandName,
  }
}

function presentEntry(
  brand: PresentBrand,
  profilesFor: (brandId: string | null) => FloorAreaProfile[],
  measuredFor: (brandId: string | null) => MeasuredEstate | null
): SizeEntry {
  const profiles = profilesFor(brand.brandId)
  const measured = profiles.length === 0 ? measuredFor(brand.brandId) : null
  return {
    key: brand.brandId,
    hasRequirement: false,
    requirement: null,
    profiles,
    measured,
    sampleCount: entrySampleCount(profiles) || (measured?.measuredSqFt.length ?? 0),
    name: brand.brandName,
  }
}

// Shown when a band matches nothing known. Never a dead end: the groups below
// it are still on screen and still worth a phone call.
function NoSizeResults({ band }: { band: SizeBand }) {
  return (
    <div className="rounded-xl border border-dashed border-sm-border bg-sm-bg px-3 py-5 text-center">
      <div className="text-[13.5px] font-semibold text-sm-ink">
        No known-size brands fit {band.short} sq ft
      </div>
      <div className="mt-1 text-[11.5px] leading-[1.5] text-sm-ink3">
        Absence isn&apos;t a no — the near-miss and no-size brands below are still
        worth a call.
      </div>
    </div>
  )
}

export function MissingBody({
  loading,
  missing,
  requirements,
  nationwideRequirements,
  areaName,
  band,
  profilesFor,
  measuredFor,
  onOpenReq,
  onOpenBrand,
}: {
  loading: boolean
  missing: MissingBrand[]
  requirements: RequirementLocation[]
  nationwideRequirements: NationwideRequirement[]
  areaName: string
  band: SizeBand | null
  profilesFor: (brandId: string | null) => FloorAreaProfile[]
  measuredFor: (brandId: string | null) => MeasuredEstate | null
  onOpenReq: (requirementId: string) => void
  onOpenBrand: (m: MissingFascia) => void
}) {
  const gapCount = requirements.length + nationwideRequirements.length + missing.length
  const [unknownOpen, setUnknownOpen] = useState(true)
  const [outsideOpen, setOutsideOpen] = useState(false)

  // A new band collapses the "outside" group again — it is the answer the user
  // least wants after changing their mind about the unit.
  useEffect(() => {
    setOutsideOpen(false)
  }, [band?.id])

  const items = useMemo<MissingItem[]>(
    () => [
      ...requirements.map((r) => ({
        kind: 'req' as const,
        key: `req:${r.id}`,
        req: r,
        brandId: r.brandId,
        nationwide: false,
      })),
      ...nationwideRequirements.map((r) => ({
        kind: 'req' as const,
        key: `req:nationwide:${r.id}`,
        req: r,
        brandId: r.brandId,
        nationwide: true,
      })),
      ...missing.map((m) => ({
        kind: 'brand' as const,
        key: `brand:${m.brandId}`,
        brand: m,
        brandId: m.brandId,
      })),
    ],
    [requirements, nationwideRequirements, missing]
  )

  const { main, unknown, outside, fits } = useMemo(() => {
    if (!band) {
      return {
        main: items,
        unknown: [] as MissingItem[],
        outside: [] as MissingItem[],
        fits: new Map<string, SizeFit>(),
      }
    }
    const part = partitionBySize(
      items,
      (i) => missingEntry(i, profilesFor, measuredFor),
      band
    )
    const byKey = new Map<string, SizeFit>()
    for (const i of part.main)
      byKey.set(i.key, classify(missingEntry(i, profilesFor, measuredFor), band))
    return { ...part, fits: byKey }
  }, [items, band, profilesFor, measuredFor])

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
          {requirements.length > 0 && nationwideRequirements.length > 0
            ? `Occupiers naming ${areaName} show first, followed by occupiers searching nationwide, then established brands with no presence here.`
            : requirements.length > 0
              ? `Occupiers with a live requirement naming ${areaName} show first, then established brands with no presence here.`
              : nationwideRequirements.length > 0
                ? 'Occupiers searching nationwide show first, then established brands with no presence nearby.'
                : 'Established brands with no presence nearby that fit this location.'}
          {band ? ' Sized against your unit.' : ' Set a size to match your unit.'}
        </p>
      </div>
      <div className="flex flex-col gap-2 px-[18px] pb-[18px] pt-2.5">
        {!loading && gapCount === 0 && (
          <div className="rounded-xl border border-dashed border-sm-border bg-sm-bg px-3 py-3.5 text-center text-[12.5px] text-sm-ink3">
            No missing brands found for this catchment.
          </div>
        )}
        {band && gapCount > 0 && main.length === 0 && <NoSizeResults band={band} />}

        {main.map((item) =>
          item.kind === 'req' ? (
            <RequirementRow
              key={item.key}
              req={item.req}
              nationwide={item.nationwide}
              profiles={profilesFor(item.brandId)}
              measured={measuredFor(item.brandId)}
              band={band}
              fit={fits.get(item.key) ?? null}
              onOpen={onOpenReq}
            />
          ) : (
            <MissingRow
              key={item.key}
              m={item.brand}
              profiles={profilesFor(item.brandId)}
              measured={measuredFor(item.brandId)}
              band={band}
              fit={fits.get(item.key) ?? null}
              onOpen={onOpenBrand}
            />
          )
        )}

        {unknown.length > 0 && (
          <DemotedGroup
            title="Size not on record"
            note="We don't know their format yet — that's different from not fitting. Still callable."
            count={unknown.length}
            open={unknownOpen}
            onToggle={() => setUnknownOpen((v) => !v)}
          >
            {unknown.map((item) => (
              <DemotedRow
                key={item.key}
                name={
                  item.kind === 'req' ? item.req.companyName : item.brand.brandName
                }
                meta={
                  item.kind === 'req'
                    ? `${item.nationwide ? 'Nationwide requirement' : 'Live requirement'} · no size stated`
                    : missingMeta(item.brand)
                }
                domain={
                  item.kind === 'req' ? item.req.companyDomain : item.brand.logoDomain
                }
                logoUrl={item.kind === 'req' ? item.req.logoUrl : item.brand.logoUrl}
                profiles={[]}
                onClick={() =>
                  item.kind === 'req'
                    ? onOpenReq(item.req.requirementId)
                    : onOpenBrand(item.brand.representative)
                }
              />
            ))}
          </DemotedGroup>
        )}

        {band && outside.length > 0 && (
          <DemotedGroup
            title={`Outside ${band.short} sq ft`}
            count={outside.length}
            open={outsideOpen}
            onToggle={() => setOutsideOpen((v) => !v)}
          >
            {outside.map((item) => (
              <DemotedRow
                key={item.key}
                name={
                  item.kind === 'req' ? item.req.companyName : item.brand.brandName
                }
                meta={
                  item.kind === 'req'
                    ? formatRequirementSizeRange(item.req)
                    : missingMeta(item.brand)
                }
                domain={
                  item.kind === 'req' ? item.req.companyDomain : item.brand.logoDomain
                }
                logoUrl={item.kind === 'req' ? item.req.logoUrl : item.brand.logoUrl}
                profiles={item.kind === 'req' ? [] : profilesFor(item.brandId)}
                measured={item.kind === 'req' ? null : measuredFor(item.brandId)}
                dimmed
                onClick={() =>
                  item.kind === 'req'
                    ? onOpenReq(item.req.requirementId)
                    : onOpenBrand(item.brand.representative)
                }
              />
            ))}
          </DemotedGroup>
        )}

        {!loading && gapCount > 0 && <SizeFootnote />}
      </div>
    </>
  )
}

function missingMeta(m: MissingBrand): string | null {
  const parts: string[] = []
  if (m.categoryName) parts.push(m.categoryName)
  if (m.nearestStoreDistance != null)
    parts.push(`nearest ${(m.nearestStoreDistance / 1000).toFixed(1)} km`)
  return parts.length > 0 ? parts.join(' · ') : null
}

function presentMeta(b: PresentBrand): string {
  const count = `${b.storeCount} ${b.storeCount === 1 ? 'store' : 'stores'}`
  return b.town ? `${count} · ${b.town}` : count
}

export function PresentBody({
  loading,
  present,
  band,
  profilesFor,
  measuredFor,
}: {
  loading: boolean
  present: PresentBrand[]
  band: SizeBand | null
  profilesFor: (brandId: string | null) => FloorAreaProfile[]
  measuredFor: (brandId: string | null) => MeasuredEstate | null
}) {
  const setBrandInfoId = useWorkspaceStore((s) => s.setBrandInfoId)
  const [unknownOpen, setUnknownOpen] = useState(true)
  const [outsideOpen, setOutsideOpen] = useState(false)

  useEffect(() => {
    setOutsideOpen(false)
  }, [band?.id])

  const { main, unknown, outside, fits } = useMemo(() => {
    if (!band) {
      return {
        main: present,
        unknown: [] as PresentBrand[],
        outside: [] as PresentBrand[],
        fits: new Map<string, SizeFit>(),
      }
    }
    const part = partitionBySize(
      present,
      (b) => presentEntry(b, profilesFor, measuredFor),
      band
    )
    const byKey = new Map<string, SizeFit>()
    for (const b of part.main)
      byKey.set(b.brandId, classify(presentEntry(b, profilesFor, measuredFor), band))
    return { ...part, fits: byKey }
  }, [present, band, profilesFor, measuredFor])

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
          {band
            ? ' Their local format is matched against your unit.'
            : ' Set a size to see whose local format fits your unit.'}
        </p>
      </div>
      <div className="pt-2.5">
        {!loading && present.length === 0 && (
          <div className="px-[18px] py-3 text-[12.5px] text-sm-ink3">
            No brands trading within this catchment.
          </div>
        )}
        {band && present.length > 0 && main.length === 0 && (
          <div className="px-[18px] pb-2">
            <NoSizeResults band={band} />
          </div>
        )}
        {main.map((b) => (
          <TradingRow
            key={b.brandId}
            b={b}
            profiles={profilesFor(b.brandId)}
            measured={measuredFor(b.brandId)}
            band={band}
            fit={fits.get(b.brandId) ?? null}
          />
        ))}

        <div className="px-[18px]">
          {unknown.length > 0 && (
            <DemotedGroup
              title="Size not on record"
              note="We don't know their format yet — that's different from not fitting. Still callable."
              count={unknown.length}
              open={unknownOpen}
              onToggle={() => setUnknownOpen((v) => !v)}
            >
              {unknown.map((b) => (
                <DemotedRow
                  key={b.brandId}
                  name={b.brandName}
                  meta={presentMeta(b)}
                  domain={b.logoDomain}
                  logoUrl={b.logoUrl}
                  profiles={[]}
                  onClick={() => setBrandInfoId(b.brandId)}
                />
              ))}
            </DemotedGroup>
          )}

          {band && outside.length > 0 && (
            <DemotedGroup
              title={`Outside ${band.short} sq ft`}
              count={outside.length}
              open={outsideOpen}
              onToggle={() => setOutsideOpen((v) => !v)}
            >
              {outside.map((b) => (
                <DemotedRow
                  key={b.brandId}
                  name={b.brandName}
                  meta={presentMeta(b)}
                  domain={b.logoDomain}
                  logoUrl={b.logoUrl}
                  profiles={profilesFor(b.brandId)}
                  measured={measuredFor(b.brandId)}
                  dimmed
                  onClick={() => setBrandInfoId(b.brandId)}
                />
              ))}
            </DemotedGroup>
          )}

          {!loading && present.length > 0 && (
            <div className="pb-[18px]">
              <SizeFootnote />
            </div>
          )}
        </div>
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

export function planningTruncationMessage(
  reason: PlanningTruncationReason
): string | null {
  switch (reason) {
    case 'authority_cap':
      return 'This area spans a lot of councils, so only part of it was checked.'
    case 'rate_limited':
      return 'PlanIt temporarily limited the search, so results may be incomplete.'
    case 'upstream_busy':
      return 'PlanIt was busy for some councils, so results may be incomplete.'
    case 'upstream_timeout':
    case 'upstream_error':
      return "Some councils didn't respond, so results may be incomplete."
    case 'page_cap':
    case 'record_cap':
      return 'There are more matching applications than we can show here.'
    default:
      return null
  }
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

// A lookup fans out across every council covering the area, which can take a
// while, so the spinner reports how far through it is rather than sitting on a
// bare "loading" for minutes.
export function planningProgressMessage(
  progress: PlanningProgress | null
): string {
  if (!progress || progress.total <= 0) return 'Reading planning applications…'
  const { done, total } = progress
  return `Checking council ${Math.min(done + 1, total)} of ${total}…`
}

function PlanningBody({
  loading,
  error,
  truncated,
  truncationReason,
  progress,
  applications,
  onOpen,
}: {
  loading: boolean
  error: string | null
  truncated: boolean
  truncationReason: PlanningTruncationReason
  progress: PlanningProgress | null
  applications: PlanningApplication[]
  onOpen: (app: PlanningApplication) => void
}) {
  const warning = planningTruncationMessage(truncationReason)
  return (
    <>
      {loading && (
        <div className="flex items-center gap-2 px-[18px] py-4 text-[12.5px] text-sm-ink3">
          <Loader2 size={13} className="animate-spin" />{' '}
          {planningProgressMessage(progress)}
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
        {truncated && warning && !loading && !error && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-[12.5px] text-amber-800">
            {warning}
          </div>
        )}
        {/* Only claim the area is empty when the search actually completed —
            a truncated run has its own amber notice and must not also assert
            there is nothing here. */}
        {!loading && !error && !truncated && applications.length === 0 && (
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
  nationwideRequirements,
  catchmentData,
  categoryOptions,
  brandOptions,
  floorAreaProfiles,
  planningApplications,
  planningLoading,
  planningError,
  planningTruncated,
  planningTruncationReason,
  planningProgress,
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
  nationwideRequirements: NationwideRequirement[]
  catchmentData: CatchmentData
  categoryOptions: FilterOption[]
  brandOptions: FilterOption[]
  floorAreaProfiles: FloorAreaProfiles
  planningApplications: PlanningApplication[]
  planningLoading: boolean
  planningError: string | null
  planningTruncated: boolean
  planningTruncationReason: PlanningTruncationReason
  planningProgress: PlanningProgress | null
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
  const brandFilterSizeBandId = useWorkspaceStore((s) => s.brandFilterSizeBandId)
  const setBrandFilterSizeBandId = useWorkspaceStore(
    (s) => s.setBrandFilterSizeBandId
  )
  const clearBrandFilters = useWorkspaceStore((s) => s.clearBrandFilters)

  // A brand with no profile is "size not on record", which the panel says out
  // loud rather than treating as a non-match.
  const profilesByBrand = floorAreaProfiles.byBrand
  const profilesFor = useCallback(
    (brandId: string | null) => (brandId ? (profilesByBrand[brandId] ?? []) : []),
    [profilesByBrand]
  )
  // Brands too small for a distribution, carrying their measured shops instead.
  const measuredByBrand = floorAreaProfiles.measuredByBrand
  const measuredFor = useCallback(
    (brandId: string | null) => (brandId ? (measuredByBrand[brandId] ?? null) : null),
    [measuredByBrand]
  )

  const band = bandById(brandFilterSizeBandId)

  // Popover counts run over the tab the user is looking at, after Category and
  // Brand have had their say — the question is "how many of THESE fit my unit".
  const sizeEntries = useMemo<SizeEntry[]>(() => {
    if (tab === 'present') {
      return presentBrands.map((b) => presentEntry(b, profilesFor, measuredFor))
    }
    if (tab !== 'missing') return []
    return [
      ...requirements.map((r) =>
        missingEntry(
          {
            kind: 'req',
            key: `req:${r.id}`,
            req: r,
            brandId: r.brandId,
            nationwide: false,
          },
          profilesFor,
          measuredFor
        )
      ),
      ...nationwideRequirements.map((r) =>
        missingEntry(
          {
            kind: 'req',
            key: `req:nationwide:${r.id}`,
            req: r,
            brandId: r.brandId,
            nationwide: true,
          },
          profilesFor,
          measuredFor
        )
      ),
      ...missingBrands.map((m) =>
        missingEntry(
          { kind: 'brand', key: `brand:${m.brandId}`, brand: m, brandId: m.brandId },
          profilesFor,
          measuredFor
        )
      ),
    ]
  }, [
    tab,
    presentBrands,
    missingBrands,
    requirements,
    nationwideRequirements,
    profilesFor,
    measuredFor,
  ])

  const sizeFitCounts = useMemo(() => bandFitCounts(sizeEntries), [sizeEntries])
  const sizeUnknownCount = useMemo(() => unknownCount(sizeEntries), [sizeEntries])
  const isRetailCentre = area?.kind === 'retail_centre'
  const opportunityTabs = isRetailCentre
    ? OPP_TABS.filter((item) => item.id !== 'catchment')
    : OPP_TABS

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
                  {isRetailCentre ? 'Classification' : 'Population'}
                </div>
                <div className="mt-0.5 text-[17px] font-semibold leading-none text-sm-ink">
                  {isRetailCentre ? area.classification ?? '—' : popLabel}
                </div>
              </div>
              <div className="rounded-lg border border-sm-border-soft bg-emerald-500/[0.07] px-2.5 py-1.5">
                <div className="text-[9.5px] font-medium uppercase tracking-wide text-sm-ink3">
                  {isRetailCentre ? 'Retail units' : 'Affluence'}
                </div>
                <div className="mt-0.5 text-[17px] font-semibold leading-none text-sm-ink">
                  {isRetailCentre ? area.retailCount?.toLocaleString() ?? '—' : affluenceLabel}
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
        {opportunityTabs.map((t) => (
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
          sizeBandId={brandFilterSizeBandId}
          sizeFitCounts={sizeFitCounts}
          sizeUnknownCount={sizeUnknownCount}
          showSizeFilter={!floorAreaProfiles.unavailable}
          onCategoryChange={setBrandFilterCategoryIds}
          onBrandChange={setBrandFilterBrandIds}
          onSizeBandChange={setBrandFilterSizeBandId}
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
            truncationReason={planningTruncationReason}
            progress={planningProgress}
            applications={planningApplications}
            onOpen={onOpenPlanning}
          />
        ) : tab === 'present' ? (
          <PresentBody
            loading={landscape.loading}
            present={presentBrands}
            band={band}
            profilesFor={profilesFor}
            measuredFor={measuredFor}
          />
        ) : (
          <MissingBody
            loading={landscape.loading}
            missing={missingBrands}
            requirements={requirements}
            nationwideRequirements={nationwideRequirements}
            areaName={areaName}
            band={band}
            profilesFor={profilesFor}
            measuredFor={measuredFor}
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
  nationwideRequirements,
  catchment,
  categoryOptions,
  brandOptions,
  floorAreaProfiles,
  planningApplications,
  planningLoading,
  planningError,
  planningTruncated,
  planningTruncationReason,
  planningProgress,
}: {
  hidden: boolean
  onToggle: () => void
  findResults: GapResult[]
  findTotal: number
  findLoading: boolean
  findError: string | null
  landscape: Landscape
  presentBrands: PresentBrand[]
  missingBrands: MissingBrand[]
  requirements: RequirementLocation[]
  nationwideRequirements: NationwideRequirement[]
  catchment: CatchmentData
  categoryOptions: FilterOption[]
  brandOptions: FilterOption[]
  floorAreaProfiles: FloorAreaProfiles
  planningApplications: PlanningApplication[]
  planningLoading: boolean
  planningError: string | null
  planningTruncated: boolean
  planningTruncationReason: PlanningTruncationReason
  planningProgress: PlanningProgress | null
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
        nationwideRequirements={nationwideRequirements}
        catchmentData={catchment}
        categoryOptions={categoryOptions}
        brandOptions={brandOptions}
        floorAreaProfiles={floorAreaProfiles}
        planningApplications={planningApplications}
        planningLoading={planningLoading}
        planningError={planningError}
        planningTruncated={planningTruncated}
        planningTruncationReason={planningTruncationReason}
        planningProgress={planningProgress}
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
        nationwideRequirements={nationwideRequirements}
        catchmentData={catchment}
        categoryOptions={categoryOptions}
        brandOptions={brandOptions}
        floorAreaProfiles={floorAreaProfiles}
        planningApplications={planningApplications}
        planningLoading={planningLoading}
        planningError={planningError}
        planningTruncated={planningTruncated}
        planningTruncationReason={planningTruncationReason}
        planningProgress={planningProgress}
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

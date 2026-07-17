'use client'

import { useEffect, useState } from 'react'
import {
  MapPin,
  X,
  ChevronRight,
  Loader2,
  PanelRightClose,
  PanelRightOpen,
  GitCompareArrows,
} from 'lucide-react'
import { getClearbitLogoUrl } from '@/lib/clearbit-logo'
import { useWorkspaceStore } from '../../lib/stores/unified-workspace-store'
import type {
  BUAResult,
  InspectorTab,
  MissingFascia,
  MissingBrand,
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
  const pct = total > 0 ? Math.max(4, Math.round((results.length / total) * 100)) : 0

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
        <Kicker>Find Gaps · live</Kicker>
        <h2 className="mt-1.5 text-[20px] font-semibold tracking-[-0.3px] text-sm-ink">
          Locations matching filters
        </h2>
        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-[24px] font-semibold tracking-[-0.5px] text-sm-ink">
            {results.length.toLocaleString()}
          </span>
          <Kicker>of {total.toLocaleString()}</Kicker>
          <span className="h-[3px] flex-1 overflow-hidden rounded-full bg-sm-border-soft">
            <span
              className="block h-full bg-sm-violet transition-all"
              style={{ width: `${pct}%` }}
            />
          </span>
        </div>
        <div className="mt-3 flex items-center gap-1.5">
          {loading && <Loader2 size={11} className="animate-spin text-sm-ink3" />}
          <Kicker>{loading ? 'Updating…' : 'Sorted · population'}</Kicker>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {error && (
          <div className="px-[18px] py-6 text-center text-[12.5px] text-[#B23A2C]">
            {error}
          </div>
        )}
        {!error && results.length === 0 && !loading && (
          <div className="px-[18px] py-8 text-center text-[12.5px] text-sm-ink3">
            No built-up areas match these filters. Loosen a rule or widen the
            population range.
          </div>
        )}
        {results.map((b) => {
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
]

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
  onClose,
  onCollapse,
  onOpenReq,
  onOpenBrand,
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
  onClose: () => void
  onCollapse: () => void
  onOpenReq: (requirementId: string) => void
  onOpenBrand: (m: MissingFascia) => void
}) {
  const tab = useWorkspaceStore((s) => s.tab)
  const setTab = useWorkspaceStore((s) => s.setTab)
  const view = useWorkspaceStore((s) => s.view)
  const area = useWorkspaceStore((s) => s.area)
  const assessPoint = useWorkspaceStore((s) => s.assessPoint)
  const compareArm = useWorkspaceStore((s) => s.compareArm)
  const comparePair = useWorkspaceStore((s) => s.comparePair)
  const armPointCompare = useWorkspaceStore((s) => s.armPointCompare)
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

      {view === 'assess' && !area && !!assessPoint && !comparePair && (
        <div className="border-b border-sm-border-soft px-[18px] py-3">
          {compareArm ? (
            <div className="flex items-center gap-1.5 rounded-lg border border-sm-orange-tint bg-sm-orange-tint-soft px-3 py-2 text-[12.5px] font-medium text-sm-ink">
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-sm-orange text-[9px] font-bold text-white">
                B
              </span>
              Click the map to drop pin B…
            </div>
          ) : (
            <button
              type="button"
              onClick={armPointCompare}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-sm-violet py-2.5 text-[13px] font-semibold text-white hover:bg-sm-violet-deep"
            >
              <GitCompareArrows size={14} /> Compare with another location
            </button>
          )}
        </div>
      )}

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

      {tab !== 'catchment' && (
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
}) {
  const view = useWorkspaceStore((s) => s.view)
  const area = useWorkspaceStore((s) => s.area)
  const assessPoint = useWorkspaceStore((s) => s.assessPoint)
  const selectArea = useWorkspaceStore((s) => s.selectArea)
  const setAssessPoint = useWorkspaceStore((s) => s.setAssessPoint)
  const setReqModal = useWorkspaceStore((s) => s.setReqModal)
  const setBrandModal = useWorkspaceStore((s) => s.setBrandModal)

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
        onClose={() => selectArea(null)}
        onCollapse={onToggle}
        onOpenReq={setReqModal}
        onOpenBrand={setBrandModal}
      />
    )
  }

  // Assess mode with a dropped point: read the landscape around it.
  if (view === 'assess' && assessPoint) {
    return (
      <Opportunity
        title="Dropped point"
        areaName="this location"
        subtitle={`${assessPoint.lat.toFixed(4)}, ${assessPoint.lng.toFixed(4)}`}
        landscape={landscape}
        presentBrands={presentBrands}
        missingBrands={missingBrands}
        requirements={requirements}
        catchmentData={catchment}
        categoryOptions={categoryOptions}
        brandOptions={brandOptions}
        onClose={() => setAssessPoint(null)}
        onCollapse={onToggle}
        onOpenReq={setReqModal}
        onOpenBrand={setBrandModal}
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

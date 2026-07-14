'use client'

import { MapPin, X, ChevronRight, Loader2 } from 'lucide-react'
import { useWorkspaceStore } from '../../lib/stores/unified-workspace-store'
import type {
  BUAResult,
  InspectorTab,
  MissingFascia,
  RequirementLocation,
} from '../../types/unified-workspace'
import type { NearbyStore } from '../../lib/services/gaps-service'
import type { CatchmentData } from '../../lib/hooks/useCatchment'
import type { Landscape } from '../../lib/hooks/useAreaData'
import { CatchmentTab } from './CatchmentTab'

// Small circular initials avatar (no brand-logo asset pipeline in v1).
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
}: {
  results: BUAResult[]
  total: number
  loading: boolean
  error: string | null
}) {
  const selectArea = useWorkspaceStore((s) => s.selectArea)
  const pct = total > 0 ? Math.max(4, Math.round((results.length / total) * 100)) : 0

  return (
    <aside className="flex w-[404px] shrink-0 flex-col overflow-hidden border-l border-sm-border bg-sm-surface">
      <div className="border-b border-sm-border-soft px-[18px] py-[18px]">
        <Kicker>Find Gaps · live</Kicker>
        <h2 className="mt-1.5 text-[20px] font-semibold tracking-[-0.3px] text-sm-ink">
          Gap opportunities
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
                  {b.pop_band ? `${b.pop_band} · ` : ''}Pop{' '}
                  {(pop ?? 0).toLocaleString()}
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
  m: MissingFascia
  onOpen: (m: MissingFascia) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen(m)}
      className="grid grid-cols-[36px_1fr_auto] items-center gap-3 rounded-xl border border-sm-border bg-sm-surface p-3 text-left hover:bg-sm-bg"
    >
      <Avatar label={m.brandName || m.fasciaName} />
      <div className="min-w-0">
        <div className="truncate text-[14px] font-semibold text-sm-ink">
          {m.brandName}
        </div>
        <div className="mt-0.5 truncate font-mono text-[10px] uppercase tracking-wide text-sm-ink3">
          {m.categoryName ?? m.fasciaName}
          {m.nearestStoreDistance != null && (
            <>
              {' · nearest '}
              {(m.nearestStoreDistance / 1000).toFixed(1)} km
            </>
          )}
        </div>
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
  const sub = [req.listingType, req.title].filter(Boolean).join(' · ')
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
        <Avatar label={req.companyName} />
        <div className="min-w-0">
          <div className="truncate text-[14px] font-semibold text-sm-ink">
            {req.companyName}
          </div>
          {sub && (
            <div className="mt-0.5 truncate font-mono text-[10px] uppercase tracking-wide text-sm-ink3">
              {sub}
            </div>
          )}
        </div>
        <ChevronRight size={15} className="text-sm-violet-deep" />
      </div>
    </button>
  )
}

function TradingRow({ s }: { s: NearbyStore }) {
  const label = s.fascia_name || s.name
  return (
    <div className="grid grid-cols-[28px_1fr] items-center gap-3 border-b border-sm-border-soft px-[18px] py-2.5">
      <Avatar label={label} size={28} />
      <div className="min-w-0">
        <div className="truncate text-[13px] font-medium text-sm-ink2">{label}</div>
        <div className="mt-0.5 truncate font-mono text-[10px] uppercase tracking-wide text-sm-ink3">
          {[s.town, s.postcode].filter(Boolean).join(' · ') || 'Nearby'}
        </div>
      </div>
    </div>
  )
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-y border-sm-border-soft bg-sm-bg px-[18px] py-2.5">
      <Kicker>{children}</Kicker>
    </div>
  )
}

function SummaryBody({
  landscape,
  requirements,
  areaName,
  onOpenReq,
  onOpenBrand,
}: {
  landscape: Landscape
  requirements: RequirementLocation[]
  areaName: string
  onOpenReq: (requirementId: string) => void
  onOpenBrand: (m: MissingFascia) => void
}) {
  const { stores, missing, loading } = landscape
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
          <MissingRow key={m.fasciaId} m={m} onOpen={onOpenBrand} />
        ))}
      </div>

      <SectionHeader>Already trading here · {stores.length}</SectionHeader>
      <div>
        {!loading && stores.length === 0 && (
          <div className="px-[18px] py-3 text-[12.5px] text-sm-ink3">
            No stores found within this catchment.
          </div>
        )}
        {stores.slice(0, 40).map((s) => (
          <TradingRow key={s.id} s={s} />
        ))}
      </div>
    </>
  )
}

const OPP_TABS: { id: InspectorTab; label: string }[] = [
  { id: 'summary', label: 'Summary' },
  { id: 'catchment', label: 'Catchment' },
]

function Opportunity({
  title,
  areaName,
  subtitle,
  population,
  landscape,
  requirements,
  catchmentData,
  onClose,
  onOpenReq,
  onOpenBrand,
}: {
  title: string
  areaName: string
  subtitle: string
  population?: number
  landscape: Landscape
  requirements: RequirementLocation[]
  catchmentData: CatchmentData
  onClose: () => void
  onOpenReq: (requirementId: string) => void
  onOpenBrand: (m: MissingFascia) => void
}) {
  const tab = useWorkspaceStore((s) => s.tab)
  const setTab = useWorkspaceStore((s) => s.setTab)

  return (
    <aside className="flex w-[404px] shrink-0 flex-col overflow-hidden border-l border-sm-border bg-sm-surface">
      <div className="border-b border-sm-border-soft px-[18px] py-[18px]">
        <div className="flex items-start justify-between gap-2.5">
          <div className="min-w-0">
            <Kicker>{subtitle}</Kicker>
            <div className="mt-1 truncate text-[24px] font-semibold tracking-[-0.5px] text-sm-ink">
              {title}
            </div>
            {population != null && (
              <div className="mt-2 font-mono text-[10.5px] text-sm-ink3">
                Pop {population.toLocaleString()}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            title="Close"
            className="shrink-0 rounded-lg border border-sm-border bg-sm-surface p-1.5 text-sm-ink3 hover:text-sm-ink2"
          >
            <X size={13} />
          </button>
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

      <div className="min-h-0 flex-1 overflow-y-auto">
        {tab === 'catchment' ? (
          <CatchmentTab data={catchmentData} />
        ) : (
          <SummaryBody
            landscape={landscape}
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
  findResults,
  findTotal,
  findLoading,
  findError,
  landscape,
  requirements,
  catchment,
}: {
  findResults: BUAResult[]
  findTotal: number
  findLoading: boolean
  findError: string | null
  landscape: Landscape
  requirements: RequirementLocation[]
  catchment: CatchmentData
}) {
  const view = useWorkspaceStore((s) => s.view)
  const area = useWorkspaceStore((s) => s.area)
  const assessPoint = useWorkspaceStore((s) => s.assessPoint)
  const selectArea = useWorkspaceStore((s) => s.selectArea)
  const setAssessPoint = useWorkspaceStore((s) => s.setAssessPoint)
  const setReqModal = useWorkspaceStore((s) => s.setReqModal)
  const setBrandModal = useWorkspaceStore((s) => s.setBrandModal)

  // A selected BUA takes priority over everything.
  if (area) {
    return (
      <Opportunity
        title={area.name}
        areaName={area.name}
        subtitle={area.region ? `Opportunity · ${area.region}` : 'Opportunity'}
        population={area.population}
        landscape={landscape}
        requirements={requirements}
        catchmentData={catchment}
        onClose={() => selectArea(null)}
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
        requirements={requirements}
        catchmentData={catchment}
        onClose={() => setAssessPoint(null)}
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
      />
    )
  }

  return null
}

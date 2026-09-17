'use client'

import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, ChevronDown, Mail, BoxSelect } from 'lucide-react'
import { defaultCriteria } from '@/lib/planning-monitor/criteria'
import { weekRangeLabel } from '@/lib/planning-monitor/digest-groups'
import { selectActiveCriteria, selectPatch, usePlanningMonitorStore } from '../../../lib/stores/planning-monitor-store'
import {
  WORK_LABELS,
  areaLabel,
  filterChips,
  milesLabel,
  ringAreaSqMi,
  timeFrameLabel,
} from '../../../lib/planning-monitor-ui'
import { usePlanningMode } from './PlanningModeContext'
import { PlanningPatchMenu } from './PlanningPatchMenu'
import { Eyebrow, FilterChipView, GroupLabel, OutlineButton, PrimaryButton, Spinner, Toggle } from './PlanningUi'

const SEEN_KEY = (patchId: string) => `pm-summary-seen:${patchId}`

function readSeen(patchId: string): string | null {
  try {
    return window.localStorage.getItem(SEEN_KEY(patchId))
  } catch {
    return null
  }
}

export function markSummarySeen(patchId: string, runId: string) {
  try {
    window.localStorage.setItem(SEEN_KEY(patchId), runId)
  } catch {
    // Storage can be unavailable (private mode); the card then simply stays prominent.
  }
}

export function patchAreaSqMi(geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon): number {
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates
  return polygons.reduce((sum, rings) => {
    const [outer, ...holes] = rings as [number, number][][]
    return sum + ringAreaSqMi(outer) - holes.reduce((h, ring) => h + ringAreaSqMi(ring), 0)
  }, 0)
}

function ScopeToggle({ hasPatch }: { hasPatch: boolean }) {
  const scope = usePlanningMonitorStore((s) => s.scope)
  const setScope = usePlanningMonitorStore((s) => s.setScope)
  return (
    <div>
      <GroupLabel>Scope</GroupLabel>
      <div role="radiogroup" aria-label="Scope" className="mt-2 grid grid-cols-2 rounded-full bg-[#F5F4F2] p-1">
        {(['uk', 'patch'] as const).map((value) => {
          const active = scope === value
          const disabled = value === 'patch' && !hasPatch
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={disabled}
              onClick={() => setScope(value)}
              className={
                'rounded-full py-2 text-[13px] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-sm-violet ' +
                (active ? 'bg-white font-bold text-sm-ink shadow-[0_1px_3px_rgba(0,0,0,.1)]' : 'font-medium text-[#8A857D] hover:text-sm-ink disabled:cursor-not-allowed disabled:hover:text-[#8A857D]')
              }
            >
              {value === 'uk' ? 'Whole UK' : 'My patch'}
            </button>
          )
        })}
      </div>
      {!hasPatch && <p className="mt-2 text-[12px] text-[#A8A29A]">No patch yet — draw one to unlock.</p>}
    </div>
  )
}

/** The Whole UK filter summary rows: each opens All filters; the use rows also toggle in place. */
function UkFilterRows() {
  const criteria = usePlanningMonitorStore((s) => s.browseCriteria)
  const setBrowseCriteria = usePlanningMonitorStore((s) => s.setBrowseCriteria)
  const openFilters = usePlanningMonitorStore((s) => s.openFilters)
  const { refData } = usePlanningMode()
  const res = criteria.residential
  const com = criteria.commercial
  const brands = criteria.proximity?.brandIds.map((id) => refData.brands.find((b) => b.id === id)?.name).filter(Boolean) ?? []

  const setUse = (use: 'residential' | 'commercial', enabled: boolean) => {
    const next = structuredClone(criteria)
    next[use].enabled = enabled
    setBrowseCriteria(next)
  }

  const row = 'flex w-full items-center gap-2 rounded-[11px] px-3 py-[11px] text-left transition-colors'
  const label = 'block font-mono text-[9.5px] uppercase tracking-[0.1em]'
  return (
    <div className="space-y-2">
      <button type="button" onClick={() => openFilters('uk')} className={row + ' border border-[#EDEBE7] hover:bg-sm-bg'}>
        <span className="min-w-0 flex-1">
          <span className={label + ' text-[#8A857D]'}>Time frame</span>
          <span className="block truncate text-[13.5px] font-semibold text-sm-ink">{timeFrameLabel(criteria)}</span>
        </span>
        <ChevronDown size={14} className="text-[#8A857D]" />
      </button>
      <div
        role="button"
        tabIndex={0}
        onClick={() => openFilters('uk')}
        onKeyDown={(e) => e.key === 'Enter' && openFilters('uk')}
        className={row + ' cursor-pointer ' + (res.enabled ? 'border-[1.5px] border-sm-violet bg-[#F7F4FF]' : 'border border-[#EDEBE7] hover:bg-sm-bg')}
      >
        <span className="min-w-0 flex-1">
          <span className={label + (res.enabled ? ' text-sm-violet-deep' : ' text-[#8A857D]')}>Residential</span>
          <span className="block truncate text-[13.5px] font-semibold text-sm-ink">{res.minDwellings}+ dwellings</span>
        </span>
        <Toggle checked={res.enabled} disabled={res.enabled && !com.enabled} label="Residential" onChange={(v) => setUse('residential', v)} />
      </div>
      <div
        role="button"
        tabIndex={0}
        onClick={() => openFilters('uk')}
        onKeyDown={(e) => e.key === 'Enter' && openFilters('uk')}
        className={row + ' cursor-pointer ' + (com.enabled ? 'border-[1.5px] border-[#0F9B8E] bg-[#F0FAF8]' : 'border border-[#EDEBE7] hover:bg-sm-bg')}
      >
        <span className="min-w-0 flex-1">
          <span className={label + (com.enabled ? ' text-[#0B7D72]' : ' text-[#8A857D]')}>Commercial</span>
          <span className="block truncate text-[13.5px] font-semibold text-sm-ink">
            {com.work.length ? com.work.map((w) => WORK_LABELS[w]).join(', ') : 'All commercial'}
          </span>
        </span>
        <Toggle tone="teal" checked={com.enabled} disabled={com.enabled && !res.enabled} label="Commercial" onChange={(v) => setUse('commercial', v)} />
      </div>
      <button type="button" onClick={() => openFilters('uk')} className={row + ' border border-[#EDEBE7] hover:bg-sm-bg'}>
        <span className="min-w-0 flex-1">
          <span className={label + ' text-[#8A857D]'}>Near a brand</span>
          <span className="block truncate text-[13.5px] font-semibold text-sm-ink">
            {criteria.proximity ? `${brands.length > 2 ? `${brands[0]} +${brands.length - 1}` : brands.join(', ') || 'Chosen brands'} · within ${milesLabel(criteria.proximity.radiusMeters)}` : 'Any location'}
          </span>
        </span>
        <ChevronDown size={14} className="text-[#8A857D]" />
      </button>
      <OutlineButton className="w-full !border-[#E3DEFA] !text-[13px] !font-bold !text-sm-violet-deep" onClick={() => openFilters('uk')}>
        All filters
      </OutlineButton>
    </div>
  )
}

/** The dark "new summary ready" card, or a one-line link once the week has been opened. */
function SummaryPrompt() {
  const patch = usePlanningMonitorStore(selectPatch)
  const openSummary = usePlanningMonitorStore((s) => s.openSummary)
  const summaryOpen = usePlanningMonitorStore((s) => s.summaryOpen)
  const { digest } = usePlanningMode()
  const latest = digest.data?.latest ?? null
  const [seen, setSeen] = useState<string | null>(null)
  useEffect(() => {
    if (patch) setSeen(readSeen(patch.id))
  }, [patch, summaryOpen])

  if (!patch) return null
  if (digest.loading && !digest.data) {
    return <p className="flex items-center gap-2 text-[12.5px] text-[#8A857D]"><Spinner /> Loading your weekly summary…</p>
  }
  if (digest.error) {
    return (
      <p className="text-[12.5px] text-[#C0453F]">
        The weekly summary could not be loaded. <button type="button" className="font-semibold underline" onClick={digest.refresh}>Try again</button>
      </p>
    )
  }
  if (!latest) {
    return (
      <div className="rounded-[14px] bg-sm-ink p-[15px] text-white">
        <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-[#B49CFF]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#B49CFF]" /> Weekly summary
        </p>
        {digest.data?.preparing ? (
          <p className="mt-2 flex items-center gap-2 text-[13px] text-[#C9C3BA]"><Spinner className="text-[#B49CFF]" /> Preparing your first summary. The map is ready in the meantime.</p>
        ) : (
          <>
            <p className="mt-2 text-[12.5px] leading-[1.5] text-[#C9C3BA]">
              {digest.data?.lastFailed ? 'Your first summary could not be prepared.' : 'Your first summary arrives on Monday, covering the previous 7 days.'}
            </p>
            <button type="button" onClick={digest.requestPreview} className="mt-3 w-full rounded-sm-btn bg-white py-2.5 text-[13px] font-bold text-sm-ink hover:bg-[#F5F4F2]">
              Prepare a snapshot now
            </button>
          </>
        )}
      </div>
    )
  }

  const count = latest.counts?.newApplications ?? 0
  const range = weekRangeLabel(latest.periodStart, latest.periodEnd, false)
  const open = () => {
    markSummarySeen(patch.id, latest.runId)
    setSeen(latest.runId)
    openSummary(null)
  }
  if (seen === latest.runId) {
    return (
      <button type="button" onClick={open} className="flex w-full items-center gap-2 rounded-[11px] border border-[#EDEBE7] px-3 py-2.5 text-left text-[13px] hover:bg-sm-bg">
        <span className="h-1.5 w-1.5 rounded-full bg-[#C9C3BA]" />
        <span className="min-w-0 flex-1 truncate text-[#57534E]">
          {latest.kind === 'scheduled' ? `Week of ${range}` : 'Snapshot'} · <strong className="font-semibold text-sm-ink">{count} new</strong>
        </span>
        <span className="text-[12.5px] font-bold text-sm-violet-deep">Open</span>
      </button>
    )
  }
  return (
    <div className="rounded-[14px] bg-sm-ink p-[15px] text-white">
      <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-[#B49CFF]">
        <span className="h-1.5 w-1.5 rounded-full bg-[#B49CFF]" /> New summary ready
      </p>
      <p className="mt-2 text-[16px] font-bold leading-snug">
        {count === 0 ? 'Nothing new last week' : `${count} new application${count === 1 ? '' : 's'} ${latest.kind === 'scheduled' ? 'last week' : 'in the last 7 days'}`}
      </p>
      <p className="mt-1 text-[12.5px] leading-[1.5] text-[#C9C3BA]">
        {latest.kind === 'scheduled' ? `Week of ${range}, inside your patch.` : `A snapshot of ${range}, inside your patch.`}
        {latest.fromOlderRevision ? ' Written before your latest edits.' : ''}
      </p>
      <button type="button" onClick={open} className="mt-3 w-full rounded-sm-btn bg-white py-2.5 text-[13px] font-bold text-sm-ink hover:bg-[#F5F4F2]">
        Open weekly summary
      </button>
    </div>
  )
}

function RenameField() {
  const patch = usePlanningMonitorStore(selectPatch)
  const setRenaming = usePlanningMonitorStore((s) => s.setRenaming)
  const { savePatch } = usePlanningMode()
  const [value, setValue] = useState(patch?.name ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  if (!patch) return null
  const submit = async () => {
    const name = value.trim().slice(0, 80)
    if (!name || name === patch.name) return setRenaming(false)
    setBusy(true)
    setError(null)
    try {
      await savePatch({ name })
      setRenaming(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not rename the patch')
    } finally {
      setBusy(false)
    }
  }
  return (
    <form
      className="mt-1"
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
    >
      <input
        autoFocus
        value={value}
        maxLength={80}
        disabled={busy}
        aria-label="Patch name"
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === 'Escape' && setRenaming(false)}
        onBlur={submit}
        className="w-full rounded-[11px] border-2 border-sm-violet px-3 py-2 text-[17px] font-bold text-sm-ink shadow-[0_0_0_4px_rgba(112,51,255,.12)] outline-none"
      />
      {error && <p role="alert" className="mt-1 text-[12px] text-[#C0453F]">{error}</p>}
    </form>
  )
}

export function PlanningHomePanel() {
  const scope = usePlanningMonitorStore((s) => s.scope)
  const patch = usePlanningMonitorStore(selectPatch)
  const patchesLoaded = usePlanningMonitorStore((s) => s.patchesLoaded)
  const patchesError = usePlanningMonitorStore((s) => s.patchesError)
  const renaming = usePlanningMonitorStore((s) => s.renaming)
  const criteria = usePlanningMonitorStore(selectActiveCriteria)
  const drawing = usePlanningMonitorStore((s) => s.drawing)
  const startDraw = usePlanningMonitorStore((s) => s.startDraw)
  const openFilters = usePlanningMonitorStore((s) => s.openFilters)
  const { list, refData } = usePlanningMode()
  const inPatch = scope === 'patch' && patch
  const area = useMemo(() => (patch ? patchAreaSqMi(patch.displayGeometry) : 0), [patch])
  const chips = useMemo(() => filterChips(criteria, refData.brands), [criteria, refData.brands])
  const totals = list.totals

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6 pt-5">
        <div className="flex items-center justify-between">
          <Eyebrow>Planning monitor</Eyebrow>
          {inPatch && <PlanningPatchMenu host="panel" />}
        </div>

        {inPatch ? (
          <>
            {renaming ? (
              <RenameField />
            ) : (
              <h2 className="mt-2 flex items-center gap-2 text-[21px] font-bold leading-tight tracking-[-0.02em] text-sm-ink">
                <BoxSelect size={18} className="shrink-0 text-sm-violet" aria-hidden />
                <span className="truncate">{patch.name}</span>
              </h2>
            )}
            <p className="mt-1.5 font-mono text-[10.5px] uppercase tracking-[0.08em] text-[#8A857D]">
              Your patch · {areaLabel(area)}
              {totals ? ` · ${totals.developments.toLocaleString('en-GB')} matches` : list.loading ? ' · counting…' : ''}
            </p>
            {patch.needsAttention && (
              <p className="mt-2 flex items-start gap-1.5 rounded-[10px] bg-[#FDEEE3] px-2.5 py-2 text-[12px] text-[#7A3B12]">
                <AlertTriangle size={13} className="mt-px shrink-0" aria-hidden /> {patch.needsAttention}
              </p>
            )}
          </>
        ) : (
          <>
            <h2 className="mt-2 text-[22px] font-bold leading-tight tracking-[-0.02em] text-sm-ink">What’s coming near us?</h2>
            <p className="mt-2 text-[13.5px] leading-[1.5] text-[#57534E]">
              Every UK planning application, grouped into developments. Filter below, or draw a patch to watch week by week.
            </p>
          </>
        )}

        <div className="mt-5 border-t border-[#EDEBE7] pt-4">
          <ScopeToggle hasPatch={Boolean(patch)} />
        </div>

        {patchesError && <p role="alert" className="mt-3 text-[12.5px] text-[#C0453F]">{patchesError}</p>}

        {patchesLoaded && !patch && !drawing && (
          <div className="mt-4 rounded-[14px] border-[1.5px] border-dashed border-[#D9CFFA] bg-[#F7F4FF] p-[15px]">
            <p className="flex items-center gap-2 text-[14.5px] font-bold text-sm-ink">
              <BoxSelect size={17} className="text-sm-violet" aria-hidden /> Create your patch
            </p>
            <p className="mt-1.5 text-[12.5px] leading-[1.5] text-[#57534E]">
              Free-draw the area you cover. We’ll put together a weekly summary of what’s new inside it, and email it if you like.
            </p>
            <PrimaryButton className="mt-3 w-full !rounded-[10px]" onClick={() => startDraw(criteria)}>Draw my patch</PrimaryButton>
          </div>
        )}

        {inPatch && (
          <div className="mt-4">
            <SummaryPrompt />
          </div>
        )}

        {list.freshness?.stale && (
          <p className="mt-4 flex items-start gap-2 rounded-[11px] border border-[#F7DCC7] bg-[#FDEEE3] px-3 py-2 text-[12.5px] text-[#7A3B12]">
            <AlertTriangle size={14} className="mt-px shrink-0" aria-hidden />
            Planning data may be behind: recent applications or decisions could be missing.
          </p>
        )}

        <div className="mt-5 border-t border-[#EDEBE7] pt-4">
          {inPatch ? (
            <>
              <GroupLabel>Filters</GroupLabel>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {chips.map((chip) => <FilterChipView key={chip.key} chip={chip} />)}
              </div>
              <OutlineButton className="mt-3 w-full !text-[13px] !font-bold !text-sm-violet-deep" onClick={() => openFilters('patch')}>
                Edit patch filters
              </OutlineButton>
              <div className="mt-4 border-t border-[#EDEBE7] pt-4">
                <p className="flex items-center gap-2 text-[13px] text-[#57534E]">
                  <Mail size={15} className={patch.subscription?.emailEnabled ? 'text-[#0F9B8E]' : 'text-[#A8A29A]'} aria-hidden />
                  {patch.subscription?.emailEnabled ? (
                    <span>Weekly email <strong className="text-sm-ink">on</strong> · Mondays</span>
                  ) : (
                    <span>Weekly email <strong className="text-sm-ink">off</strong> · turn on from the ⋯ menu</span>
                  )}
                </p>
              </div>
            </>
          ) : (
            <>
              <GroupLabel
                action={
                  <button
                    type="button"
                    className="text-[12.5px] font-semibold text-sm-violet hover:text-sm-violet-deep"
                    onClick={() => usePlanningMonitorStore.getState().setBrowseCriteria(patch ? structuredClone(patch.criteria) : defaultCriteria())}
                  >
                    Reset
                  </button>
                }
              >
                Filters
              </GroupLabel>
              <div className="mt-2">
                <UkFilterRows />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

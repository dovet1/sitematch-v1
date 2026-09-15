'use client'

import { useMemo } from 'react'
import { Diamond, Loader2, MapPinned, Pencil, Plus, Settings2, AlertTriangle } from 'lucide-react'
import type { MonitorRow } from '@/lib/planning-monitor/types'
import type { RefBrand } from '../../../types/unified-workspace'
import { selectActiveCriteria, usePlanningMonitorStore } from '../../../lib/stores/planning-monitor-store'
import type { PlanningListState, PlanningMapState } from '../../../lib/hooks/usePlanningMonitor'
import { countsLabel, criteriaChips, locationNote, markerKind, rowMeta, rowTitle, type ChipTone } from '../../../lib/planning-monitor-ui'
import { PlanningSummaryCard } from './PlanningSummaryCard'
import type { PatchDigestResponse } from '../../../lib/services/planning-monitor-service'
import { PLANNING_COLORS } from '../../map/PlanningMapLayer'

const CHIP_CLASSES: Record<ChipTone, string> = {
  patch: 'bg-[#F1EEFA] text-[#4B23C9]',
  estate: 'bg-[#EAF8F1] text-[#177E4E]',
  plain: 'bg-[#F4F3F8] text-[#3D3C47]',
}

function Dot({ row }: { row: MonitorRow }) {
  const kind = markerKind(row)
  const color = PLANNING_COLORS[kind]
  const exact = row.locationProvenance === 'source_exact'
  return (
    <span
      aria-hidden
      className="mt-[5px] h-2.5 w-2.5 shrink-0 rounded-full"
      style={exact ? { background: color } : { border: `2.5px solid ${color}`, background: 'transparent' }}
    />
  )
}

export function PlanningMonitorPanel({
  brands,
  list,
  mapState,
  digest,
  onSelectRow,
}: {
  brands: RefBrand[]
  list: PlanningListState
  mapState: PlanningMapState
  digest: { data: PatchDigestResponse | null; loading: boolean; error: string | null; refresh: () => void; requestPreview: () => void }
  onSelectRow: (row: MonitorRow) => void
}) {
  const scope = usePlanningMonitorStore((s) => s.scope)
  const setScope = usePlanningMonitorStore((s) => s.setScope)
  const patches = usePlanningMonitorStore((s) => s.patches)
  const patchesLoaded = usePlanningMonitorStore((s) => s.patchesLoaded)
  const patchesError = usePlanningMonitorStore((s) => s.patchesError)
  const activePatchId = usePlanningMonitorStore((s) => s.activePatchId)
  const setActivePatch = usePlanningMonitorStore((s) => s.setActivePatch)
  const grouping = usePlanningMonitorStore((s) => s.grouping)
  const setGrouping = usePlanningMonitorStore((s) => s.setGrouping)
  const selectedKey = usePlanningMonitorStore((s) => s.selected?.key ?? null)
  const hoveredKey = usePlanningMonitorStore((s) => s.hoveredKey)
  const setHoveredKey = usePlanningMonitorStore((s) => s.setHoveredKey)
  const openEditor = usePlanningMonitorStore((s) => s.openEditor)
  const openReport = usePlanningMonitorStore((s) => s.openReport)
  const setNotificationsOpen = usePlanningMonitorStore((s) => s.setNotificationsOpen)
  const criteria = usePlanningMonitorStore(selectActiveCriteria)

  const patch = patches.find((p) => p.id === activePatchId) ?? null
  const chips = useMemo(
    () => criteriaChips({
      criteria,
      patchLabel: scope === 'patch' && patch ? patch.geometryLabel ?? `${patch.name} (${patch.geometrySource})` : null,
      brands,
    }),
    [criteria, scope, patch, brands]
  )

  const totals = list.totals
  return (
    <div className="flex h-full min-h-0 flex-col px-5 pt-5 lg:px-[26px] lg:pt-6">
      <div className="flex items-center justify-between">
        <h2 className="text-[12px] font-bold uppercase tracking-[0.14em] text-[#6C47FF]">Planning monitor</h2>
        {patch && (
          <button
            type="button"
            onClick={() => setNotificationsOpen(true)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-sm-ink3 hover:bg-sm-bg hover:text-sm-ink"
            aria-label="Notification settings"
            title="Notification settings"
          >
            <Settings2 size={16} />
          </button>
        )}
      </div>

      {/* Scope: My patch changes to All UK by removing only the patch boundary. */}
      <div role="radiogroup" aria-label="Scope" className="mt-3 grid grid-cols-2 rounded-[11px] bg-[#F2F0F9] p-1">
        {(['patch', 'uk'] as const).map((value) => {
          const active = scope === value
          const disabled = value === 'patch' && !patch
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={disabled}
              onClick={() => setScope(value)}
              title={disabled ? 'Create a patch first' : undefined}
              className={
                'rounded-lg py-2 text-[14px] font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#6C47FF] ' +
                (active ? 'bg-white text-sm-ink shadow-[0_2px_6px_rgba(0,0,0,.06)]' : 'text-sm-ink3 hover:text-sm-ink2 disabled:cursor-not-allowed disabled:opacity-50')
              }
            >
              {value === 'patch' ? 'My patch' : 'All UK'}
            </button>
          )
        })}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pb-6">
        <div className="mt-4 flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="truncate text-[26px] font-bold leading-tight tracking-[-0.4px] text-sm-ink">
              {scope === 'patch' && patch ? patch.name : 'All UK'}
            </h3>
            {patches.length > 1 && (
              <label className="mt-1 flex items-center gap-2 text-[12.5px] text-sm-ink3">
                <span className="sr-only">Active patch</span>
                <select
                  value={activePatchId ?? ''}
                  onChange={(e) => setActivePatch(e.target.value || null)}
                  className="max-w-full rounded-md border border-sm-border bg-white px-2 py-1 text-[12.5px] text-sm-ink2"
                >
                  {patches.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </label>
            )}
          </div>
          {patchesLoaded && (
            <button
              type="button"
              onClick={() => openEditor('new')}
              className={
                'inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-[13px] font-semibold ' +
                (patch ? 'border border-sm-border text-sm-ink2 hover:bg-sm-bg' : 'bg-[#6C47FF] text-white hover:bg-[#4B23C9]')
              }
            >
              <Plus size={14} aria-hidden /> {patch ? 'New patch' : 'Create your patch'}
            </button>
          )}
        </div>

        {patchesError && <p className="mt-2 text-[13px] text-[#B23A2C]">{patchesError}</p>}

        {/* Totals: whole patch (or UK) first, then what is in the map view. */}
        <p className="mt-2 text-[14.5px] leading-snug text-sm-ink2" aria-live="polite">
          {list.loading && !totals ? (
            <span className="inline-flex items-center gap-1.5 text-sm-ink3"><Loader2 size={13} className="animate-spin" aria-hidden /> Counting…</span>
          ) : totals ? (
            <>
              <strong className="font-semibold text-sm-ink">{countsLabel(totals)}</strong>
              {' '}{scope === 'patch' ? 'in your patch' : 'across the UK'}
              {totals.possibleApplications > 0 && scope === 'patch' && (
                <span className="text-sm-ink3"> · {totals.possibleApplications.toLocaleString('en-GB')} may be in this area</span>
              )}
            </>
          ) : list.totalsUnavailable ? (
            <span className="text-sm-ink3">Too many to count at once — zoom in or narrow the dates.</span>
          ) : null}
        </p>
        {mapState.viewportApplications != null && (
          <p className="mt-0.5 text-[12.5px] text-sm-ink3">
            In this map view: {mapState.viewportDevelopments?.toLocaleString('en-GB')} developments · {mapState.viewportApplications.toLocaleString('en-GB')} applications
            {mapState.loading && <Loader2 size={11} className="ml-1 inline animate-spin" aria-hidden />}
          </p>
        )}

        {list.freshness?.stale && (
          <p className="mt-3 flex items-start gap-2 rounded-xl border border-[#F5D48B] bg-[#FEF8E7] px-3 py-2 text-[12.5px] text-[#7A5600]">
            <AlertTriangle size={14} className="mt-px shrink-0" aria-hidden />
            Planning data may be behind: recent applications or decisions could be missing.
          </p>
        )}

        {!patch && patchesLoaded && (
          <div className="mt-4 rounded-2xl border border-dashed border-[#D9CFFB] bg-[#FAF8FF] px-5 py-4 text-[13.5px] leading-relaxed text-sm-ink2">
            <MapPinned size={18} className="mb-1 text-[#6C47FF]" aria-hidden />
            Draw, upload or search for the area you care about to get a weekly, source-linked briefing of its planning changes.
          </div>
        )}

        {scope === 'patch' && patch && (
          <div className="mt-4">
            <PlanningSummaryCard
              data={digest.data}
              loading={digest.loading}
              error={digest.error}
              onOpenReport={(runId) => openReport(runId)}
              onRetry={() => (digest.data && !digest.data.latest && !digest.data.preparing ? digest.requestPreview() : digest.refresh())}
            />
          </div>
        )}

        <div className="mt-5 flex items-center justify-between">
          <span className="text-[12px] font-bold uppercase tracking-[0.12em] text-sm-ink3">Your criteria</span>
          <button
            type="button"
            onClick={() => openEditor(patch ? patch.id : 'new')}
            className="inline-flex items-center gap-1 text-[13.5px] font-semibold text-[#6C47FF] hover:text-[#4B23C9]"
          >
            <Pencil size={13} aria-hidden /> {patch ? 'Edit criteria' : 'Set criteria'}
          </button>
        </div>
        <ul className="mt-2 flex flex-wrap gap-2">
          {chips.map((chip) => (
            <li key={chip.key} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] font-semibold ${CHIP_CLASSES[chip.tone]}`}>
              {chip.tone === 'estate' && <Diamond size={11} aria-hidden />}
              {chip.label}
            </li>
          ))}
        </ul>

        <div className="mt-6 flex items-center justify-between gap-2">
          <span className="text-[12px] font-bold uppercase tracking-[0.12em] text-sm-ink3">Relevant applications</span>
          <div role="radiogroup" aria-label="Group by" className="flex rounded-lg bg-[#F2F0F9] p-0.5 text-[12px] font-semibold">
            {(['developments', 'applications'] as const).map((value) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={grouping === value}
                onClick={() => setGrouping(value)}
                className={'rounded-md px-2.5 py-1 ' + (grouping === value ? 'bg-white text-sm-ink shadow-sm' : 'text-sm-ink3')}
              >
                {value === 'developments' ? 'Developments' : 'Applications'}
              </button>
            ))}
          </div>
        </div>

        {list.error && (
          <p role="alert" className="mt-3 rounded-xl bg-[#FDECEA] px-3 py-2 text-[13px] text-[#8A2A1F]">{list.error}</p>
        )}
        {list.loading && list.rows.length === 0 && (
          <div className="mt-3 space-y-2" aria-hidden>
            {[0, 1, 2].map((i) => <div key={i} className="h-[58px] animate-pulse rounded-xl bg-[#F4F3F8]" />)}
          </div>
        )}
        {!list.loading && !list.error && list.rows.length === 0 && patchesLoaded && (
          <p className="mt-3 text-[13.5px] leading-relaxed text-sm-ink3">
            No applications match these criteria{scope === 'patch' ? ' in your patch' : ''}. Try a longer date range or fewer filters.
          </p>
        )}

        <ul className="mt-2" aria-label="Applications">
          {list.rows.map((row) => {
            const selected = selectedKey === row.key
            const hovered = hoveredKey === row.key
            const note = locationNote(row)
            return (
              <li key={row.key}>
                <button
                  type="button"
                  aria-pressed={selected}
                  onClick={() => onSelectRow(row)}
                  onMouseEnter={() => setHoveredKey(row.key)}
                  onMouseLeave={() => setHoveredKey(null)}
                  onFocus={() => setHoveredKey(row.key)}
                  onBlur={() => setHoveredKey(null)}
                  className={
                    'flex w-full gap-3 rounded-xl border px-3.5 py-3 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#6C47FF] ' +
                    (selected ? 'border-[#ECE6FB] bg-[#F6F3FF]' : hovered ? 'border-transparent bg-[#FAF9FD]' : 'border-transparent')
                  }
                >
                  <Dot row={row} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14px] font-semibold leading-snug text-sm-ink">{rowTitle(row)}</span>
                    <span className="mt-0.5 block text-[12.5px] leading-snug text-[#8A8895]">{rowMeta(row)}</span>
                    {note && <span className="mt-0.5 block text-[11.5px] text-[#8A8895]">{note}</span>}
                    {row.watched && <span className="mt-1 inline-block rounded-full bg-[#F1EEFA] px-2 py-0.5 text-[10.5px] font-semibold text-[#4B23C9]">Watching</span>}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
        {list.nextCursor && (
          <button
            type="button"
            onClick={list.loadMore}
            disabled={list.loadingMore}
            className="mt-2 w-full rounded-xl border border-sm-border py-2 text-[13px] font-semibold text-sm-ink2 hover:bg-sm-bg disabled:opacity-60"
          >
            {list.loadingMore ? 'Loading…' : 'Show more'}
          </button>
        )}
      </div>
    </div>
  )
}

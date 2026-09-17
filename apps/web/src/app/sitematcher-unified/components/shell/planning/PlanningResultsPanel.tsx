'use client'

import { useEffect, useMemo, useRef } from 'react'
import { ChevronDown, ChevronRight, ChevronUp, Download, MapPin } from 'lucide-react'
import type { MonitorRow } from '@/lib/planning-monitor/types'
import { selectPatch, usePlanningMonitorStore } from '../../../lib/stores/planning-monitor-store'
import {
  KIND_LABELS,
  USE_COLORS,
  documentCount,
  downloadCsv,
  isNewRow,
  locationNote,
  londonTodayIso,
  markerKind,
  rowMeta,
  rowTitle,
  rowsToCsv,
} from '../../../lib/planning-monitor-ui'
import { usePlanningMode } from './PlanningModeContext'
import { DocumentRows, useDevelopmentDocuments } from './PlanningDevelopmentCard'
import { Eyebrow, Spinner } from './PlanningUi'

export function NewBadge({ kind }: { kind: 'residential' | 'commercial' | 'mixed' }) {
  return (
    <span className="rounded-[5px] px-1.5 py-[1px] font-mono text-[9px] font-semibold uppercase tracking-[0.06em] text-white" style={{ background: USE_COLORS[kind].solid }}>
      New
    </span>
  )
}

function ResultRow({ row, isNew }: { row: MonitorRow; isNew: boolean }) {
  const { selectRow } = usePlanningMode()
  const selected = usePlanningMonitorStore((s) => s.selected?.key === row.key)
  const hovered = usePlanningMonitorStore((s) => s.hoveredKey === row.key)
  const hoverSource = usePlanningMonitorStore((s) => s.hoverSource)
  const expanded = usePlanningMonitorStore((s) => s.expandedKeys.includes(row.key)) || selected
  const setHovered = usePlanningMonitorStore((s) => s.setHovered)
  const toggleExpanded = usePlanningMonitorStore((s) => s.toggleExpanded)
  const ref = useRef<HTMLLIElement | null>(null)
  const { documents, loading, total } = useDevelopmentDocuments(row, expanded)
  const kind = markerKind(row)
  const colors = USE_COLORS[kind]
  const docs = documentCount(row, total)
  const note = locationNote(row)

  // A pin hovered on the map brings its row into view.
  useEffect(() => {
    if ((hovered && hoverSource === 'map') || selected) ref.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [hovered, hoverSource, selected])

  const active = selected || hovered
  return (
    <li
      ref={ref}
      id={`pm-row-${row.key}`}
      className={'border-b border-[#F3F1ED] transition-colors ' + (active ? 'bg-[#F7F4FF] shadow-[inset_3px_0_0_#7033FF]' : isNew ? 'bg-[#FCFBFF]' : '')}
      onMouseEnter={() => setHovered(row.key, 'list')}
      onMouseLeave={() => setHovered(null, 'list')}
    >
      <div
        role="button"
        tabIndex={0}
        aria-pressed={selected}
        onClick={() => selectRow(selected ? null : row, { fly: true })}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            selectRow(selected ? null : row, { fly: true })
          }
        }}
        onFocus={() => setHovered(row.key, 'list')}
        className="flex cursor-pointer gap-3 px-5 py-3.5 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-sm-violet"
      >
        <MapPin size={17} className="mt-0.5 shrink-0" style={{ color: colors.solid }} aria-hidden strokeWidth={2.2} />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5">
            <span className="truncate text-[14.5px] font-semibold text-sm-ink">{rowTitle(row)}</span>
            {isNew && <NewBadge kind={kind} />}
          </p>
          <p className="mt-0.5 truncate font-mono text-[10.5px] uppercase tracking-[0.04em] text-[#8A857D]">{rowMeta(row)}</p>
          {row.description?.trim() && (
            <p className="mt-1 line-clamp-2 text-[12px] leading-snug text-[#57534E]" title={row.description.trim()}>{row.description.trim()}</p>
          )}
          {note && <p className="mt-0.5 text-[11.5px] text-[#B4531A]">{note}</p>}
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="rounded-[6px] px-2 py-0.5 text-[11.5px] font-semibold" style={{ background: colors.tint, color: colors.text }}>{KIND_LABELS[kind]}</span>
            <button
              type="button"
              aria-expanded={expanded}
              onClick={(e) => {
                e.stopPropagation()
                if (selected) selectRow(null)
                else toggleExpanded(row.key)
              }}
              className={
                'inline-flex items-center gap-1 rounded-[6px] px-2 py-0.5 text-[11.5px] font-semibold ' +
                (expanded ? 'bg-sm-ink text-white' : 'bg-[#F5F4F2] text-[#57534E] hover:bg-[#EDEBE7]')
              }
            >
              {docs} document{docs === 1 ? '' : 's'} {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
            {row.watched && <span className="rounded-[6px] bg-sm-violet-tint px-2 py-0.5 text-[11px] font-semibold text-sm-violet-deep">Watching</span>}
          </div>
        </div>
        <ChevronRight size={15} className="mt-1 shrink-0 text-[#C9C3BA]" aria-hidden />
      </div>
      {expanded && (
        <div className="-mt-1 px-5 pb-3.5 pl-[49px]">
          <div className="rounded-[10px] border border-[#E3DEFA] bg-white px-1.5 py-1">
            {loading && <p className="flex items-center gap-2 px-2 py-1.5 text-[12px] text-[#8A857D]"><Spinner /> Loading documents…</p>}
            <DocumentRows documents={documents} compact />
          </div>
        </div>
      )}
    </li>
  )
}

/** The right-hand results panel: developments in view (Whole UK) or in the patch, newest first. */
export function PlanningResultsPanel() {
  const { list } = usePlanningMode()
  const scope = usePlanningMonitorStore((s) => s.scope)
  const patch = usePlanningMonitorStore(selectPatch)
  const patchesLoaded = usePlanningMonitorStore((s) => s.patchesLoaded)
  const inPatch = scope === 'patch' && patch
  const today = londonTodayIso()
  const newKeys = useMemo(() => new Set(list.rows.filter((r) => isNewRow(r, today)).map((r) => r.key)), [list.rows, today])
  const totals = list.totals
  const developments = inPatch ? totals?.developments : totals?.viewportDevelopments ?? totals?.developments
  const applications = inPatch ? totals?.applications : totals?.viewportApplications ?? totals?.applications

  return (
    <aside aria-label="Planning results" className="hidden w-[340px] shrink-0 flex-col border-l border-[#EDEBE7] bg-white lg:flex">
      <div className="border-b border-[#EDEBE7] px-5 pb-3.5 pt-5">
        <Eyebrow>{inPatch ? `In ${patch.name}` : 'In this view'}</Eyebrow>
        <div className="mt-2 flex items-baseline gap-2" aria-live="polite">
          {developments != null ? (
            <>
              <span className="text-[30px] font-bold leading-none tracking-[-0.02em] text-sm-ink">{developments.toLocaleString('en-GB')}</span>
              <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-[#57534E]">Development{developments === 1 ? '' : 's'}</span>
              {list.loading && <Spinner className="text-[#8A857D]" />}
            </>
          ) : list.loading || !patchesLoaded ? (
            <span className="flex h-[30px] items-center gap-2 text-[13px] text-[#8A857D]"><Spinner /> Counting…</span>
          ) : list.totalsUnavailable ? (
            <span className="text-[13px] text-[#8A857D]">Too many to count — zoom in or narrow the dates.</span>
          ) : (
            <span className="text-[13px] text-[#8A857D]">Counts unavailable.</span>
          )}
        </div>
        {applications != null && (
          <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.06em] text-[#8A857D]">{applications.toLocaleString('en-GB')} document{applications === 1 ? '' : 's'}</p>
        )}
        <div className="mt-3 flex items-center gap-2">
          {inPatch ? (
            <>
              {newKeys.size > 0 && (
                <span className="rounded-[6px] bg-sm-violet-tint px-2 py-1 text-[12px] font-semibold text-sm-violet-deep">{newKeys.size} new this week</span>
              )}
              <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-[#8A857D]">Sorted newest</span>
            </>
          ) : (
            <>
              <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-[#8A857D]">Sort</span>
              <span className="rounded-full bg-sm-ink px-2.5 py-1 font-mono text-[10.5px] uppercase tracking-[0.04em] text-white">Newest ↓</span>
            </>
          )}
          <button
            type="button"
            disabled={list.rows.length === 0}
            onClick={() => downloadCsv(`planning-${inPatch ? patch.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') : 'view'}.csv`, rowsToCsv(list.rows))}
            title={list.nextCursor ? `Exports the ${list.rows.length} rows loaded so far` : undefined}
            className="ml-auto inline-flex items-center gap-1 rounded-full bg-sm-ink px-2.5 py-1 font-mono text-[10.5px] uppercase tracking-[0.04em] text-white hover:bg-black disabled:opacity-40"
          >
            <Download size={11} /> CSV
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {list.error && <p role="alert" className="m-4 rounded-[11px] bg-[#FDECEB] px-3 py-2 text-[13px] text-[#C0453F]">{list.error}</p>}
        {list.loading && list.rows.length === 0 && (
          <div className="space-y-px" aria-hidden>
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="border-b border-[#F3F1ED] px-5 py-4">
                <div className="h-3.5 w-3/4 animate-pulse rounded bg-[#F5F4F2]" />
                <div className="mt-2 h-2.5 w-1/2 animate-pulse rounded bg-[#F5F4F2]" />
                <div className="mt-3 h-4 w-1/3 animate-pulse rounded bg-[#F5F4F2]" />
              </div>
            ))}
          </div>
        )}
        {!list.loading && !list.error && list.rows.length === 0 && patchesLoaded && (
          <p className="px-5 py-6 text-[13.5px] leading-[1.5] text-[#8A857D]">
            {inPatch ? 'Nothing in your patch matches these filters.' : 'Nothing in this view matches. Pan the map, zoom out, or widen the time frame.'}
          </p>
        )}
        <ul aria-label="Developments">
          {list.rows.map((row) => <ResultRow key={row.key} row={row} isNew={inPatch ? newKeys.has(row.key) : false} />)}
        </ul>
        {list.nextCursor && (
          <div className="p-4">
            <button
              type="button"
              onClick={list.loadMore}
              disabled={list.loadingMore}
              className="w-full rounded-sm-btn border border-[#EDEBE7] py-2 text-[13px] font-semibold text-[#57534E] hover:bg-sm-bg disabled:opacity-60"
            >
              {list.loadingMore ? 'Loading…' : 'Show more'}
            </button>
          </div>
        )}
      </div>
    </aside>
  )
}

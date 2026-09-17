'use client'

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type mapboxgl from 'mapbox-gl'
import { ArrowLeft, ArrowUpRight, Eye, X } from 'lucide-react'
import type { MonitorRow } from '@/lib/planning-monitor/types'
import type { PlanningApplication } from '../../../types/unified-workspace'
import { useDevelopmentHistory } from '../../../lib/hooks/useDevelopmentHistory'
import { selectActiveCriteria, usePlanningMonitorStore } from '../../../lib/stores/planning-monitor-store'
import {
  KIND_LABELS,
  USE_COLORS,
  formatDayMonth,
  formatShortDate,
  locationNote,
  markerKind,
  milesLabel,
  placePopover,
  stackItemKey,
  stageLabel,
} from '../../../lib/planning-monitor-ui'
import { mapAlive } from '../../map/PlanningMapLayer'
import { usePlanningMode } from './PlanningModeContext'
import { Spinner } from './PlanningUi'

const ROUTE_LABELS: Record<string, string> = {
  full: 'Full planning permission',
  outline: 'Outline permission',
  'reserved-matters': 'Reserved matters',
  'prior-approval': 'Prior approval',
  discharge: 'Discharge of conditions',
  amendment: 'Amendment',
  'lawful-dev-cert': 'Lawful development certificate',
  'listed-building': 'Listed building consent',
  'advert-consent': 'Advertisement consent',
  'eia-opinion': 'EIA opinion',
  'pre-application': 'Pre-application',
}

export interface DevelopmentDocument {
  key: string
  title: string
  description: string
  reference: string
  stage: string
  date: string | null
  url: string | null
  lead: boolean
}

function docTitle(app: PlanningApplication): string {
  const route = ROUTE_LABELS[app.appType] ?? (app.appType ? app.appType.replace(/-/g, ' ').replace(/^\w/, (c) => c.toUpperCase()) : '')
  return route || app.description.split(/[.;]/)[0].slice(0, 70) || app.name
}

function safeUrl(url: string | null | undefined): string | null {
  if (!url) return null
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.toString() : null
  } catch {
    return null
  }
}

/**
 * The paperwork behind a row: the development's full history once loaded, else the row itself.
 * The row's own application leads. Shared by the detail card and the expanded sidebar row, so the
 * two always list the same documents.
 */
export function useDevelopmentDocuments(row: MonitorRow, enabled: boolean): { documents: DevelopmentDocument[]; loading: boolean; total: number | null } {
  const history = useDevelopmentHistory(row.developmentId, enabled && Boolean(row.developmentId))
  return useMemo(() => {
    const leadRef = `${row.authorityName}/${row.reference}`
    const fromRow: DevelopmentDocument = {
      key: row.applicationId,
      title: docTitle({ appType: row.planningRoute ?? row.procedure ?? '', description: row.description, name: leadRef } as PlanningApplication),
      description: row.description?.trim() ?? '',
      reference: row.reference,
      stage: row.stage ?? '',
      date: row.dateDecided ?? row.dateValidated ?? row.dateReceived,
      url: safeUrl(row.sourceUrl),
      lead: true,
    }
    if (!history) return { documents: [fromRow], loading: Boolean(row.developmentId) && enabled, total: row.developmentId ? null : 1 }
    const documents = history
      .map((app): DevelopmentDocument => ({
        key: app.uid || app.name,
        title: docTitle(app),
        description: app.description?.trim() ?? '',
        reference: app.name.split('/').slice(1).join('/') || app.name,
        stage: app.appState,
        date: app.decidedDate ?? app.dateValidated ?? app.dateReceived ?? null,
        url: safeUrl(app.url),
        lead: app.name === leadRef,
      }))
      .sort((a, b) => Number(b.lead) - Number(a.lead) || (b.date ?? '').localeCompare(a.date ?? ''))
    return { documents: documents.length ? documents : [fromRow], loading: false, total: documents.length || 1 }
  }, [history, row, enabled])
}

export function DocumentRows({ documents, compact = false }: { documents: DevelopmentDocument[]; compact?: boolean }) {
  return (
    <ul>
      {documents.map((doc) => {
        const inner = (
          <>
            <span className={'mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full ' + (doc.lead ? 'bg-sm-violet' : 'bg-[#C9C3BA]')} aria-hidden />
            <span className="min-w-0 flex-1">
              <span className={'block truncate font-semibold text-sm-ink ' + (compact ? 'text-[12.5px]' : 'text-[13px]')}>{doc.title}</span>
              {/* The lead's description already shows on the card and the row above. */}
              {!doc.lead && doc.description && doc.description !== doc.title && (
                <span className={'mt-0.5 block text-[11.5px] leading-snug text-[#57534E] ' + (compact ? 'line-clamp-1' : 'line-clamp-2')} title={doc.description}>
                  {doc.description}
                </span>
              )}
              <span className="block truncate font-mono text-[10px] uppercase tracking-[0.04em] text-[#8A857D]">
                {doc.reference}{doc.stage ? ` · ${doc.stage}` : ''}{doc.date ? ` ${formatDayMonth(doc.date)}` : ''}
              </span>
            </span>
            {doc.url && <ArrowUpRight size={14} className="mt-0.5 shrink-0 text-sm-violet" aria-hidden />}
          </>
        )
        const cls = 'flex gap-2.5 rounded-[9px] ' + (compact ? 'px-2 py-2' : 'px-2.5 py-2.5') + (doc.lead && !compact ? ' bg-[#F7F4FF]' : '')
        return (
          <li key={doc.key} className={compact ? 'border-b border-[#F3F1ED] last:border-0' : ''}>
            {doc.url ? (
              <a href={doc.url} target="_blank" rel="noopener noreferrer" className={cls + ' hover:bg-[#F7F4FF]'} title="Open on the council’s portal" onClick={(e) => e.stopPropagation()}>
                {inner}
              </a>
            ) : (
              <div className={cls}>{inner}</div>
            )}
          </li>
        )
      })}
    </ul>
  )
}

const STATUS_PILL: Record<string, string> = {
  approved: 'bg-[#E4F5F2] text-[#0B7D72]',
  refused: 'bg-[#FDECEB] text-[#C0453F]',
  withdrawn: 'bg-[#F5F4F2] text-[#57534E]',
  pending: 'bg-[#FDEEE3] text-[#B4531A]',
}

/** The application's description: clamped, with a toggle when it runs long. */
function Description({ text }: { text: string }) {
  const [open, setOpen] = useState(false)
  const long = text.length > 220
  return (
    <div className="mt-3.5">
      <p className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-[#8A857D]">Description</p>
      <p className={'mt-1 whitespace-pre-line text-[13px] leading-[1.5] text-[#3F3B36] ' + (long ? (open ? 'max-h-[36vh] overflow-y-auto pr-1' : 'line-clamp-4') : '')}>{text}</p>
      {long && (
        <button type="button" onClick={() => setOpen((v) => !v)} className="mt-1 text-[12px] font-semibold text-sm-violet hover:text-sm-violet-deep">
          {open ? 'Show less' : 'Show more'}
        </button>
      )}
    </div>
  )
}

function Fact({ label, children, mono }: { label: string; children: React.ReactNode; mono?: boolean }) {
  return (
    <div>
      <dt className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-[#8A857D]">{label}</dt>
      <dd className={mono ? 'mt-0.5 font-mono text-[13px] font-semibold text-sm-ink' : 'mt-0.5 text-[13.5px] font-semibold text-sm-ink'}>{children}</dd>
    </div>
  )
}

/** Keeps a popover beside a map point, on screen, as the map moves and the popover resizes. */
export function usePinAnchor(map: mapboxgl.Map, lngLat: [number, number], ref: React.RefObject<HTMLElement | null>) {
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null)
  const [lng, lat] = lngLat
  useLayoutEffect(() => {
    const place = () => {
      const el = ref.current
      if (!el || !mapAlive(map)) return
      const container = map.getContainer()
      const next = placePopover({
        anchor: map.project([lng, lat]),
        size: { width: el.offsetWidth, height: el.offsetHeight },
        viewport: { width: container.clientWidth, height: container.clientHeight },
      })
      setPosition({ left: next.left, top: next.top })
    }
    place()
    const observer = new ResizeObserver(place)
    if (ref.current) observer.observe(ref.current)
    map.on('move', place)
    window.addEventListener('resize', place)
    return () => {
      observer.disconnect()
      map.off('move', place)
      window.removeEventListener('resize', place)
    }
  }, [map, lng, lat, ref])
  return position
}

/** 1c · One development: status, facts, its paperwork and a link to the council's portal. Anchored beside its pin. */
export function PlanningDevelopmentCard({ map, row }: { map: mapboxgl.Map; row: MonitorRow }) {
  const { selectRow, toggleWatch, refData } = usePlanningMode()
  const criteria = usePlanningMonitorStore(selectActiveCriteria)
  const ref = useRef<HTMLDivElement | null>(null)
  const [watchBusy, setWatchBusy] = useState(false)
  const [watchError, setWatchError] = useState<string | null>(null)
  const { documents, loading, total } = useDevelopmentDocuments(row, true)

  const position = usePinAnchor(map, [row.lng, row.lat], ref)
  const stackSize = usePlanningMonitorStore((s) => (s.stack?.items?.some((item) => stackItemKey(item) === row.key) ? s.stack.items.length : 0))
  const backToStack = usePlanningMonitorStore((s) => s.backToStack)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && selectRow(null)
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [selectRow])

  const kind = markerKind(row)
  const colors = USE_COLORS[kind]
  const lead = documents.find((d) => d.lead)
  const portal = safeUrl(row.sourceUrl) ?? lead?.url ?? null
  const note = locationNote(row)
  const brands = criteria.proximity?.brandIds.map((id) => refData.brands.find((b) => b.id === id)?.name).filter(Boolean) ?? []

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label={`${row.address || row.reference} details`}
      className="absolute z-30 flex max-h-[calc(100%-24px)] w-[390px] max-w-[calc(100%-24px)] flex-col overflow-hidden rounded-2xl bg-white shadow-[0_26px_60px_-18px_rgba(0,0,0,.6)]"
      style={position ? { left: position.left, top: position.top } : { left: -9999, top: -9999 }}
    >
      <div className="px-[18px] pb-[15px] pt-4">
        {stackSize > 1 && (
          <button
            type="button"
            onClick={backToStack}
            className="-ml-1 mb-2 inline-flex items-center gap-1 rounded-md px-1 py-0.5 text-[12px] font-semibold text-sm-violet hover:bg-[#F7F4FF] hover:text-sm-violet-deep"
          >
            <ArrowLeft size={13} aria-hidden /> {stackSize} at this location
          </button>
        )}
        <div className="flex items-start justify-between gap-2">
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[10.5px] uppercase tracking-[0.08em] ${STATUS_PILL[row.stage ?? ''] ?? 'bg-[#F5F4F2] text-[#57534E]'}`}>
            <span aria-hidden>●</span> {stageLabel(row.stage)}
          </span>
          <button type="button" onClick={() => selectRow(null)} aria-label="Close" className="-mr-1 rounded-md p-1 text-[#8A857D] hover:bg-[#F5F4F2] hover:text-sm-ink">
            <X size={16} />
          </button>
        </div>
        <h3 className="mt-2.5 text-[19px] font-bold leading-[1.25] text-sm-ink">{row.address || `${row.authorityName} ${row.reference}`}</h3>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <span className="rounded-[6px] px-2 py-0.5 text-[11.5px] font-semibold" style={{ background: colors.tint, color: colors.text }}>{KIND_LABELS[kind]}</span>
          <span className="rounded-[6px] bg-[#F5F4F2] px-2 py-0.5 text-[11.5px] font-semibold text-[#57534E]">{row.authorityName}</span>
        </div>
        {row.description?.trim() && <Description text={row.description.trim()} />}
        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-[13px]">
          {row.isResidential && (
            <div>
              <dt className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-[#8A857D]">Dwellings</dt>
              <dd className="mt-0.5 text-[16px] font-bold text-sm-ink" title={row.dwellingsReviewed ? 'Reviewed count' : 'Stated or read from the description'}>
                {row.dwellings != null ? row.dwellings.toLocaleString('en-GB') : 'Not stated'}
              </dd>
            </div>
          )}
          <Fact label="Planning ref" mono>{row.reference}</Fact>
          <Fact label="Decided">{formatShortDate(row.dateDecided) ?? '—'}</Fact>
          <Fact label="Validated">{formatShortDate(row.dateValidated) ?? (row.dateReceived ? `Received ${formatShortDate(row.dateReceived)}` : '—')}</Fact>
        </dl>
        {criteria.proximity && (
          <p className="mt-3.5 rounded-[10px] bg-[#FDEEE3] px-3 py-2.5 text-[12.5px] leading-[1.45] text-[#7A3B12]">
            {row.nearConfirmed && row.locationProvenance === 'source_exact'
              ? <>Within <strong>{milesLabel(criteria.proximity.radiusMeters)}</strong> of {brands.length ? brands.join(', ') : 'a chosen brand'} — inside your brand filter.</>
              : <>Approximate location — may be within {milesLabel(criteria.proximity.radiusMeters)} of {brands.length ? brands.join(', ') : 'a chosen brand'}.</>}
          </p>
        )}
        {note && !criteria.proximity && <p className="mt-3 text-[12px] font-medium text-[#B4531A]">{note}</p>}
        {row.familyState === 'awaiting_original' && <p className="mt-2 text-[12px] text-[#B4531A]">Original permission not yet linked.</p>}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto border-t border-[#EDEBE7] px-[18px] py-3">
        <p className="mb-1.5 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.1em] text-[#8A857D]">
          {total ?? documents.length} document{(total ?? documents.length) === 1 ? '' : 's'} in this development
          {loading && <Spinner />}
        </p>
        <DocumentRows documents={documents} />
      </div>

      <div className="flex gap-2 border-t border-[#EDEBE7] bg-sm-bg px-[18px] py-3.5">
        {portal ? (
          <a
            href={portal}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-sm-btn bg-sm-violet px-3 py-2.5 text-[13.5px] font-bold text-white hover:bg-sm-violet-deep"
          >
            <span className="truncate">View on {row.authorityName}</span> <ArrowUpRight size={15} className="shrink-0" aria-hidden />
          </a>
        ) : (
          <span className="flex flex-1 items-center justify-center rounded-sm-btn bg-[#E5E2DC] px-3 py-2.5 text-[13px] font-semibold text-[#8A857D]">No portal link</span>
        )}
        <button
          type="button"
          aria-pressed={row.watched}
          disabled={watchBusy}
          onClick={async () => {
            setWatchBusy(true)
            setWatchError(null)
            try {
              await toggleWatch(row)
            } catch (error) {
              setWatchError(error instanceof Error ? error.message : 'Could not update watch')
            } finally {
              setWatchBusy(false)
            }
          }}
          className={'inline-flex items-center gap-1.5 rounded-sm-btn border px-4 py-2.5 text-[13.5px] font-semibold disabled:opacity-60 ' + (row.watched ? 'border-sm-violet bg-[#F7F4FF] text-sm-violet-deep' : 'border-[#EDEBE7] bg-white text-sm-ink hover:bg-white/60')}
        >
          {watchBusy ? <Spinner /> : row.watched ? <Eye size={14} aria-hidden /> : null}
          {row.watched ? 'Watching' : 'Watch'}
        </button>
      </div>
      {watchError && <p role="alert" className="bg-sm-bg px-[18px] pb-3 text-[12px] text-[#C0453F]">{watchError}</p>}
    </div>
  )
}

'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type mapboxgl from 'mapbox-gl'
import { ArrowUpRight, Eye, EyeOff, Loader2, X } from 'lucide-react'
import type { MonitorRow } from '@/lib/planning-monitor/types'
import { mapAlive } from '../../map/PlanningMapLayer'
import { formatShortDate, locationNote, placePopover, relativeDays, stageLabel, typeLabelFor } from '../../../lib/planning-monitor-ui'

const STAGE_PILL: Record<string, string> = {
  approved: 'bg-[#EAF8F1] text-[#177E4E]',
  refused: 'bg-[#FDECEA] text-[#8A2A1F]',
  withdrawn: 'bg-[#F4F3F8] text-[#3D3C47]',
  pending: 'bg-[#FEF3E0] text-[#8A5A00]',
}

/**
 * The selected application, anchored beside its marker and kept on screen as the map moves.
 * "View application" opens the existing detail window; "Watch" persists independently of selection.
 */
export function PlanningApplicationPopover({
  map,
  row,
  onClose,
  onView,
  onToggleWatch,
}: {
  map: mapboxgl.Map
  row: MonitorRow
  onClose: () => void
  onView: () => void
  onToggleWatch: () => Promise<void>
}) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null)
  const [watchBusy, setWatchBusy] = useState(false)
  const [watchError, setWatchError] = useState<string | null>(null)

  useLayoutEffect(() => {
    const place = () => {
      const el = ref.current
      if (!el || !mapAlive(map)) return
      const container = map.getContainer()
      const anchor = map.project([row.lng, row.lat])
      const next = placePopover({
        anchor,
        size: { width: el.offsetWidth, height: el.offsetHeight },
        viewport: { width: container.clientWidth, height: container.clientHeight },
      })
      setPosition({ left: next.left, top: next.top })
    }
    place()
    map.on('move', place)
    window.addEventListener('resize', place)
    return () => {
      map.off('move', place)
      window.removeEventListener('resize', place)
    }
  }, [map, row.lng, row.lat, row.key])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const decided = row.stage && row.stage !== 'pending' && row.dateDecided
  const when = decided ? relativeDays(row.dateDecided) : relativeDays(row.dateReceived)
  const note = locationNote(row)

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label={`Planning application ${row.reference}`}
      className="absolute z-30 w-[320px] max-w-[calc(100%-24px)] overflow-hidden rounded-2xl bg-white shadow-[0_22px_54px_-18px_rgba(0,0,0,.5)]"
      style={position ? { left: position.left, top: position.top } : { left: -9999, top: -9999 }}
    >
      <div className="px-5 pb-4 pt-4">
        <div className="flex items-start justify-between gap-2">
          <span className={`rounded-full px-2.5 py-1 text-[12px] font-semibold ${STAGE_PILL[row.stage ?? ''] ?? 'bg-[#F4F3F8] text-[#3D3C47]'}`}>
            {stageLabel(row.stage)}{when ? ` · ${decided ? '' : 'received '}${when}` : ''}
          </span>
          <button type="button" onClick={onClose} aria-label="Close" className="-mr-1 rounded-md p-1 text-sm-ink3 hover:bg-sm-bg hover:text-sm-ink">
            <X size={15} />
          </button>
        </div>
        <h4 className="mt-2 text-[18px] font-bold leading-snug text-sm-ink">{row.address || row.reference}</h4>
        <p className="mt-1 text-[13.5px] leading-snug text-[#6B6B78]">
          {typeLabelFor(row)} · {row.authorityName} {row.reference}
        </p>
        {row.description && <p className="mt-2 line-clamp-3 text-[12.5px] leading-relaxed text-sm-ink2">{row.description}</p>}
        <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[12px] text-[#6B6B78]">
          <div><dt className="inline">Received </dt><dd className="inline text-sm-ink2">{formatShortDate(row.dateReceived) ?? '—'}</dd></div>
          <div><dt className="inline">Decided </dt><dd className="inline text-sm-ink2">{formatShortDate(row.dateDecided) ?? '—'}</dd></div>
        </dl>
        {row.dwellings != null && row.isResidential && (
          <p className="mt-1 text-[12px] text-[#6B6B78]">
            {row.dwellings.toLocaleString('en-GB')} homes {row.dwellingsReviewed ? '(reviewed count)' : '(stated or read from the description)'}
          </p>
        )}
        {row.matchedApplications > 1 && <p className="mt-1 text-[12px] text-[#6B6B78]">{row.matchedApplications} matching applications in this development</p>}
        {row.familyState === 'awaiting_original' && <p className="mt-1 text-[12px] text-[#8A5A00]">Original permission not yet linked</p>}
        {note && <p className="mt-1 text-[12px] font-medium text-[#8A5A00]">{note}</p>}
        {row.nearConfirmed && row.locationProvenance === 'source_exact' && <p className="mt-1 text-[12px] text-[#177E4E]">Near your selected stores</p>}
      </div>
      <div className="flex gap-2 bg-[#F6F3FF] px-5 py-4">
        <button
          type="button"
          onClick={onView}
          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#6C47FF] px-3 py-2.5 text-[14px] font-semibold text-white hover:bg-[#4B23C9]"
        >
          View application <ArrowUpRight size={15} aria-hidden />
        </button>
        <button
          type="button"
          aria-pressed={row.watched}
          disabled={watchBusy}
          onClick={async () => {
            setWatchBusy(true)
            setWatchError(null)
            try {
              await onToggleWatch()
            } catch (error) {
              setWatchError(error instanceof Error ? error.message : 'Could not update watch')
            } finally {
              setWatchBusy(false)
            }
          }}
          className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-[#E6E3EF] bg-white px-3.5 py-2.5 text-[14px] font-semibold text-[#4B23C9] hover:bg-[#FAF8FF] disabled:opacity-60"
        >
          {watchBusy ? <Loader2 size={14} className="animate-spin" aria-hidden /> : row.watched ? <EyeOff size={14} aria-hidden /> : <Eye size={14} aria-hidden />}
          {row.watched ? 'Watching' : 'Watch'}
        </button>
      </div>
      {watchError && <p role="alert" className="bg-[#F6F3FF] px-5 pb-3 text-[12px] text-[#8A2A1F]">{watchError}</p>}
    </div>
  )
}

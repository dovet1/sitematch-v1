'use client'

import { useEffect, useRef } from 'react'
import type mapboxgl from 'mapbox-gl'
import { ChevronRight, X } from 'lucide-react'
import { usePlanningMonitorStore, type PlanningStack } from '../../../lib/stores/planning-monitor-store'
import { KIND_LABELS, USE_COLORS, stackItemView, type StackItem } from '../../../lib/planning-monitor-ui'
import { usePinAnchor } from './PlanningDevelopmentCard'
import { usePlanningMode } from './PlanningModeContext'
import { Spinner } from './PlanningUi'

/**
 * The list behind a pin holding several applications at one point. Choosing one opens its detail
 * card, which offers a way back here. Anchored beside the pin like the card.
 */
export function PlanningStackPicker({ map, stack }: { map: mapboxgl.Map; stack: PlanningStack }) {
  const { selectRow, pickSingle, openStack } = usePlanningMode()
  const ref = useRef<HTMLDivElement | null>(null)
  const listRef = useRef<HTMLUListElement | null>(null)
  const position = usePinAnchor(map, stack.pick.lngLat, ref)
  const items = stack.items
  const views = items?.map(stackItemView) ?? []
  const shown = items ? items.length : stack.pick.count
  const approximate = views.length > 0 && views.every((v) => v.approximate)

  // Keyboard users land on the first choice once the list is there.
  const loaded = items != null
  useEffect(() => {
    if (loaded) listRef.current?.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true })
  }, [loaded])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && selectRow(null)
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [selectRow])

  const choose = (item: StackItem) => {
    if (item.type === 'row') {
      selectRow(item.row)
      return
    }
    const h = item.highlight
    pickSingle({
      applicationId: h.applicationId,
      rowKey: h.developmentId ?? `app:${h.applicationId}`,
      developmentId: h.developmentId,
      lngLat: stack.pick.lngLat,
      relaxed: true,
    })
  }

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label={`${shown} applications at this location`}
      className="absolute z-30 flex max-h-[calc(100%-24px)] w-[360px] max-w-[calc(100%-24px)] flex-col overflow-hidden rounded-2xl bg-white shadow-[0_26px_60px_-18px_rgba(0,0,0,.6)]"
      style={position ? { left: position.left, top: position.top } : { left: -9999, top: -9999 }}
    >
      <div className="flex items-start justify-between gap-2 border-b border-[#EDEBE7] px-[18px] pb-3 pt-4">
        <div>
          <p className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-[#8A857D]">Same location</p>
          <h3 className="mt-1 text-[16px] font-bold leading-tight text-sm-ink">
            {shown}{stack.more ? '+' : ''} applications here
          </h3>
        </div>
        <button type="button" onClick={() => selectRow(null)} aria-label="Close" className="-mr-1 rounded-md p-1 text-[#8A857D] hover:bg-[#F5F4F2] hover:text-sm-ink">
          <X size={16} />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-1.5">
        {!items && (
          <p className="flex items-center gap-2 px-2.5 py-3 text-[12.5px] text-[#8A857D]">
            <Spinner /> Loading applications…
          </p>
        )}
        {stack.error && (
          <div role="alert" className="px-2.5 py-3">
            <p className="text-[12.5px] text-[#C0453F]">{stack.error}</p>
            {!stack.pick.highlights && (
              <button type="button" onClick={() => openStack(stack.pick)} className="mt-1.5 text-[12px] font-semibold text-sm-violet hover:text-sm-violet-deep">
                Try again
              </button>
            )}
          </div>
        )}
        {items && items.length > 0 && (
          <ul ref={listRef}>
            {items.map((item, i) => {
              const view = views[i]
              const colors = USE_COLORS[view.kind]
              return (
                <li key={view.key} className="border-b border-[#F3F1ED] last:border-0">
                  <button
                    type="button"
                    onClick={() => choose(item)}
                    className="flex w-full gap-2.5 rounded-[9px] px-2.5 py-2.5 text-left hover:bg-[#F7F4FF] focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-sm-violet"
                  >
                    <span className="mt-[6px] h-2 w-2 shrink-0 rounded-full" style={{ background: colors.solid }} aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-semibold text-sm-ink">{view.title}</span>
                      {view.description && (
                        <span className="mt-0.5 block line-clamp-2 text-[12px] leading-snug text-[#57534E]">{view.description}</span>
                      )}
                      <span className="mt-1 flex flex-wrap items-center gap-1.5">
                        <span className="rounded-[5px] px-1.5 py-px text-[10.5px] font-semibold" style={{ background: colors.tint, color: colors.text }}>{KIND_LABELS[view.kind]}</span>
                        <span className="truncate font-mono text-[10px] uppercase tracking-[0.04em] text-[#8A857D]">{view.meta}</span>
                      </span>
                    </span>
                    <ChevronRight size={15} className="mt-0.5 shrink-0 text-[#C9C3BA]" aria-hidden />
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {(approximate || stack.more) && (
        <div className="border-t border-[#EDEBE7] bg-sm-bg px-[18px] py-2.5 text-[11.5px] leading-snug text-[#57534E]">
          {approximate && <p className="text-[#B4531A]">Approximate location — these share a postcode or area centre, not necessarily one site.</p>}
          {stack.more && <p className={approximate ? 'mt-1' : ''}>Showing the newest {items?.length}. Narrow the filters to see the rest.</p>}
        </div>
      )}
    </div>
  )
}

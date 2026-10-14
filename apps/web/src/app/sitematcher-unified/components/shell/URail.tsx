'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useWorkspaceStore } from '../../lib/stores/unified-workspace-store'
import { usePlanningMonitorEnabled } from '../../lib/planning-monitor-flag-context'
import { useBrandMatcherEnabled } from '../../lib/brand-matcher-flag-context'
import { availableModes, type ModeNavEntry } from '../../lib/mode-nav'
import { useSwitchMode } from '../../lib/hooks/useSwitchMode'

// Hovering waits this long before the card appears; moving between items once it is up is instant.
export const HOVER_CARD_DELAY_MS = 300

interface Hovered {
  mode: ModeNavEntry
  // Viewport position of the item, so the card can be portalled clear of the rail's overflow.
  top: number
  right: number
}

export function URail() {
  const { view, drawingPatch, switchMode } = useSwitchMode()
  const chooserOpen = useWorkspaceStore((s) => s.chooserOpen)
  const setChooserOpen = useWorkspaceStore((s) => s.setChooserOpen)
  const modes = availableModes({
    planning: usePlanningMonitorEnabled(),
    brandMatcher: useBrandMatcherEnabled(),
  })

  const [hovered, setHovered] = useState<Hovered | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const clearTimer = () => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
  }
  useEffect(() => clearTimer, [])

  const locate = (mode: ModeNavEntry, el: HTMLElement): Hovered => {
    const rect = el.getBoundingClientRect()
    const rail = el.closest('nav')?.getBoundingClientRect()
    return { mode, top: rect.top, right: rail?.right ?? rect.right }
  }

  const hoverItem = (mode: ModeNavEntry, el: HTMLElement) => {
    clearTimer()
    const next = locate(mode, el)
    if (hovered) setHovered(next)
    else timer.current = setTimeout(() => setHovered(next), HOVER_CARD_DELAY_MS)
  }

  const hideCard = () => {
    clearTimer()
    setHovered(null)
  }

  return (
    <nav
      aria-label="Modes"
      onMouseLeave={hideCard}
      className="flex h-full w-[78px] shrink-0 flex-col items-center gap-1 border-r border-sm-border bg-sm-surface py-3"
    >
      {modes.map((mode) => {
        const { id, railLabel, name, Icon } = mode
        const active = view === id
        const locked = drawingPatch && !active
        const showing = hovered?.mode.id === id && !chooserOpen
        return (
          <button
            key={id}
            type="button"
            title={locked ? 'Finish or cancel the patch first' : undefined}
            aria-label={name}
            aria-pressed={active}
            aria-describedby={showing ? `mode-card-${id}` : undefined}
            disabled={locked}
            onClick={() => {
              hideCard()
              switchMode(id)
            }}
            onMouseEnter={(e) => hoverItem(mode, e.currentTarget)}
            onFocus={(e) => {
              // Keyboard focus shows the card at once; a mouse click's focus leaves it to hover.
              if (!isFocusVisible(e.currentTarget)) return
              clearTimer()
              setHovered(locate(mode, e.currentTarget))
            }}
            onBlur={hideCard}
            className={
              'flex h-[58px] w-[66px] flex-col items-center justify-center gap-1 rounded-xl transition-colors ' +
              (active
                ? 'bg-sm-ink text-white'
                : locked
                  ? 'cursor-not-allowed text-[#D5D0C8]'
                  : 'text-[#57534E] hover:bg-[#F1ECFF] hover:text-sm-violet-deep')
            }
          >
            <Icon size={20} strokeWidth={1.8} />
            <span className="text-[10.5px] font-semibold leading-none">{railLabel}</span>
          </button>
        )
      })}

      <div className="mt-auto">
        <button
          type="button"
          aria-label="Choose a mode"
          onClick={() => {
            hideCard()
            setChooserOpen(true)
          }}
          className="flex h-9 w-9 items-center justify-center rounded-full border-[1.5px] border-sm-violet text-sm font-bold text-sm-violet transition-colors hover:bg-[#F1ECFF]"
        >
          ?
        </button>
      </div>

      {hovered && !chooserOpen && <URailHoverCard {...hovered} />}
    </nav>
  )
}

function isFocusVisible(el: HTMLElement): boolean {
  try {
    return el.matches(':focus-visible')
  } catch {
    // Engines without :focus-visible: treat every focus as keyboard focus.
    return true
  }
}

function URailHoverCard({ mode, top, right }: Hovered) {
  const { id, name, description, Icon } = mode
  return createPortal(
    <div
      id={`mode-card-${id}`}
      role="tooltip"
      style={{ left: right + 12, top: top - 8 }}
      className="pointer-events-none fixed z-[100] w-[320px] overflow-hidden rounded-2xl bg-white [box-shadow:0_24px_60px_-18px_rgba(23,20,25,.45),0_0_0_1px_#EDEBE7]"
    >
      {/* Placeholder until the per-mode preview loops are supplied. */}
      <div aria-hidden className="flex h-[110px] items-center justify-center bg-[#F5F4F2] text-sm-ink4">
        <Icon size={36} strokeWidth={1.4} />
      </div>
      <div className="px-[18px] pb-[18px] pt-4">
        <div className="text-base font-bold text-sm-ink">{name}</div>
        <p className="mt-1.5 text-[13.5px] leading-[1.5] text-sm-ink2">{description}</p>
      </div>
    </div>,
    document.body
  )
}

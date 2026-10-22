'use client'

import { useRef, useState } from 'react'
import { Check } from 'lucide-react'
import { useWorkspaceStore } from '../../lib/stores/unified-workspace-store'
import { usePlanningMonitorEnabled } from '../../lib/planning-monitor-flag-context'
import { useBrandMatcherEnabled } from '../../lib/brand-matcher-flag-context'
import { useModeChooserDontShow } from '../../lib/mode-chooser-pref-context'
import { availableModes, readLocalDontShow, writeLocalDontShow } from '../../lib/mode-nav'
import { useFocusTrap } from '../../lib/hooks/useFocusTrap'
import { useSwitchMode } from '../../lib/hooks/useSwitchMode'

/**
 * "What do you want to do today?" — opens on load (see useModeNavStartup) and from the rail's
 * "?" button. Sits below the top bar so the chrome stays visible and un-dimmed.
 */
export function UModeChooser() {
  const open = useWorkspaceStore((s) => s.chooserOpen)
  if (!open) return null
  return <ModeChooserDialog />
}

function ModeChooserDialog() {
  const setChooserOpen = useWorkspaceStore((s) => s.setChooserOpen)
  const { view, drawingPatch, switchMode } = useSwitchMode()
  const modes = availableModes({
    planning: usePlanningMonitorEnabled(),
    brandMatcher: useBrandMatcherEnabled(),
  })
  const dontShowOnAccount = useModeChooserDontShow()
  const [dontShow, setDontShow] = useState(() => dontShowOnAccount || readLocalDontShow())

  const close = () => setChooserOpen(false)
  const ref = useRef<HTMLDivElement>(null)
  useFocusTrap(ref, true, close)

  const toggleDontShow = () => {
    const next = !dontShow
    setDontShow(next)
    // Saved straight away, without closing. The account copy follows the user across devices;
    // the local copy covers a failed save on this browser.
    writeLocalDontShow(next)
    void fetch('/api/user/preferences', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dont_show_mode_chooser: next }),
    }).catch(() => {})
  }

  return (
    <div
      className="fixed inset-x-0 bottom-0 top-14 z-[150] flex items-center justify-center bg-[rgba(14,12,22,.6)] p-6"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close()
      }}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="mode-chooser-title"
        className="max-h-full w-[1040px] max-w-[calc(100vw-48px)] overflow-y-auto rounded-[22px] bg-white px-9 pb-7 pt-[34px] [box-shadow:0_40px_100px_-30px_rgba(0,0,0,.6)]"
      >
        <div className="font-mono text-[11px] uppercase tracking-[.14em] text-sm-violet">
          Welcome to SiteMatcher
        </div>
        <h2 id="mode-chooser-title" className="mt-2 text-[30px] font-bold tracking-[-.02em] text-sm-ink">
          What do you want to do today?
        </h2>
        <p className="mt-1.5 text-[15px] text-[#57534E]">
          Pick a starting point. You can switch any time from the rail on the left.
        </p>

        <div className="mt-6 grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
          {modes.map(({ id, chooserTitle, chooserBody, chooserCta, Icon }, i) => {
            const locked = drawingPatch && id !== view
            return (
              <button
                key={id}
                type="button"
                data-autofocus={i === 0 ? true : undefined}
                disabled={locked}
                title={locked ? 'Finish or cancel the patch first' : undefined}
                onClick={() => {
                  if (switchMode(id)) close()
                }}
                className="flex flex-col gap-2.5 rounded-2xl border border-[#EDEBE7] p-[18px] text-left transition-colors hover:border-sm-violet hover:bg-[#F7F4FF] focus-visible:border-sm-violet focus-visible:bg-[#F7F4FF] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-[#EDEBE7] disabled:hover:bg-transparent"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F5F4F2] text-sm-ink">
                  <Icon size={20} strokeWidth={1.8} />
                </span>
                <span className="text-base font-bold text-sm-ink">{chooserTitle}</span>
                <span className="text-[13.5px] leading-[1.5] text-sm-ink2">{chooserBody}</span>
                <span className="mt-auto text-[13px] font-bold text-sm-violet">{chooserCta} →</span>
              </button>
            )
          })}
        </div>

        <div className="mt-[22px] flex flex-wrap items-center justify-between gap-3">
          <label className="flex cursor-pointer items-center gap-2 text-[13px] text-[#57534E]">
            <input type="checkbox" checked={dontShow} onChange={toggleDontShow} className="peer sr-only" />
            <span
              aria-hidden
              className={
                'flex h-[18px] w-[18px] items-center justify-center rounded-[5px] border-[1.5px] peer-focus-visible:ring-2 peer-focus-visible:ring-sm-violet/40 ' +
                (dontShow ? 'border-sm-violet bg-sm-violet text-white' : 'border-[#CFCAC2] bg-white')
              }
            >
              {dontShow && <Check size={12} strokeWidth={3} />}
            </span>
            Don’t show this again
          </label>
          <button
            type="button"
            onClick={close}
            className="text-[13.5px] font-semibold text-sm-ink3 transition-colors hover:text-sm-ink"
          >
            Skip, just show me the map
          </button>
        </div>
      </div>
    </div>
  )
}

'use client'

import { useEffect, useState } from 'react'
import { RevealWrapper } from '@/components/homepage-new/RevealWrapper'
import { VideoSlot } from '@/components/homepage-new/VideoSlot'
import { MODES } from '@/data/homepage-bm/content'
import { Eyebrow, H2, NARROW, SECTION } from './ui'

// "Also included": the other SiteMatcher modes. Desktop: a list beside a sticky media panel,
// hover or click to switch. Narrow: an accordion with the clip inline under the open row.

function useNarrow(maxWidth = 720): boolean {
  const [narrow, setNarrow] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${maxWidth}px)`)
    const update = () => setNarrow(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [maxWidth])
  return narrow
}

function ModeMedia({ mode }: { mode: (typeof MODES)[number] }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-sm-border bg-sm-surface">
      <VideoSlot label={mode.n} note={mode.videoSrc ? undefined : 'Clip coming soon'} ratio="16/10" videoSrc={mode.videoSrc} alt={`${mode.n} in SiteMatcher`} />
    </div>
  )
}

export function Modes() {
  const [on, setOn] = useState(0)
  const narrow = useNarrow()

  return (
    <section className={`${SECTION} !pt-5`}>
      <RevealWrapper>
        <div className={NARROW}>
          <Eyebrow>Also included</Eyebrow>
          <h2 className={`${H2} !text-[clamp(26px,3vw,38px)]`}>Tools to help commercial agents</h2>
          <div className="mt-10 grid grid-cols-[minmax(0,5fr)_minmax(0,7fr)] items-start gap-10 max-[720px]:grid-cols-1 max-[720px]:gap-0">
            <div className="flex flex-col border-t border-sm-border">
              {MODES.map((m, i) => {
                const active = on === i
                return (
                  <div
                    key={m.id}
                    onMouseEnter={() => !narrow && setOn(i)}
                    className={
                      'group flex flex-col gap-1.5 border-b border-l-2 border-b-sm-border-soft py-[18px] pl-[18px] max-[720px]:border-l-0 max-[720px]:py-0 max-[720px]:pl-0 ' +
                      (active ? 'border-l-sm-violet-deep max-[720px]:pb-5' : 'border-l-transparent')
                    }
                  >
                    <button
                      type="button"
                      aria-expanded={active}
                      onClick={() => setOn(i)}
                      className="flex items-center justify-between gap-3 text-left max-[720px]:min-h-[44px] max-[720px]:py-[18px]"
                    >
                      <span
                        className={`text-[18px] font-semibold tracking-[-0.2px] group-hover:text-sm-ink ${active ? 'text-sm-ink' : 'text-sm-ink3'}`}
                      >
                        {m.n}
                      </span>
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 12 12"
                        fill="none"
                        aria-hidden
                        className={`hidden shrink-0 text-sm-ink3 transition-transform duration-200 max-[720px]:block ${active ? 'rotate-180' : ''}`}
                      >
                        <path d="M3 4.5 6 7.5 9 4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                    {active && <span className="text-[15px] leading-[1.55] text-sm-ink2 [text-wrap:pretty]">{m.d}</span>}
                    {narrow && active && (
                      <div className="mt-3">
                        <ModeMedia mode={m} />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
            {!narrow && (
              <div className="sticky top-6">
                <ModeMedia key={MODES[on].id} mode={MODES[on]} />
              </div>
            )}
          </div>
        </div>
      </RevealWrapper>
    </section>
  )
}

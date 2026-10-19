'use client'

import { forwardRef } from 'react'
import {
  explainDemographic,
  type DemographicExplanationRow,
  type DemographicMatch,
} from '../../../lib/brand-matcher-demographics'
import { Kicker } from './BrandMatcherUi'

const HEADING_TONE: Record<DemographicMatch['band'], string> = {
  good: 'text-[#177E4E]',
  partial: 'text-[#B7860B]',
  weak: 'text-[#5B6472]',
  any: 'text-[#5B6472]',
}

// "Why this fit": what pattern the brand's towns follow, why it matters, and how the site's town
// did on each measure of it.
export const DemographicBreakdownPanel = forwardRef<
  HTMLElement,
  { demographic: DemographicMatch; brandName: string }
>(function DemographicBreakdownPanel({ demographic, brandName }, ref) {
  const e = explainDemographic(demographic, brandName)
  return (
    <section
      ref={ref}
      aria-label="Why this demographic fit"
      className="scroll-mt-4 border-t border-sm-border-soft bg-[#FBFAFE] px-6 py-5"
    >
      <Kicker>Why this fit — demographics</Kicker>
      <h4 className={`mt-2 text-[15px] font-bold ${HEADING_TONE[demographic.band]}`}>{e.heading}</h4>
      <p className="mt-1 max-w-[760px] text-[13.5px] leading-relaxed text-sm-ink2">{e.summary}</p>

      {e.why.length > 0 && (
        <dl className="mt-4 grid gap-3 md:grid-cols-3">
          {e.why.map((w) => (
            <div key={w.title} className="rounded-xl border border-sm-border-soft bg-sm-surface px-4 py-3">
              <dt className="text-[12.5px] font-semibold text-sm-ink">{w.title}</dt>
              <dd className="mt-1 text-[12.5px] leading-relaxed text-sm-ink2">{w.text}</dd>
            </div>
          ))}
        </dl>
      )}

      {e.rows.length > 0 && (
        <>
          <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-1 text-[11.5px] text-sm-ink3">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full border-2 border-white bg-[#177E4E] shadow" />
              {demographic.townName}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-5 rounded-full bg-[#A98BF5]" />
              Half of their towns
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-5 rounded-full bg-[#DCD1FB]" />8 in 10 of their towns
            </span>
          </div>
          <ul className="mt-2 space-y-3">
            {e.rows.map((r) => (
              <BreakdownRow key={r.signalName} row={r} />
            ))}
          </ul>
        </>
      )}

      <div className="mt-4 space-y-1 text-[12px] leading-relaxed text-sm-ink3">
        {e.size && <p>{e.size} Size is shown for reference and is not part of the score.</p>}
        <p>{e.basis}</p>
      </div>
    </section>
  )
})

function BreakdownRow({ row }: { row: DemographicExplanationRow }) {
  const at = (x: number) => `${Math.min(100, Math.max(0, x * 100))}%`
  const span = ([lo, hi]: [number, number]) => ({ left: at(lo), width: `${Math.max(0, (hi - lo) * 100)}%` })
  return (
    <li className="grid gap-x-6 gap-y-2 rounded-xl border border-sm-border bg-sm-surface px-4 py-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_auto] md:items-center">
      <div className="min-w-0">
        <div className="text-[13.5px] font-semibold text-sm-ink">{row.topic}</div>
        <div className="text-[12.5px] text-sm-ink3">{row.lean}</div>
      </div>

      <div className="min-w-0">
        <div
          className="relative h-2.5 rounded-full bg-[#EEEAF6]"
          role="img"
          aria-label={`${row.site}. ${row.theirs}.`}
        >
          <span className="absolute inset-y-0 rounded-full bg-[#DCD1FB]" style={span(row.range)} />
          <span className="absolute inset-y-0 rounded-full bg-[#A98BF5]" style={span(row.typical)} />
          <span
            className={
              'absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow ' +
              (row.inLine ? 'bg-[#177E4E]' : 'bg-[#D9A21B]')
            }
            style={{ left: at(row.siteRank) }}
          />
        </div>
        <div className="mt-1 flex justify-between text-[10.5px] text-sm-ink3" aria-hidden>
          <span>{row.ends[0]}</span>
          <span>{row.ends[1]}</span>
        </div>
        <p className="mt-1 text-[12px] leading-snug text-sm-ink2">
          {row.site}. {row.theirs}.
        </p>
        <p className={'text-[12px] font-medium ' + (row.inLine ? 'text-[#177E4E]' : 'text-[#B7860B]')}>{row.verdict}.</p>
      </div>

      <div className="text-right text-[13px] tabular-nums text-sm-ink3 md:w-[72px]">
        <span className="text-[15px] font-semibold text-sm-ink">{row.points}</span> / {row.maxPoints}
        <div className="text-[11px]">points</div>
      </div>
    </li>
  )
}

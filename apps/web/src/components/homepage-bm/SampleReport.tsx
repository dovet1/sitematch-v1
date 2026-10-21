import { SAMPLE_ROWS, SAMPLE_SITE } from '@/data/homepage-bm/content'

// The static "Sample report" card under the hero: an illustration of a Brand Matcher list.

const GRID =
  'grid grid-cols-[36px_minmax(0,1.5fr)_104px_repeat(4,72px)_minmax(0,2.1fr)] items-center gap-3.5 max-md:grid-cols-[28px_minmax(0,1fr)_84px] max-md:gap-2.5'

function Pips({ v }: { v: number }) {
  return (
    <div className="flex gap-[3px]">
      {[1, 2, 3, 4, 5].map((i) => (
        <i key={i} className={`h-1.5 w-3 rounded-[2px] ${i <= v ? 'bg-sm-violet' : 'bg-sm-border-soft'}`} />
      ))}
    </div>
  )
}

export function SampleReport() {
  return (
    <div className="mx-auto mt-16 max-w-[1180px] overflow-hidden rounded-[18px] border border-sm-border bg-sm-surface text-left shadow-[0_30px_60px_-36px_rgba(20,10,40,0.28)] max-md:mt-10 max-md:rounded-[14px]">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-sm-border-soft px-[22px] py-[18px] max-md:p-4">
        <div className="flex flex-col gap-1.5">
          <div className="text-[16px] font-semibold tracking-[-0.2px] text-sm-ink">{SAMPLE_SITE}</div>
          <div className="flex flex-wrap gap-1.5">
            {['4,200 sq ft', 'Class E', 'Ground floor'].map((c) => (
              <span key={c} className="rounded-md border border-sm-border-soft bg-sm-bg px-2 py-[3px] font-mono text-[11px] text-sm-ink2">
                {c}
              </span>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-dashed border-sm-border px-[9px] py-[5px] font-mono text-[11px] uppercase tracking-[0.6px] text-sm-ink3">
            Sample report
          </span>
          <span className="rounded-full bg-sm-violet-tint-soft px-2.5 py-1.5 font-mono text-[12px] text-sm-violet-deep">38 brands ranked</span>
        </div>
      </div>
      <div className={`${GRID} bg-sm-bg px-[22px] py-2.5 font-mono text-[10.5px] uppercase tracking-[0.8px] text-sm-ink3 max-md:hidden`}>
        <span>#</span>
        <span>Brand</span>
        <span>Fit score</span>
        <span>Presence</span>
        <span>Acquisition</span>
        <span>Planning</span>
        <span>Financials</span>
        <span>Who to call</span>
      </div>
      {SAMPLE_ROWS.map((r, i) => (
        <div key={r.n} className={`${GRID} border-b border-sm-border-soft px-[22px] py-3.5 last:border-b-0 max-md:px-4`}>
          <span className="font-mono text-[13px] text-sm-ink3">{String(i + 1).padStart(2, '0')}</span>
          <div className="flex min-w-0 items-center gap-2.5">
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[13px] font-semibold text-white"
              style={{ background: r.c }}
            >
              {r.n[0]}
            </span>
            <div className="min-w-0">
              <div className="text-[14px] font-semibold text-sm-ink">{r.n}</div>
              <div className="text-[12px] text-sm-ink3">{r.sec}</div>
            </div>
          </div>
          <div className="flex items-center gap-2 max-md:justify-end">
            <span className="w-6 font-mono text-[14px] font-medium text-sm-ink">{r.score}</span>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-sm-violet-tint max-md:hidden">
              <span className="block h-full rounded-full bg-sm-violet" style={{ width: `${r.score}%` }} />
            </div>
          </div>
          {r.s.map((v, j) => (
            <div key={j} className="max-md:hidden">
              <Pips v={v} />
            </div>
          ))}
          <div className="flex min-w-0 items-center justify-between gap-2.5 max-md:col-span-2 max-md:col-start-2">
            <div className="min-w-0">
              <div className="truncate text-[13px] font-semibold text-sm-ink">{r.who}</div>
              <div className="truncate text-[12px] text-sm-ink3">{r.role}</div>
            </div>
            <span className="shrink-0 rounded-lg bg-sm-violet-tint px-[9px] py-1.5 text-[12px] font-semibold text-sm-violet">Reveal contact</span>
          </div>
        </div>
      ))}
    </div>
  )
}

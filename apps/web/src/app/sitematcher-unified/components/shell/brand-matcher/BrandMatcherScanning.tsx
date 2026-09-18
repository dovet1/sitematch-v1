'use client'

import { useEffect, useState } from 'react'
import { Check, Diamond, Loader2 } from 'lucide-react'
import { useBrandMatcherStore } from '../../../lib/stores/brand-matcher-store'
import { formatSqft, classLabel } from '../../../lib/brand-matcher'

// Sequence fixed by the handoff.
const STEPS = ['Site-size fit', 'Acquisitive signals', 'Trading facts', 'Same location type', 'Nearest store']
const STEP_MS = 380
// Once the answer is in, finish the remaining steps quickly rather than make anyone wait.
const FAST_STEP_MS = 120

const DOT_FIELD: React.CSSProperties = {
  backgroundImage: 'radial-gradient(circle, rgba(185,160,255,0.35) 1px, transparent 1.5px)',
  backgroundSize: '24px 24px',
  maskImage: 'radial-gradient(ellipse 34% 48% at 50% 48%, #000 25%, transparent 72%)',
  WebkitMaskImage: 'radial-gradient(ellipse 34% 48% at 50% 48%, #000 25%, transparent 72%)',
}

export function BrandMatcherScanning() {
  const form = useBrandMatcherStore((s) => s.form)
  const ready = useBrandMatcherStore((s) => s.result != null)
  const brandsTracked = useBrandMatcherStore((s) => s.brandsTracked)
  const considered = useBrandMatcherStore((s) => s.result?.considered ?? null)
  const showResults = useBrandMatcherStore((s) => s.showResults)
  const editSite = useBrandMatcherStore((s) => s.editSite)
  // Index of the active step; STEPS.length = all complete.
  const [active, setActive] = useState(0)

  useEffect(() => {
    if (active >= STEPS.length) {
      if (ready) {
        const t = setTimeout(showResults, 180)
        return () => clearTimeout(t)
      }
      return
    }
    // Hold on the last step until the request has actually answered.
    if (active === STEPS.length - 1 && !ready) return
    const t = setTimeout(() => setActive((a) => a + 1), ready ? FAST_STEP_MS : STEP_MS)
    return () => clearTimeout(t)
  }, [active, ready, showResults])

  const count = considered ?? brandsTracked
  const sqft = Number(form.sqft.replace(/[,\s]/g, ''))

  return (
    <div className="relative flex min-h-full flex-col items-center justify-center overflow-hidden bg-[#0E0C14] px-6 py-24 text-center">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_45%_50%_at_50%_45%,rgba(112,51,255,0.35)_0%,rgba(14,12,20,0)_70%)]"
      />
      <div aria-hidden className="pointer-events-none absolute inset-0" style={DOT_FIELD} />

      <div className="relative">
        <div className="relative mx-auto h-[150px] w-[150px]">
          <svg viewBox="0 0 150 150" className="absolute inset-0 h-full w-full animate-spin [animation-duration:1.6s]">
            <circle cx="75" cy="75" r="68" fill="none" stroke="rgba(160,130,255,0.35)" strokeWidth="2" />
            <circle
              cx="75"
              cy="75"
              r="68"
              fill="none"
              stroke="url(#bm-arc)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeDasharray="110 318"
            />
            <defs>
              <linearGradient id="bm-arc" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#FFFFFF" />
                <stop offset="100%" stopColor="#7033FF" />
              </linearGradient>
            </defs>
          </svg>
          <span className="absolute left-1/2 top-1/2 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-xl bg-sm-violet text-white shadow-[0_0_30px_rgba(112,51,255,0.6)]">
            <Diamond size={18} />
          </span>
        </div>

        <div className="mt-10 text-[12px] font-bold uppercase tracking-[0.24em] text-[#A58BFF]">
          Matching your site
        </div>
        <h1 className="mt-3 text-[40px] font-bold tracking-[-0.02em] text-white" aria-live="polite">
          Scanning {count != null ? `${count.toLocaleString('en-GB')} ` : ''}brands…
        </h1>
        <p className="mt-2 text-[16px] text-white/70">
          {Number.isFinite(sqft) && sqft > 0 ? `${formatSqft(sqft)} sq ft` : ''} ·{' '}
          {classLabel(form.useClass)} · {form.postcode.toUpperCase()}
        </p>

        <ol className="mt-8 flex flex-wrap justify-center gap-2.5">
          {STEPS.map((label, i) => {
            const done = i < active
            const current = i === active
            return (
              <li
                key={label}
                className={
                  'flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition-colors ' +
                  (done
                    ? 'border-white/15 bg-white/10 text-white'
                    : current
                      ? 'border-white/20 bg-white/10 text-white'
                      : 'border-white/10 text-white/40')
                }
              >
                {done && <Check size={13} className="text-[#3DDC97]" />}
                {current && <Loader2 size={13} className="animate-spin text-[#A58BFF]" />}
                {label}
              </li>
            )
          })}
        </ol>

        <button
          type="button"
          onClick={editSite}
          className="mt-10 text-[13px] font-medium text-white/50 underline-offset-4 hover:text-white/80 hover:underline"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

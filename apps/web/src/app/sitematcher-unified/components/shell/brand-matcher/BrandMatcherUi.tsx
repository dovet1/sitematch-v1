'use client'

import type { Pill } from '../../../lib/brand-matcher'
import type { ScorePart, SignalTone } from '../../../types/brand-matcher'

// Signal-pill colours carry meaning and are fixed by the handoff — do not map them to the
// app palette. Neutral grey is for facts (turnover, distance): never judge a trading fact.
export const TONE: Record<SignalTone, { label: string; bg: string; border: string }> = {
  green: { label: 'text-[#177E4E]', bg: 'bg-[#EAF8F1]', border: 'border-[#CDEEDD]' },
  amber: { label: 'text-[#B7860B]', bg: 'bg-[#FBF7EE]', border: 'border-[#F1E6C8]' },
  red: { label: 'text-[#C0453F]', bg: 'bg-[#FDF3F3]', border: 'border-[#F5D6D4]' },
  neutral: { label: 'text-[#5B6472]', bg: 'bg-[#F5F6FA]', border: 'border-[#E6E8EF]' },
}

// With `onClick` the pill is a button that opens its explanation ("Why?" in the corner).
export function SignalPill({ pill, onClick }: { pill: Pill; onClick?: () => void }) {
  const t = TONE[pill.tone]
  const body = (
    <>
      {onClick ? (
        <div className={`flex items-center justify-between gap-1 text-[9.5px] font-bold uppercase tracking-[0.08em] ${t.label}`}>
          <span className="truncate">{pill.label}</span>
          <span className="flex-shrink-0 normal-case tracking-normal underline">Why?</span>
        </div>
      ) : (
        <div className={`truncate text-[9.5px] font-bold uppercase tracking-[0.08em] ${t.label}`}>{pill.label}</div>
      )}
      <div className="mt-0.5 truncate text-[12.5px] font-medium text-sm-ink">
        {pill.value}
        {pill.mark && <span className="ml-1">{pill.mark}</span>}
      </div>
    </>
  )
  const box = `block w-full min-w-0 rounded-[10px] border px-3 py-2 text-left ${t.bg} ${t.border}`
  if (!onClick) {
    return (
      <div title={pill.title} className={box}>
        {body}
      </div>
    )
  }
  return (
    <button
      type="button"
      title={pill.title}
      aria-label={`${pill.label}: ${pill.value}. Why this fit?`}
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      className={`${box} transition-shadow hover:shadow-[0_2px_8px_-4px_rgba(20,10,40,0.35)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-sm-violet`}
    >
      {body}
    </button>
  )
}

const PART_LABEL: Record<ScorePart['component'], string> = {
  size: 'Size fit',
  useClass: 'Use class',
  acquisitive: 'Acquisitive',
  locationType: 'Same location type',
  nearest: 'Distance to nearest store',
}

// Violet arc at the percentage; grey when no acquisitive signal contributed (handoff).
export function ScoreRing({
  score,
  parts,
  muted,
  size = 56,
}: {
  score: number
  parts: ScorePart[]
  muted: boolean
  size?: number
}) {
  const colour = muted ? '#B5AEC0' : '#7033FF'
  const breakdown = parts.map((p) => `${PART_LABEL[p.component]}: ${p.points}/${p.max}`).join('\n')
  return (
    <div
      role="img"
      aria-label={`Match score ${score}%`}
      title={`Match score ${score}%\n${breakdown}`}
      className="relative flex flex-shrink-0 items-center justify-center rounded-full"
      style={{
        width: size,
        height: size,
        background: `conic-gradient(${colour} ${score * 3.6}deg, #EEEBF3 0deg)`,
      }}
    >
      <div
        className="flex items-center justify-center rounded-full bg-sm-surface"
        style={{ width: size - 10, height: size - 10 }}
      >
        <span
          className={`text-[13px] font-bold tabular-nums ${muted ? 'text-sm-ink3' : 'text-sm-ink'}`}
        >
          {score}%
        </span>
      </div>
    </div>
  )
}

export function Kicker({
  children,
  tone = 'violet',
  className = '',
}: {
  children: React.ReactNode
  tone?: 'violet' | 'green' | 'ink'
  className?: string
}) {
  const colour =
    tone === 'green' ? 'text-[#177E4E]' : tone === 'ink' ? 'text-sm-ink3' : 'text-sm-violet-deep'
  return (
    <span className={`text-[10.5px] font-bold uppercase tracking-[0.12em] ${colour} ${className}`}>
      {children}
    </span>
  )
}

const NUMBER_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten']

export function numberWord(n: number): string {
  return NUMBER_WORDS[n] ?? String(n)
}

'use client'

import { Check, Info, Minus, X } from 'lucide-react'
import type { SignalStatus } from '../../../lib/brand-matcher'

// Brand Matcher building blocks (docs/design_handoff_brand_matcher_signals). Status colours carry
// meaning and are fixed by the handoff: do not map them to the app palette.

const GLYPH: Record<SignalStatus, { bg: string; fg: string; label: string }> = {
  good: { bg: 'bg-[#E3F3EA]', fg: 'text-[#1E8A56]', label: 'Good' },
  caution: { bg: 'bg-[#FDF3DC]', fg: 'text-[#8A5F06]', label: 'Check' },
  poor: { bg: 'bg-[#FBE7E6]', fg: 'text-[#A33A35]', label: 'Concern' },
  none: { bg: 'bg-[#F4F3F9]', fg: 'text-[#B7B5C2]', label: 'No data' },
  info: { bg: 'bg-[#EFEBFD]', fg: 'text-[#6C47FF]', label: 'Not scored' },
}

// Status by shape as well as colour: tick, caution, cross, dash, and an "i" for a signal shown but
// not scored.
export function StatusGlyph({ status, size = 18 }: { status: SignalStatus; size?: number }) {
  const g = GLYPH[status]
  return (
    <span
      role="img"
      aria-label={g.label}
      className={`inline-flex flex-shrink-0 items-center justify-center rounded-full ${g.bg} ${g.fg}`}
      style={{ width: size, height: size }}
    >
      {status === 'good' && <Check size={11} strokeWidth={3.5} />}
      {status === 'caution' && <span className="text-[11px] font-extrabold leading-none">!</span>}
      {status === 'poor' && <X size={10} strokeWidth={3.5} />}
      {status === 'none' && <Minus size={12} strokeWidth={3} />}
      {status === 'info' && <Info size={12} strokeWidth={2.75} />}
    </span>
  )
}

export function SignalCell({ status, value }: { status: SignalStatus; value: string }) {
  return (
    <div className="flex min-w-0 items-center gap-[7px]">
      <StatusGlyph status={status} />
      <span
        className={
          'min-w-0 text-[13.5px] leading-tight ' +
          (status === 'none'
            ? 'font-medium text-[#A9A6B5]'
            : status === 'poor'
              ? 'font-semibold text-[#A33A35]'
              : 'font-semibold text-[#2A2833]')
        }
      >
        {status === 'none' ? 'No data' : value}
      </span>
    </div>
  )
}

// Right-hand panel heading: "<Signal>: <verdict>" and a one or two sentence summary.
export function PanelTitle({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-[18px] font-bold text-[#1C1B22]">{title}</h4>
      {children && <p className="mt-1 text-[14.5px] leading-[1.5] text-[#6B6B78] [text-wrap:pretty]">{children}</p>}
    </div>
  )
}

// Key/value rows with hairline dividers. A row with a null value reads as unknown (muted).
export function KvRows({
  rows,
  labelWidth = 170,
}: {
  rows: { label: string; value: React.ReactNode; muted?: boolean; aside?: React.ReactNode }[]
  labelWidth?: number
}) {
  return (
    <div className="flex flex-col">
      {rows.map((r, i) => (
        <div
          key={r.label}
          className={
            'grid items-baseline gap-3.5 border-t border-[#F2F0F7] py-3 text-[14px] ' +
            (i === rows.length - 1 ? 'border-b' : '')
          }
          style={{ gridTemplateColumns: `${labelWidth}px minmax(0,1fr) auto` }}
        >
          <span className="text-[#8A8895]">{r.label}</span>
          <span className={r.muted ? 'text-[#8A8895]' : 'font-semibold text-[#1C1B22]'}>{r.value}</span>
          <span className="text-[13px] text-[#8A8895]">{r.aside}</span>
        </div>
      ))}
    </div>
  )
}

export function Footnote({ children }: { children: React.ReactNode }) {
  return <p className="text-[12.5px] leading-[1.5] text-[#8A8895]">{children}</p>
}

export const PANEL_LINK = 'text-[13.5px] font-semibold text-[#6C47FF] hover:text-[#4B23C9]'

// The empty state for a signal we hold no data for (handoff #2bempty).
export function EmptyPanel({
  kicker,
  title,
  children,
  action,
}: {
  kicker: string
  title: string
  children: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-2.5">
      <span className="text-[11.5px] font-bold uppercase tracking-[0.06em] text-[#8A8895]">{kicker}</span>
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#F4F3F9] text-[#B7B5C2]">
        <Minus size={15} strokeWidth={3} />
      </span>
      <h4 className="mt-1 text-[16px] font-bold text-[#1C1B22]">{title}</h4>
      <p className="text-[13.5px] leading-[1.5] text-[#6B6B78] [text-wrap:pretty]">{children}</p>
      {action}
    </div>
  )
}

const NUMBER_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten']

export function numberWord(n: number): string {
  return NUMBER_WORDS[n] ?? String(n)
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return n === 1 ? one : many
}

export function listPhrase(items: string[]): string {
  if (items.length <= 1) return items[0] ?? ''
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
}

// "3 Oct", with the year when it is not this year.
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function shortDate(iso: string): string {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`)
  const day = `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`
  return d.getUTCFullYear() === new Date().getUTCFullYear() ? day : `${day} ${d.getUTCFullYear()}`
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

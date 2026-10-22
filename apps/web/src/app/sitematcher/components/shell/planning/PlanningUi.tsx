'use client'

import type { ReactNode } from 'react'
import { X } from 'lucide-react'
import type { FilterChip } from '../../../lib/planning-monitor-ui'

/** Small shared pieces of Planning mode's visual language (see the design handoff, frames 1a–1j). */

export function Eyebrow({ children, tone = 'muted', className = '' }: { children: ReactNode; tone?: 'muted' | 'violet'; className?: string }) {
  return (
    <p className={`font-mono text-[11px] uppercase tracking-[0.14em] ${tone === 'violet' ? 'text-sm-violet' : 'text-[#8A857D]'} ${className}`}>
      {children}
    </p>
  )
}

export function GroupLabel({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-[#8A857D]">{children}</span>
      {action}
    </div>
  )
}

export function MonoMeta({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <span className={`font-mono text-[10.5px] uppercase tracking-[0.04em] text-[#8A857D] ${className}`}>{children}</span>
}

const TOGGLE_ON = { violet: 'bg-sm-violet', teal: 'bg-[#0F9B8E]' }

export function Toggle({
  checked,
  onChange,
  label,
  tone = 'violet',
  disabled,
}: {
  checked: boolean
  onChange: (next: boolean) => void
  label: string
  tone?: 'violet' | 'teal'
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation()
        onChange(!checked)
      }}
      className={
        'relative inline-flex h-[19px] w-[32px] shrink-0 items-center rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sm-violet disabled:opacity-50 ' +
        (checked ? TOGGLE_ON[tone] : 'bg-[#E5E2DC]')
      }
    >
      <span className={'absolute h-[13px] w-[13px] rounded-full bg-white shadow-sm transition-transform ' + (checked ? 'translate-x-[16px]' : 'translate-x-[3px]')} />
    </button>
  )
}

const CHIP_TONES: Record<FilterChip['tone'], string> = {
  neutral: 'bg-white text-sm-ink border border-[#EDEBE7]',
  residential: 'bg-sm-violet-tint text-sm-violet-deep',
  commercial: 'bg-[#E4F5F2] text-[#0B7D72]',
}

/** A filter summary chip. `floating` adds the map shadow; `onRemove` adds the ✕. */
export function FilterChipView({ chip, onRemove, floating }: { chip: FilterChip; onRemove?: () => void; floating?: boolean }) {
  return (
    <span
      className={
        `inline-flex items-center gap-1.5 rounded-full font-semibold ${CHIP_TONES[chip.tone]} ` +
        (floating ? 'px-3 py-2 text-[12.5px] shadow-[0_4px_12px_-4px_rgba(0,0,0,.4)]' : 'px-2.5 py-1 text-[12.5px]')
      }
    >
      {chip.label}
      {onRemove && chip.removable && (
        <button type="button" onClick={onRemove} aria-label={`Remove ${chip.label}`} className="-mr-0.5 rounded-full p-0.5 opacity-70 hover:opacity-100">
          <X size={12} strokeWidth={2.4} />
        </button>
      )}
    </span>
  )
}

export function PrimaryButton({ children, className = '', ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...props}
      className={
        'inline-flex items-center justify-center gap-1.5 rounded-sm-btn bg-sm-violet px-4 py-2.5 text-[13.5px] font-bold text-white transition-colors hover:bg-sm-violet-deep focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sm-violet disabled:cursor-not-allowed disabled:bg-[#E5E2DC] disabled:text-[#A8A29A] ' +
        className
      }
    >
      {children}
    </button>
  )
}

export function OutlineButton({ children, className = '', ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...props}
      className={
        'inline-flex items-center justify-center gap-1.5 rounded-sm-btn border border-[#EDEBE7] bg-white px-4 py-2.5 text-[13.5px] font-semibold text-sm-ink transition-colors hover:bg-sm-bg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sm-violet disabled:cursor-not-allowed disabled:opacity-50 ' +
        className
      }
    >
      {children}
    </button>
  )
}

/** A numbered step in the drawing tracker. */
export function Step({ n, state, title, hint }: { n: number; state: 'active' | 'done' | 'pending'; title: string; hint?: string }) {
  return (
    <li className="flex gap-2.5">
      <span
        className={
          'flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full font-mono text-[11px] font-semibold ' +
          (state === 'pending' ? 'bg-[#F5F4F2] text-[#A8A29A]' : 'bg-sm-violet-tint text-sm-violet-deep')
        }
      >
        {n}
      </span>
      <span className="min-w-0">
        <span className={'block text-[13.5px] font-semibold ' + (state === 'pending' ? 'text-[#A8A29A]' : 'text-sm-ink')}>{title}</span>
        {hint && <span className={'block text-[12.5px] ' + (state === 'pending' ? 'text-[#A8A29A]' : 'text-[#57534E]')}>{hint}</span>}
      </span>
    </li>
  )
}

export function Spinner({ className = '' }: { className?: string }) {
  return <span aria-hidden className={`inline-block h-3 w-3 animate-spin rounded-full border-[1.5px] border-current border-t-transparent ${className}`} />
}

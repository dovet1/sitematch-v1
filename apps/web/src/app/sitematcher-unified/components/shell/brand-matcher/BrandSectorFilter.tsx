'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown, X } from 'lucide-react'
import type { SectorOption } from '../../../lib/brand-matcher'

// Multi-select sector filter for the results bar. Sized to sit beside the Sort select.
export function BrandSectorFilter({
  options,
  selected,
  onChange,
}: {
  options: SectorOption[]
  selected: string[]
  onChange: (ids: string[]) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const toggle = (id: string) =>
    onChange(selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id])

  const label =
    selected.length === 0
      ? 'All sectors'
      : selected.length === 1
        ? options.find((o) => o.id === selected[0])?.name ?? '1 sector'
        : `${selected.length} sectors`

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className={
          'inline-flex max-w-[240px] items-center gap-2 rounded-xl border py-2.5 pl-4 pr-3 text-[13.5px] font-medium transition-colors ' +
          (selected.length > 0
            ? 'border-sm-violet bg-sm-violet-tint-soft text-sm-ink'
            : 'border-sm-border bg-sm-surface text-sm-ink hover:border-sm-border-hard')
        }
      >
        <span className="truncate">Sector: {label}</span>
        <ChevronDown size={14} className="shrink-0 text-sm-ink3" />
      </button>

      {open && (
        <div className="absolute right-0 top-[calc(100%+6px)] z-30 w-[280px] overflow-hidden rounded-xl border border-sm-border bg-sm-surface shadow-[0_20px_44px_-12px_rgba(0,0,0,0.19)]">
          <div className="flex h-10 items-center justify-between border-b border-sm-border-soft px-3 text-[12px] font-semibold text-sm-ink3">
            <span>Filter by sector</span>
            {selected.length > 0 && (
              <button
                type="button"
                onClick={() => onChange([])}
                className="inline-flex items-center gap-1 font-medium hover:text-sm-ink2"
              >
                <X size={12} />
                Clear
              </button>
            )}
          </div>
          <div className="max-h-72 overflow-y-auto" role="menu" aria-label="Sector options">
            {options.map((o) => {
              const on = selected.includes(o.id)
              return (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => toggle(o.id)}
                  role="menuitemcheckbox"
                  aria-checked={on}
                  className={
                    'flex min-h-10 w-full items-center gap-2.5 border-b border-sm-border-soft px-3 py-2 text-left text-[13px] ' +
                    (on ? 'bg-sm-violet-tint-soft' : 'hover:bg-sm-bg')
                  }
                >
                  <span
                    className={
                      'flex h-4 w-4 shrink-0 items-center justify-center rounded border ' +
                      (on ? 'border-sm-violet bg-sm-violet text-white' : 'border-sm-border')
                    }
                  >
                    {on && <Check size={9} />}
                  </span>
                  <span className={'min-w-0 flex-1 truncate ' + (on ? 'font-semibold text-sm-ink' : 'text-sm-ink')}>
                    {o.name}
                  </span>
                  <span className="shrink-0 font-mono text-[11.5px] text-sm-ink3">{o.count}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

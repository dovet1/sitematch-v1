'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { SIZE_BANDS, bandById, type SizeBandId } from '../../lib/size-filter'

// "I have a unit this big" — the third control in the Assess brand filter row,
// alongside Category and Brand. Picking a band re-sorts the list around the
// user's unit rather than hiding anything: the counts here are fits only, and
// the footer says how many brands the answer is simply unknown for, because
// "we don't know" and "doesn't fit" must not read as the same result.
export function SizeFilterControl({
  selected,
  fitCounts,
  unknownCount,
  onChange,
}: {
  selected: SizeBandId | null
  fitCounts: Record<SizeBandId, number>
  unknownCount: number
  onChange: (id: SizeBandId | null) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const band = bandById(selected)

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

  return (
    <div ref={ref} className="relative flex-1">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={
          'flex h-8 w-full items-center gap-1.5 rounded-lg border px-2.5 text-[12px] transition-colors ' +
          (band
            ? 'border-sm-violet bg-sm-violet font-medium text-white'
            : 'border-sm-border bg-sm-surface text-sm-ink2 hover:bg-sm-bg')
        }
      >
        <span className="truncate">{band ? band.short : 'Size'}</span>
        <ChevronDown
          size={13}
          className={'ml-auto shrink-0 ' + (band ? 'text-white' : 'text-sm-ink3')}
        />
      </button>

      {open && (
        <div className="absolute right-0 top-[calc(100%+4px)] z-30 w-[264px] rounded-xl border border-sm-border bg-sm-surface p-1.5 shadow-[0_20px_44px_-12px_rgba(0,0,0,0.19)]">
          <div className="px-2.5 pb-1.5 pt-2 font-mono text-[9.5px] font-semibold uppercase tracking-[0.14em] text-sm-ink3">
            Match my unit size
          </div>
          {SIZE_BANDS.map((b) => {
            const active = selected === b.id
            const count = fitCounts[b.id] ?? 0
            return (
              <button
                key={b.id}
                type="button"
                onClick={() => {
                  onChange(active ? null : b.id)
                  setOpen(false)
                }}
                className={
                  'flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-[7px] text-left transition-colors ' +
                  (active ? 'bg-sm-violet-tint-soft' : 'hover:bg-sm-bg')
                }
              >
                <span className="min-w-0">
                  <span className="block truncate text-[12.5px] font-semibold text-sm-ink">
                    {b.label}
                  </span>
                  <span className="mt-px block text-[11px] text-sm-ink3">
                    {count} {count === 1 ? 'brand fits' : 'brands fit'}
                  </span>
                </span>
                {active && <Check size={14} className="shrink-0 text-sm-violet" />}
              </button>
            )
          })}
          <div className="mt-1 flex items-center justify-between gap-2 border-t border-sm-border-soft px-2.5 pb-0.5 pt-2">
            <span className="text-[11px] text-sm-ink3">
              {unknownCount} {unknownCount === 1 ? 'brand has' : 'brands have'} no
              size on record
            </span>
            {selected && (
              <button
                type="button"
                onClick={() => {
                  onChange(null)
                  setOpen(false)
                }}
                className="shrink-0 text-[11.5px] font-semibold text-sm-violet hover:text-sm-violet-deep"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// Shown only while a band is active. The one sentence in the panel that keeps
// the two claims apart — without it a user reads a measured GIA range as though
// the brand had asked for it.
export function SizeExplainer() {
  return (
    <div className="flex gap-2 border-b border-sm-border-soft bg-sm-violet-tint-soft px-[18px] py-2.5">
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="mt-px shrink-0 text-sm-violet-deep"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8h.01M11 12h1v4h1" />
      </svg>
      <p className="text-[11.5px] leading-[1.45] text-sm-ink2">
        A <b className="font-semibold text-sm-violet-deep">requirement</b> is what a
        brand says it wants — current. A{' '}
        <b className="font-semibold text-sm-ink">size</b> is measured from its
        existing shops (gross internal area, historic). They are kept separate.
      </p>
    </div>
  )
}

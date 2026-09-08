'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, ChevronDown, Search, X } from 'lucide-react'
import { SizeFilterControl, SizeExplainer } from './SizeFilterControl'
import type { SizeBandId } from '../../lib/size-filter'

export interface FilterOption {
  id: string
  name: string
}

function FilterDropdown({
  label,
  options,
  selected,
  onChange,
  align = 'trigger',
}: {
  label: string
  options: FilterOption[]
  selected: string[]
  onChange: (ids: string[]) => void
  align?: 'trigger' | 'filter-row'
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options
    return options.filter((o) => o.name.toLowerCase().includes(q))
  }, [options, query])

  const selectedSet = useMemo(() => new Set(selected), [selected])
  const toggle = (id: string) => {
    if (selectedSet.has(id)) onChange(selected.filter((s) => s !== id))
    else onChange([...selected, id])
  }

  const count = selected.length

  return (
    <div ref={ref} className="relative flex-1">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className={
          'flex h-8 w-full items-center gap-1.5 rounded-lg border px-2.5 text-[12px] transition-colors ' +
          (count > 0
            ? 'border-sm-violet bg-sm-violet-tint-soft text-sm-ink'
            : 'border-sm-border bg-sm-surface text-sm-ink2 hover:bg-sm-bg')
        }
      >
        <span className="truncate">{label}</span>
        {count > 0 && (
          <span className="ml-auto flex h-4 min-w-4 items-center justify-center rounded-full bg-sm-violet px-1 font-mono text-[10px] font-semibold text-white">
            {count}
          </span>
        )}
        <ChevronDown
          size={13}
          className={(count > 0 ? '' : 'ml-auto ') + 'shrink-0 text-sm-ink3'}
        />
      </button>

      {open && (
        <div
          style={
            align === 'filter-row'
              ? { left: 'calc(-100% - 0.5rem)' }
              : undefined
          }
          className={
            'absolute left-0 top-[calc(100%+4px)] z-30 w-[276px] overflow-hidden rounded-xl border border-sm-border bg-sm-surface shadow-[0_20px_44px_-12px_rgba(0,0,0,0.19)]'
          }
        >
          <div className="flex h-10 items-center gap-2 border-b border-sm-border-soft px-3">
            <Search size={14} className="shrink-0 text-sm-ink3" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Search ${label.toLowerCase()}…`}
              aria-label={`Search ${label.toLowerCase()}`}
              className="min-w-0 flex-1 bg-transparent text-[13px] text-sm-ink placeholder:text-sm-ink3 focus:outline-none"
            />
            {count > 0 && (
              <button
                type="button"
                onClick={() => onChange([])}
                title="Clear"
                aria-label={`Clear ${label.toLowerCase()} filter`}
                className="shrink-0 text-sm-ink3 hover:text-sm-ink2"
              >
                <X size={13} />
              </button>
            )}
          </div>
          <div className="max-h-60 overflow-y-auto" role="menu" aria-label={`${label} options`}>
            {filtered.length === 0 && (
              <div className="px-3 py-2.5 text-xs text-sm-ink3">No matches</div>
            )}
            {filtered.map((o) => {
              const on = selectedSet.has(o.id)
              return (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => toggle(o.id)}
                  role="menuitemcheckbox"
                  aria-checked={on}
                  className={
                    'flex min-h-10 w-full items-start gap-2.5 border-b border-sm-border-soft px-3 py-2.5 text-left text-[13px] leading-5 ' +
                    (on ? 'bg-sm-violet-tint-soft' : 'hover:bg-sm-bg')
                  }
                >
                  <span
                    className={
                      'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ' +
                      (on
                        ? 'border-sm-violet bg-sm-violet text-white'
                        : 'border-sm-border')
                    }
                  >
                    {on && <Check size={9} />}
                  </span>
                  <span
                    className={
                      'min-w-0 whitespace-normal break-words ' +
                      (on ? 'font-semibold text-sm-ink' : 'text-sm-ink')
                    }
                  >
                    {o.name}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

export function BrandFilterBar({
  categoryOptions,
  brandOptions,
  selectedCategoryIds,
  selectedBrandIds,
  sizeBandId,
  sizeFitCounts,
  sizeUnknownCount,
  showSizeFilter,
  onCategoryChange,
  onBrandChange,
  onSizeBandChange,
  onClear,
}: {
  categoryOptions: FilterOption[]
  brandOptions: FilterOption[]
  selectedCategoryIds: string[]
  selectedBrandIds: string[]
  sizeBandId: SizeBandId | null
  sizeFitCounts: Record<SizeBandId, number>
  sizeUnknownCount: number
  // Hidden when the floor-area lookup is unavailable, so the row never offers a
  // control that could only ever return nothing.
  showSizeFilter: boolean
  onCategoryChange: (ids: string[]) => void
  onBrandChange: (ids: string[]) => void
  onSizeBandChange: (id: SizeBandId | null) => void
  onClear: () => void
}) {
  const active =
    selectedCategoryIds.length > 0 || selectedBrandIds.length > 0 || sizeBandId != null
  return (
    <>
      <div className="flex items-center gap-2 border-b border-sm-border-soft px-[18px] py-2.5">
        <FilterDropdown
          label="Category"
          options={categoryOptions}
          selected={selectedCategoryIds}
          onChange={onCategoryChange}
        />
        <FilterDropdown
          label="Brand"
          options={brandOptions}
          selected={selectedBrandIds}
          onChange={onBrandChange}
          align="filter-row"
        />
        {showSizeFilter && (
          <SizeFilterControl
            selected={sizeBandId}
            fitCounts={sizeFitCounts}
            unknownCount={sizeUnknownCount}
            onChange={onSizeBandChange}
          />
        )}
        {active && (
          <button
            type="button"
            onClick={onClear}
            className="shrink-0 rounded-lg px-2 py-1 text-[12px] font-medium text-sm-ink3 hover:text-sm-ink2"
          >
            Clear
          </button>
        )}
      </div>
      {sizeBandId != null && <SizeExplainer />}
    </>
  )
}

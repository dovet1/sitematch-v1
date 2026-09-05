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
}: {
  label: string
  options: FilterOption[]
  selected: string[]
  onChange: (ids: string[]) => void
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
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
        <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-20 rounded-lg border border-sm-border bg-sm-surface shadow-lg">
          <div className="flex h-9 items-center gap-2 border-b border-sm-border-soft px-2.5">
            <Search size={13} className="text-sm-ink3" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Search ${label.toLowerCase()}…`}
              className="w-full bg-transparent text-xs text-sm-ink placeholder:text-sm-ink3 focus:outline-none"
            />
            {count > 0 && (
              <button
                type="button"
                onClick={() => onChange([])}
                title="Clear"
                className="shrink-0 text-sm-ink3 hover:text-sm-ink2"
              >
                <X size={13} />
              </button>
            )}
          </div>
          <div className="max-h-48 overflow-y-auto">
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
                  className={
                    'flex w-full items-center gap-2 border-b border-sm-border-soft px-3 py-1.5 text-left text-xs ' +
                    (on ? 'bg-sm-violet-tint-soft' : 'hover:bg-sm-bg')
                  }
                >
                  <span
                    className={
                      'flex h-4 w-4 shrink-0 items-center justify-center rounded border ' +
                      (on
                        ? 'border-sm-violet bg-sm-violet text-white'
                        : 'border-sm-border')
                    }
                  >
                    {on && <Check size={9} />}
                  </span>
                  <span
                    className={
                      'truncate ' + (on ? 'font-semibold text-sm-ink' : 'text-sm-ink')
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

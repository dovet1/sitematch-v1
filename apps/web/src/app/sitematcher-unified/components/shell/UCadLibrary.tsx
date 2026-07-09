'use client'

import { useMemo, useState } from 'react'
import { Search, Loader2, MapPin, Check } from 'lucide-react'
import { useSketchStore } from '@/lib/sitesketcher-v2/state-manager'
import type { SavedCad } from '@/types/sitesketcher-v2'

// Browse-and-place view over the admin-maintained shared CAD library. Regular
// users never upload here — the store's `savedCads` array is populated by
// `loadSharedCads()` in the unified workspace. Placement reuses the standalone
// `startCadPlacement` flow unchanged.
export function UCadLibrary() {
  const savedCads = useSketchStore((s) => s.savedCads)
  const loading = useSketchStore((s) => s.savedCadsLoading)
  const error = useSketchStore((s) => s.savedCadsError)
  const startCadPlacement = useSketchStore((s) => s.startCadPlacement)
  const cadPlacementInProgress = useSketchStore((s) => s.cadPlacementInProgress)

  const [query, setQuery] = useState('')
  const [format, setFormat] = useState<string | null>(null)

  // Format filter chips with live counts, derived from the library itself.
  const formats = useMemo(() => {
    const counts = new Map<string, number>()
    for (const cad of savedCads) {
      const f = cad.format?.trim()
      if (f) counts.set(f, (counts.get(f) ?? 0) + 1)
    }
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1])
  }, [savedCads])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return savedCads.filter((cad) => {
      if (format && cad.format?.trim() !== format) return false
      if (!q) return true
      return [cad.name, cad.brand, cad.format, cad.sourceStore]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q))
    })
  }, [savedCads, query, format])

  return (
    <div className="flex flex-col gap-3 p-4">
      <p className="text-[12px] leading-relaxed text-sm-ink3">
        Browse the shared plan library, then drop a plan on your parcel to trace
        or measure against it.
      </p>

      {/* Search */}
      <div className="relative">
        <Search
          size={14}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm-ink3"
        />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search brand, format, store…"
          className="w-full rounded-lg border border-sm-border bg-sm-surface py-2 pl-8 pr-3 text-[13px] text-sm-ink placeholder:text-sm-ink3 focus:border-sm-violet focus:outline-none"
        />
      </div>

      {/* Format filter chips */}
      {formats.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <FilterChip
            label="All"
            count={savedCads.length}
            active={format === null}
            onClick={() => setFormat(null)}
          />
          {formats.map(([f, count]) => (
            <FilterChip
              key={f}
              label={f}
              count={count}
              active={format === f}
              onClick={() => setFormat(format === f ? null : f)}
            />
          ))}
        </div>
      )}

      {/* States */}
      {loading && (
        <div className="flex items-center gap-2 py-6 text-[12.5px] text-sm-ink3">
          <Loader2 size={14} className="animate-spin" /> Loading library…
        </div>
      )}

      {error && !loading && (
        <div className="rounded-lg border border-[#E7CFCB] bg-[#FBEEEC] px-3 py-2.5 text-[12px] text-[#B23A2C]">
          {error}
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div className="rounded-xl border border-dashed border-sm-border bg-sm-bg px-3 py-6 text-center text-[12.5px] text-sm-ink3">
          {savedCads.length === 0
            ? 'The shared library is empty. An admin can add plans from the CAD library admin page.'
            : 'No plans match your search.'}
        </div>
      )}

      {/* Card grid */}
      {!loading && filtered.length > 0 && (
        <div className="grid grid-cols-2 gap-2.5">
          {filtered.map((cad) => (
            <CadCard
              key={cad.id}
              cad={cad}
              placing={cadPlacementInProgress?.savedCadId === cad.id}
              onPlace={() => startCadPlacement(cad.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function FilterChip({
  label,
  count,
  active,
  onClick,
}: {
  label: string
  count: number
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        'flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ' +
        (active
          ? 'border-sm-violet bg-sm-violet-tint-soft text-sm-violet-deep'
          : 'border-sm-border bg-sm-surface text-sm-ink2 hover:bg-sm-bg')
      }
    >
      {label}
      <span className="font-mono text-[10px] text-sm-ink3">{count}</span>
    </button>
  )
}

function CadCard({
  cad,
  placing,
  onPlace,
}: {
  cad: SavedCad
  placing: boolean
  onPlace: () => void
}) {
  const meta = [cad.sourceStore, cad.surveyYear].filter(Boolean).join(' · ')
  const dims = [
    cad.gia != null ? `${Math.round(cad.gia).toLocaleString()} m²` : null,
    cad.dims,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <button
      type="button"
      onClick={onPlace}
      title={placing ? 'Click the map to drop' : 'Place on parcel'}
      className={
        'group flex flex-col overflow-hidden rounded-xl border text-left transition-all ' +
        (placing
          ? 'border-sm-violet ring-2 ring-sm-violet/20'
          : 'border-sm-border hover:border-sm-violet/50')
      }
    >
      <div className="relative aspect-[4/3] w-full bg-sm-bg">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={cad.url}
          alt={cad.name}
          className="h-full w-full object-cover"
        />
        <span className="absolute left-1.5 top-1.5 flex items-center gap-0.5 rounded bg-white/90 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-emerald-600">
          <Check size={9} /> Cal
        </span>
        <span
          className={
            'absolute inset-0 flex items-center justify-center gap-1 bg-sm-violet/85 text-[12px] font-semibold text-white transition-opacity ' +
            (placing ? 'opacity-100' : 'opacity-0 group-hover:opacity-100')
          }
        >
          <MapPin size={13} />
          {placing ? 'Click map' : 'Place'}
        </span>
      </div>
      <div className="flex flex-col gap-0.5 p-2">
        <span className="truncate text-[12.5px] font-semibold text-sm-ink">
          {cad.brand || cad.name}
        </span>
        {cad.format && (
          <span className="truncate font-mono text-[9.5px] uppercase tracking-wide text-sm-violet-deep">
            {cad.format}
          </span>
        )}
        {meta && (
          <span className="truncate font-mono text-[9.5px] uppercase tracking-wide text-sm-ink3">
            {meta}
          </span>
        )}
        {dims && (
          <span className="truncate font-mono text-[9.5px] text-sm-ink3">
            {dims}
          </span>
        )}
      </div>
    </button>
  )
}

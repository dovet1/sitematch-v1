'use client'

import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { useSketchStore } from '@/lib/sitesketcher-v2/state-manager'
import { deriveAutoLayoutStale } from '@/lib/sitesketcher-v2/auto-parking/staleness'

const WARNING_CARD_CLASS = 'rounded-lg border border-[#F2E3CB] bg-[#FDF6EC] px-3 py-2 text-[12px] leading-relaxed text-[#8A6318]'

/** Per-object inspector for an applied AutoParkingLayout — states 05 (applied) and 06 (out of date). */
export function USketchAutoLayoutInspector({ layoutId }: { layoutId: string }) {
  const layout = useSketchStore((s) => s.autoLayouts.find((l) => l.id === layoutId))
  const polygons = useSketchStore((s) => s.polygons)
  const cadInstances = useSketchStore((s) => s.cadInstances)
  const cadImages = useSketchStore((s) => s.cadImages)
  const savedCads = useSketchStore((s) => s.savedCads)
  const updateAutoLayout = useSketchStore((s) => s.updateAutoLayout)
  const deleteAutoLayout = useSketchStore((s) => s.deleteAutoLayout)
  const setSelectedAutoLayoutId = useSketchStore((s) => s.setSelectedAutoLayoutId)
  const enterAutoParkingEditor = useSketchStore((s) => s.enterAutoParkingEditor)

  const [localName, setLocalName] = useState(layout?.name ?? '')
  useEffect(() => {
    setLocalName(layout?.name ?? '')
  }, [layout?.name])

  // Derived, never stored — see auto-parking/staleness.ts.
  const stale = useMemo(() => {
    if (!layout) return false
    return deriveAutoLayoutStale(layout, { polygons, cadInstances, cadImages, savedCads })
  }, [layout, polygons, cadInstances, cadImages, savedCads])

  const boundaryPolygon = layout ? polygons.find((p) => p.id === layout.boundaryId) : undefined

  if (!layout) return null

  const handleNameBlur = () => {
    if (localName.trim() && localName !== layout.name) updateAutoLayout(layout.id, { name: localName.trim() })
    else setLocalName(layout.name)
  }

  const handleEditSettings = () => {
    setSelectedAutoLayoutId(null)
    enterAutoParkingEditor(layout, { expandSettings: true })
  }

  const handleRegenerate = () => {
    setSelectedAutoLayoutId(null)
    enterAutoParkingEditor(layout)
  }

  const handleRemove = () => {
    if (!confirm(`Remove "${layout.name}" from this sketch?`)) return
    deleteAutoLayout(layout.id)
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      {stale && (
        <div className="rounded-xl border border-[#F2E3CB] bg-[#FDF6EC] px-3 py-3">
          <div className="flex items-start gap-2">
            <AlertTriangle size={15} className="mt-0.5 shrink-0 text-[#B07A1E]" />
            <div>
              <div className="text-[13px] font-semibold text-[#8A6318]">Layout out of date</div>
              <p className="mt-1 text-[12px] leading-relaxed text-[#8A6318]">
                {boundaryPolygon ? `${boundaryPolygon.name} was reshaped` : 'Its site boundary was changed'} after this
                layout was generated. Figures below reflect the previous boundary.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleRegenerate}
            className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg bg-sm-violet px-3 py-2 text-[12.5px] font-semibold text-white transition-colors hover:bg-sm-violet-deep"
          >
            <RefreshCw size={13} /> Regenerate for new boundary
          </button>
        </div>
      )}

      <input
        value={localName}
        onChange={(e) => setLocalName(e.target.value)}
        onBlur={handleNameBlur}
        className={
          'rounded-lg border border-transparent bg-transparent px-1.5 py-1 text-[15px] font-semibold text-sm-ink hover:border-sm-border focus:border-sm-violet focus:bg-sm-surface focus:outline-none ' +
          (stale ? 'opacity-55' : '')
        }
      />

      <div className={'rounded-xl border border-sm-border bg-sm-bg px-3 py-2.5 ' + (stale ? 'opacity-55' : '')}>
        <span className="font-mono text-[9.5px] font-semibold uppercase tracking-wider text-sm-ink3">
          Total spaces{stale ? ' · was' : ''}
        </span>
        <div className="mt-1 text-[22px] font-semibold text-sm-ink">{layout.metrics.totalSpaces}</div>
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 font-mono text-[10.5px] text-sm-ink3">
          <span>Standard {layout.metrics.standard}</span>
          <span>Accessible {layout.metrics.accessible}</span>
          <span>{Math.round(layout.metrics.footprintSqm)} m²</span>
        </div>
      </div>

      <dl className={'flex flex-col gap-1.5 rounded-xl border border-sm-border bg-sm-surface px-3 py-2.5 ' + (stale ? 'opacity-55' : '')}>
        <PropertyRow
          label="Stall size"
          value={layout.settingsSnapshot.stallSize === 'standard' ? '2.4 × 4.8 m' : '2.7 × 5.0 m'}
        />
        <PropertyRow label="Aisle width" value={`${layout.settingsSnapshot.aisleWidth} m`} />
        <PropertyRow label="Boundary setback" value={`${layout.settingsSnapshot.boundarySetback} m`} />
        <PropertyRow label="Buildings avoided" value={`${layout.exclusionRefs.length}`} />
      </dl>

      {layout.warnings.length > 0 && (
        <div className={WARNING_CARD_CLASS}>
          {layout.warnings.map((w) => (
            <div key={w.code}>{w.message}</div>
          ))}
        </div>
      )}

      <p className="text-[11px] leading-relaxed text-sm-ink3">
        Concept layout only. Review planning compliance, accessibility, vehicle tracking, gradients, drainage and
        highway design separately.
      </p>

      <button
        type="button"
        onClick={handleEditSettings}
        className="rounded-lg border border-sm-border bg-sm-surface px-3 py-2 text-[12.5px] font-medium text-sm-ink transition-colors hover:bg-sm-bg"
      >
        Edit layout settings
      </button>
      {!stale && (
        <button
          type="button"
          onClick={handleRegenerate}
          className="rounded-lg border border-sm-border bg-sm-surface px-3 py-2 text-[12.5px] font-medium text-sm-ink transition-colors hover:bg-sm-bg"
        >
          Regenerate
        </button>
      )}
      <button
        type="button"
        onClick={handleRemove}
        className="rounded-lg border border-[#FADCDC] bg-[#FEF1F1] px-3 py-2 text-[12.5px] font-semibold text-[#E5484D] transition-colors hover:bg-[#FBEEEC]"
      >
        Remove from Sketch
      </button>
    </div>
  )
}

function PropertyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-[12px] text-sm-ink3">{label}</dt>
      <dd className="font-mono text-[12px] text-sm-ink">{value}</dd>
    </div>
  )
}

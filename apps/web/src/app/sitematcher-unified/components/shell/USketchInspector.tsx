'use client'

import { useMemo } from 'react'
import { Download, FileJson, X } from 'lucide-react'
import { useSketchStore } from '@/lib/sitesketcher-v2/state-manager'
import {
  calculatePolygonArea,
  calculateAllEdgeDistances,
} from '@/lib/sitesketcher-v2/polygon-utils'
import { exportCSV, exportJSON } from '@/lib/sitesketcher-v2/export-utils'
import { PolygonInspector } from '../../../sitesketcher-v2/components/inspectors/PolygonInspector'
import { ParkingInspector } from '../../../sitesketcher-v2/components/inspectors/ParkingInspector'
import { CadInspector } from '../../../sitesketcher-v2/components/inspectors/CadInspector'

function Kicker({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-mono text-[9.5px] font-semibold uppercase tracking-wider text-sm-ink3">
      {children}
    </span>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-sm-border bg-sm-surface px-3 py-2.5">
      <Kicker>{label}</Kicker>
      <div className="mt-1 text-[18px] font-semibold tracking-[-0.3px] text-sm-ink">
        {value}
      </div>
    </div>
  )
}

function MeasureRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-[18px] py-2.5">
      <span className="text-[12.5px] text-sm-ink3">{label}</span>
      <span className="font-mono text-[12.5px] text-sm-ink">{value}</span>
    </div>
  )
}

// Scheme-level metrics for the active sketch, derived from the store. Sits in the
// unified right rail while Sketch mode is active.
const OBJECT_TITLES: Record<string, string> = {
  polygon: 'Plot properties',
  parking: 'Parking block',
  cad: 'CAD overlay',
}

export function USketchInspector() {
  const sketchName = useSketchStore((s) => s.sketchName)
  const polygons = useSketchStore((s) => s.polygons)
  const parkingBlocks = useSketchStore((s) => s.parkingBlocks)
  const cadInstances = useSketchStore((s) => s.cadInstances)
  const getSketchData = useSketchStore((s) => s.getSketchData)
  const selectedId = useSketchStore((s) => s.selectedId)
  const selectedType = useSketchStore((s) => s.selectedType)
  const setSelectedId = useSketchStore((s) => s.setSelectedId)

  const metrics = useMemo(() => {
    const plotArea = polygons.reduce((sum, p) => sum + calculatePolygonArea(p.points), 0)
    const perimeter = polygons.reduce(
      (sum, p) => sum + calculateAllEdgeDistances(p.points).reduce((a, b) => a + b, 0),
      0
    )
    const parkingSpaces = parkingBlocks.reduce((sum, b) => sum + b.spaces, 0)
    return { plotArea, perimeter, parkingSpaces }
  }, [polygons, parkingBlocks])

  const areaLabel =
    metrics.plotArea < 10000
      ? `${metrics.plotArea.toFixed(0)} m²`
      : `${(metrics.plotArea / 10000).toFixed(2)} ha`
  const perimeterLabel =
    metrics.perimeter < 1000
      ? `${metrics.perimeter.toFixed(0)} m`
      : `${(metrics.perimeter / 1000).toFixed(2)} km`

  const isEmpty =
    polygons.length === 0 && parkingBlocks.length === 0 && cadInstances.length === 0

  const handleExportCSV = () => exportCSV({ name: sketchName, data: getSketchData() })
  const handleExportJSON = () =>
    exportJSON({ name: sketchName, description: '', data: getSketchData() })

  // A selected object takes over the rail with its editing inspector.
  if (selectedId && selectedType) {
    return (
      <aside className="flex w-[320px] shrink-0 flex-col overflow-hidden border-l border-sm-border bg-sm-surface">
        <div className="flex items-center justify-between border-b border-sm-border-soft px-[18px] py-[14px]">
          <h2 className="text-[15px] font-semibold text-sm-ink">
            {OBJECT_TITLES[selectedType] ?? 'Properties'}
          </h2>
          <button
            type="button"
            onClick={() => setSelectedId(null, null)}
            title="Close"
            className="rounded-lg border border-sm-border bg-sm-surface p-1.5 text-sm-ink3 hover:text-sm-ink2"
          >
            <X size={13} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {selectedType === 'polygon' && <PolygonInspector polygonId={selectedId} />}
          {selectedType === 'parking' && <ParkingInspector parkingBlockId={selectedId} />}
          {selectedType === 'cad' && <CadInspector cadImageId={selectedId} />}
        </div>
      </aside>
    )
  }

  return (
    <aside className="flex w-[320px] shrink-0 flex-col overflow-hidden border-l border-sm-border bg-sm-surface">
      <div className="border-b border-sm-border-soft px-[18px] py-[18px]">
        <Kicker>Active sketch</Kicker>
        <h2 className="mt-1 truncate text-[20px] font-semibold tracking-[-0.3px] text-sm-ink">
          {sketchName || 'Untitled sketch'}
        </h2>
      </div>

      {isEmpty ? (
        <div className="px-[18px] py-10 text-center text-[12.5px] leading-relaxed text-sm-ink3">
          Draw plots and parking to see scheme metrics here.
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="grid grid-cols-2 gap-2.5 p-[18px]">
            <Metric label="Plots" value={String(polygons.length)} />
            <Metric label="Plot area" value={areaLabel} />
            <Metric label="Parking" value={`${metrics.parkingSpaces} sp`} />
            <Metric label="CAD overlays" value={String(cadInstances.length)} />
          </div>

          <div className="border-y border-sm-border-soft bg-sm-bg px-[18px] py-2.5">
            <Kicker>Measurements</Kicker>
          </div>
          <div className="divide-y divide-sm-border-soft">
            <MeasureRow label="Perimeter" value={perimeterLabel} />
            <MeasureRow label="Footprint" value={areaLabel} />
            <MeasureRow label="Parking blocks" value={String(parkingBlocks.length)} />
          </div>
        </div>
      )}

      <div className="flex gap-2 border-t border-sm-border-soft p-[18px]">
        <button
          type="button"
          onClick={handleExportCSV}
          disabled={isEmpty}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-sm-border bg-sm-surface py-2 text-[12.5px] font-medium text-sm-ink2 transition-colors hover:bg-sm-bg disabled:opacity-40"
        >
          <Download size={13} /> CSV
        </button>
        <button
          type="button"
          onClick={handleExportJSON}
          disabled={isEmpty}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-sm-border bg-sm-surface py-2 text-[12.5px] font-medium text-sm-ink2 transition-colors hover:bg-sm-bg disabled:opacity-40"
        >
          <FileJson size={13} /> JSON
        </button>
      </div>
    </aside>
  )
}

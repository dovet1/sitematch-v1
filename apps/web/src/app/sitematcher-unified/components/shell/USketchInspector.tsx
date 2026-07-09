'use client'

import { X } from 'lucide-react'
import { useSketchStore } from '@/lib/sitesketcher-v2/state-manager'
import { PolygonInspector } from '../../../sitesketcher-v2/components/inspectors/PolygonInspector'
import { ParkingInspector } from '../../../sitesketcher-v2/components/inspectors/ParkingInspector'
import { CadInspector } from '../../../sitesketcher-v2/components/inspectors/CadInspector'

// Per-object editing inspector for the active sketch. Sits in the unified
// right rail while Sketch mode is active, shown only when an object is selected.
const OBJECT_TITLES: Record<string, string> = {
  polygon: 'Plot properties',
  parking: 'Parking block',
  cad: 'CAD overlay',
}

export function USketchInspector() {
  const selectedId = useSketchStore((s) => s.selectedId)
  const selectedType = useSketchStore((s) => s.selectedType)
  const setSelectedId = useSketchStore((s) => s.setSelectedId)

  // Only the per-object editing inspector remains; the scheme-level
  // "Active sketch" metrics panel was removed. Render nothing until an
  // object is selected.
  if (!selectedId || !selectedType) {
    return null
  }

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

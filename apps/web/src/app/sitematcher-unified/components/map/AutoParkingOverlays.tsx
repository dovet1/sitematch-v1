'use client'

import { useMemo } from 'react'
import { AlertTriangle } from 'lucide-react'
import { useSketchStore } from '@/lib/sitesketcher-v2/state-manager'
import { deriveAutoLayoutStale } from '@/lib/sitesketcher-v2/auto-parking/staleness'

/**
 * Small HTML overlays for the guided Auto parking flow that aren't map
 * layers: the "out of date" banner (state 06) shown whenever the plot was
 * reshaped outside the guided flow, and the selected-option / legend chrome
 * shown while comparing (state 04).
 */
export function AutoParkingOverlays() {
  const parkingMethod = useSketchStore((s) => s.parkingMethod)
  const phase = useSketchStore((s) => s.autoParkingDraft.phase)
  const autoLayouts = useSketchStore((s) => s.autoLayouts)
  const polygons = useSketchStore((s) => s.polygons)
  const cadInstances = useSketchStore((s) => s.cadInstances)
  const cadImages = useSketchStore((s) => s.cadImages)
  const savedCads = useSketchStore((s) => s.savedCads)
  const candidates = useSketchStore((s) => s.autoParkingCandidates)
  const selectedCandidateId = useSketchStore((s) => s.autoParkingSelectedCandidateId)

  // Out-of-date banner: only meaningful outside the guided flow itself (a
  // layout being actively edited/regenerated is never shown as stale).
  const staleBanner = useMemo(() => {
    if (parkingMethod === 'auto' && phase !== 'ready') return null
    for (const layout of autoLayouts) {
      const stale = deriveAutoLayoutStale(layout, { polygons, cadInstances, cadImages, savedCads })
      if (stale) {
        const boundaryPolygon = polygons.find((p) => p.id === layout.boundaryId)
        return `${boundaryPolygon?.name ?? 'The plot'} was reshaped — ${layout.name} is out of date`
      }
    }
    return null
  }, [parkingMethod, phase, autoLayouts, polygons, cadInstances, cadImages, savedCads])

  const comparing = parkingMethod === 'auto' && (phase === 'compare' || phase === 'editing')
  const selectedIndex = comparing ? candidates.findIndex((c) => c.candidateId === selectedCandidateId) : -1
  const selectedCandidate = selectedIndex >= 0 ? candidates[selectedIndex] : null

  return (
    <div className="pointer-events-none absolute inset-0 z-10">
      {staleBanner && (
        <div className="absolute left-1/2 top-4 -translate-x-1/2 rounded-full border border-[#F2E3CB] bg-[#FDF6EC] px-4 py-2 text-[12.5px] font-medium text-[#8A6318] shadow-[0_4px_12px_rgba(20,16,10,0.14)]">
          <span className="flex items-center gap-1.5">
            <AlertTriangle size={13} /> {staleBanner}
          </span>
        </div>
      )}

      {comparing && selectedCandidate && (
        <div className="absolute left-4 top-4 flex items-center gap-2 rounded-full bg-[#231F2B] px-4 py-2 text-[12.5px] font-medium text-white shadow-[0_4px_12px_rgba(20,16,10,0.14)]">
          <span>Option {selectedIndex + 1}</span>
          <span className="opacity-50">|</span>
          <span>{selectedCandidate.stallCount} spaces</span>
          <span className="rounded-full bg-white/15 px-2 py-0.5 font-mono text-[9.5px] uppercase tracking-wider">
            Concept
          </span>
        </div>
      )}

      {parkingMethod === 'auto' && (phase === 'entrance' || phase === 'entrance-edit') && (
        <div className="absolute left-4 top-4 flex items-center gap-2 rounded-full bg-[#231F2B] px-4 py-2 text-[12.5px] font-medium text-white shadow-[0_4px_12px_rgba(20,16,10,0.14)]">
          <span className="h-2 w-2 rounded-full bg-[#2FA37A]" />
          Placing entrance <span className="text-white/60">snaps to the nearest wall</span>
        </div>
      )}

      {comparing && candidates.length > 0 && (
        <div className="absolute bottom-4 left-4 rounded-xl bg-white/95 px-3.5 py-3 text-[11.5px] shadow-[0_4px_12px_rgba(20,16,10,0.14)]">
          <div className="mb-1.5 font-mono text-[9.5px] font-semibold uppercase tracking-wider text-sm-ink3">Legend</div>
          <div className="flex flex-col gap-1">
            <LegendRow swatch={<span className="h-2.5 w-3.5 rounded-[2px] border border-sm-violet bg-white" />} label="Parking bays" />
            <LegendRow swatch={<span className="h-2.5 w-3.5 rounded-[2px] bg-[#3B3742]" />} label="Circulation aisle" />
            <LegendRow swatch={<span className="h-2.5 w-3.5 rounded-[2px] border border-dashed border-sm-ink3 bg-[#26242A]" />} label="Building · avoided" />
            <LegendRow swatch={<span className="h-2.5 w-2.5 rounded-full bg-sm-violet" />} label="Vehicle access" />
            <LegendRow swatch={<span className="h-2.5 w-2.5 rounded-full bg-[#2FA37A]" />} label="Building entrance" />
          </div>
        </div>
      )}
    </div>
  )
}

function LegendRow({ swatch, label }: { swatch: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2">
      {swatch}
      <span className="text-sm-ink2">{label}</span>
    </div>
  )
}

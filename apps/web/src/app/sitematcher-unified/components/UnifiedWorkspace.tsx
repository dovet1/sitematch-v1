'use client'

import { useMemo } from 'react'
import { UChrome } from './shell/UChrome'
import { URail } from './shell/URail'
import { ULeftPanel } from './shell/ULeftPanel'
import { UInspector } from './shell/UInspector'
import { UnifiedMap } from './map/UnifiedMap'
import { useWorkspaceStore } from '../lib/stores/unified-workspace-store'
import { useReferenceData } from '../lib/hooks/useReferenceData'
import { useFindGaps } from '../lib/hooks/useFindGaps'
import { useAreaData } from '../lib/hooks/useAreaData'

// Radius used when reading the landscape around a selected built-up area
// (the Assess dropped-point radius comes from the store instead).
const BUA_RADIUS_KM = 5

export function UnifiedWorkspace() {
  const view = useWorkspaceStore((s) => s.view)
  const area = useWorkspaceStore((s) => s.area)
  const assessPoint = useWorkspaceStore((s) => s.assessPoint)
  const radiusKm = useWorkspaceStore((s) => s.radiusKm)

  const { data: refData } = useReferenceData()
  const findGaps = useFindGaps(view === 'find')

  // The landscape (nearby stores + missing brands) is read around whichever
  // point is active: a selected BUA's centroid or the Assess dropped pin.
  const center = useMemo(() => {
    if (area) return { lat: area.center[1], lon: area.center[0] }
    if (view === 'assess' && assessPoint)
      return { lat: assessPoint.lat, lon: assessPoint.lng }
    return null
  }, [area, view, assessPoint])

  const radiusMeters = (area ? BUA_RADIUS_KM : radiusKm) * 1000
  const landscape = useAreaData(center, radiusMeters)

  const showInspector =
    Boolean(area) || view === 'find' || (view === 'assess' && Boolean(assessPoint))

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-sm-bg">
      <UChrome />
      <div className="flex flex-1 overflow-hidden">
        <URail />
        <ULeftPanel refData={refData} />

        <main className="relative flex-1">
          <UnifiedMap storeDots={landscape.stores} />
        </main>

        {showInspector && (
          <UInspector
            findResults={findGaps.results}
            findTotal={findGaps.total}
            findLoading={findGaps.loading}
            findError={findGaps.error}
            landscape={landscape}
          />
        )}
      </div>
    </div>
  )
}

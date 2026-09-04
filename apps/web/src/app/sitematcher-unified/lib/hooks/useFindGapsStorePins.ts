'use client'

import { useEffect, useMemo, useState } from 'react'
import type mapboxgl from 'mapbox-gl'
import { useWorkspaceStore } from '../stores/unified-workspace-store'
import {
  fetchStoresInGapArea,
  fetchStoresInViewport,
  type NearbyStore,
} from '../services/gaps-service'

export type GapPinsStatus =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'empty'
  | 'zoom_gated'
  | 'truncated'

export interface GapStorePinsResult {
  pins: NearbyStore[]
  status: GapPinsStatus
}

// Below this zoom a broad category could match thousands of stores nationwide, so
// scenario 2 does not fetch — it asks the user to zoom in instead. Keeps every
// fetched set complete and honestly clusterable.
const MIN_PIN_ZOOM = 9

// The store pins shown on the find-gaps map, scoped to keep counts bounded:
//   1. A selected BUA -> every store inside its true polygon (regardless of rules).
//   2. Otherwise, in find view with brand/category rules -> those brands' stores in
//      the current viewport, refetched on pan/zoom (zoom-gated).
// Kept separate from the inspector's landscape.stores so the two never couple.
export function useFindGapsStorePins(map: mapboxgl.Map | null): GapStorePinsResult {
  const view = useWorkspaceStore((s) => s.view)
  const area = useWorkspaceStore((s) => s.area)
  const gapRules = useWorkspaceStore((s) => s.gapRules)

  const [result, setResult] = useState<GapStorePinsResult>({
    pins: [],
    status: 'idle',
  })

  // Brand/fascia rules resolve to fascia ids; category rules stay as category ids.
  const { fasciaIds, categoryIds } = useMemo(() => {
    const f = new Set<string>()
    const c = new Set<string>()
    for (const rule of gapRules) {
      if (rule.type === 'category') rule.targetIds.forEach((id) => c.add(id))
      else rule.targetIds.forEach((id) => f.add(id))
    }
    return { fasciaIds: Array.from(f), categoryIds: Array.from(c) }
  }, [gapRules])

  const hasRuleTargets = fasciaIds.length > 0 || categoryIds.length > 0

  const polygonAreaId = area?.kind === 'bua' || area?.kind === 'retail_centre'
    ? area.id
    : null
  const polygonGeography = area?.kind === 'bua'
    ? 'town' as const
    : area?.kind === 'retail_centre'
      ? 'retail_centre' as const
      : null

  useEffect(() => {
    // Scenario 1: a BUA is selected -> all stores in its polygon.
    if (polygonAreaId && polygonGeography) {
      const controller = new AbortController()
      setResult((r) => ({ pins: r.pins, status: 'loading' }))
      fetchStoresInGapArea(polygonGeography, polygonAreaId, controller.signal)
        .then((stores) =>
          setResult({ pins: stores, status: stores.length ? 'ready' : 'empty' })
        )
        .catch((err) => {
          if (controller.signal.aborted) return
          console.error('Find-gaps selected-area store pins error', err)
          setResult({ pins: [], status: 'empty' })
        })
      return () => controller.abort()
    }

    // Scenario 2: find overview with brand/category rules -> viewport pins.
    if (view !== 'find' || !hasRuleTargets || !map) {
      setResult({ pins: [], status: 'idle' })
      return
    }

    let controller: AbortController | null = null
    let timer: ReturnType<typeof setTimeout> | null = null

    const run = () => {
      if (map.getZoom() < MIN_PIN_ZOOM) {
        controller?.abort()
        setResult({ pins: [], status: 'zoom_gated' })
        return
      }
      const b = map.getBounds()
      if (!b) return
      const bbox: [number, number, number, number] = [
        b.getWest(),
        b.getSouth(),
        b.getEast(),
        b.getNorth(),
      ]
      controller?.abort()
      controller = new AbortController()
      const signal = controller.signal
      setResult((r) => ({ pins: r.pins, status: 'loading' }))
      fetchStoresInViewport(bbox, { fasciaIds, categoryIds }, signal)
        .then(({ stores, truncated }) =>
          setResult({
            pins: stores,
            status: truncated ? 'truncated' : stores.length ? 'ready' : 'empty',
          })
        )
        .catch((err) => {
          if (signal.aborted) return
          console.error('Find-gaps viewport store pins error', err)
          setResult({ pins: [], status: 'empty' })
        })
    }

    const onMove = () => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(run, 300)
    }

    run()
    map.on('moveend', onMove)
    return () => {
      map.off('moveend', onMove)
      if (timer) clearTimeout(timer)
      controller?.abort()
    }
  }, [polygonAreaId, polygonGeography, view, hasRuleTargets, map, fasciaIds, categoryIds])

  return result
}

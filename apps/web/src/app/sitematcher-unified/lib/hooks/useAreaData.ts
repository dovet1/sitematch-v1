'use client'

import { useEffect, useRef, useState } from 'react'
import {
  fetchNearbyStores,
  fetchMissingFascias,
  type NearbyStore,
} from '../services/gaps-service'
import type { MissingFascia } from '../../types/unified-workspace'
import { boundingRadiusMeters, pointInGeometry } from '../geo'

// The store/missing endpoints cap radius at 20km.
const MAX_FETCH_RADIUS_M = 20000

export interface Landscape {
  // Stores inside the catchment (polygon-filtered for drive/walk, else the fetched set).
  stores: NearbyStore[]
  // The full fetched set (bounding-circle for drive/walk) — lets the caller find
  // brands present in the ring but outside the isochrone.
  allStores: NearbyStore[]
  // Server missing-fascias for the fetched radius (bounding-circle for drive/walk).
  missing: MissingFascia[]
  loading: boolean
}

// Fetches the "landscape" around a point: stores trading nearby (map dots +
// present brands) and brands with no presence (the gap). Used by both Assess
// (dropped pin) and Find (a selected BUA's centroid).
//
// When `isochrone` is supplied (drive/walk catchment), stores are fetched with a
// bounding-circle radius then filtered to the polygon; `allStores` keeps the
// unfiltered ring so the caller can union in ring-only brands as missing.
export function useAreaData(
  center: { lat: number; lon: number } | null,
  radiusMeters: number,
  isochrone?: GeoJSON.Geometry | null
): Landscape {
  const [stores, setStores] = useState<NearbyStore[]>([])
  const [allStores, setAllStores] = useState<NearbyStore[]>([])
  const [missing, setMissing] = useState<MissingFascia[]>([])
  const [loading, setLoading] = useState(false)
  const reqId = useRef(0)

  // Stable signature so a fresh-but-equal isochrone object doesn't re-trigger.
  const isochroneKey = isochrone ? JSON.stringify(isochrone) : null

  useEffect(() => {
    if (!center) {
      setStores([])
      setAllStores([])
      setMissing([])
      return
    }
    const id = ++reqId.current
    setLoading(true)
    const controller = new AbortController()

    // The store/missing RPCs type p_radius_m as INTEGER, so a fractional radius
    // (from the isochrone bounding circle) fails PostgREST's overload match → 500.
    // Round to whole metres. `radiusMeters` from the km path is already integral.
    const fetchRadius = Math.round(
      isochrone
        ? Math.min(
            boundingRadiusMeters(center.lat, center.lon, isochrone),
            MAX_FETCH_RADIUS_M
          )
        : radiusMeters
    )

    Promise.all([
      fetchNearbyStores(center.lat, center.lon, fetchRadius, controller.signal),
      fetchMissingFascias(center.lat, center.lon, fetchRadius, controller.signal),
    ])
      .then(([s, m]) => {
        if (id !== reqId.current) return
        const filtered = isochrone
          ? s.filter((st) => pointInGeometry(st.lon, st.lat, isochrone))
          : s
        setStores(filtered)
        setAllStores(s)
        setMissing(m)
      })
      .catch((err) => {
        if (err?.name !== 'AbortError') console.error('Area data error', err)
      })
      .finally(() => {
        if (id === reqId.current) setLoading(false)
      })
    return () => controller.abort()
    // isochroneKey captures isochrone changes; center/radius are primitives.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [center?.lat, center?.lon, radiusMeters, isochroneKey])

  return { stores, allStores, missing, loading }
}

'use client'

import { useEffect, useRef, useState } from 'react'
import {
  fetchNearbyStores,
  fetchMissingFascias,
  type NearbyStore,
} from '../services/gaps-service'
import type { MissingFascia } from '../../types/unified-workspace'

// Fetches the "landscape" around a point: stores trading nearby (map dots +
// present brands) and brands with no presence (the gap). Used by both Assess
// (dropped pin) and Find (a selected BUA's centroid).
export function useAreaData(
  center: { lat: number; lon: number } | null,
  radiusMeters: number
) {
  const [stores, setStores] = useState<NearbyStore[]>([])
  const [missing, setMissing] = useState<MissingFascia[]>([])
  const [loading, setLoading] = useState(false)
  const reqId = useRef(0)

  useEffect(() => {
    if (!center) {
      setStores([])
      setMissing([])
      return
    }
    const id = ++reqId.current
    setLoading(true)
    const controller = new AbortController()
    Promise.all([
      fetchNearbyStores(center.lat, center.lon, radiusMeters, controller.signal),
      fetchMissingFascias(center.lat, center.lon, radiusMeters, controller.signal),
    ])
      .then(([s, m]) => {
        if (id !== reqId.current) return
        setStores(s)
        setMissing(m)
      })
      .catch((err) => {
        if (err?.name !== 'AbortError') console.error('Area data error', err)
      })
      .finally(() => {
        if (id === reqId.current) setLoading(false)
      })
    return () => controller.abort()
  }, [center?.lat, center?.lon, radiusMeters])

  return { stores, missing, loading }
}

'use client'

import { useEffect, useState } from 'react'
import { fetchRetailCentreBoundary } from '../services/gaps-service'

export function useRetailCentreBoundary(rcId: string | null) {
  const [geometry, setGeometry] = useState<GeoJSON.Geometry | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setGeometry(null)
    setError(null)
    if (!rcId) {
      setLoading(false)
      return
    }
    const controller = new AbortController()
    setLoading(true)
    fetchRetailCentreBoundary(rcId, controller.signal)
      .then(setGeometry)
      .catch((err) => {
        if (controller.signal.aborted) return
        setError(err instanceof Error ? err.message : 'Failed to load retail-centre boundary')
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [rcId])

  return { geometry, loading, error }
}

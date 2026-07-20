'use client'

import { useEffect, useRef, useState } from 'react'
import { fetchPlanningApplications } from '../services/planning-service'
import type { PlanningApplication } from '../../types/unified-workspace'
import { pointInGeometry } from '../geo'

export interface PlanningData {
  applications: PlanningApplication[]
  loading: boolean
  error: string | null
  truncated: boolean
}

// Planning applications inside the active boundary (BUA polygon, radius circle
// or isochrone). Fetches lazily — only while `enabled` (the Planning tab is
// open). While enabled with no boundary yet (a BUA polygon still resolving),
// `loading` stays true so the tab shows a spinner rather than a false-empty.
export function usePlanningData(
  boundary: GeoJSON.Geometry | null,
  enabled: boolean
): PlanningData {
  const [applications, setApplications] = useState<PlanningApplication[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [truncated, setTruncated] = useState(false)
  const reqId = useRef(0)

  // Stable signature so a fresh-but-equal boundary object doesn't re-trigger.
  const boundaryKey = boundary ? JSON.stringify(boundary) : null

  useEffect(() => {
    if (!enabled || !boundary) {
      reqId.current++
      setApplications([])
      setError(null)
      setTruncated(false)
      setLoading(false)
      return
    }
    const id = ++reqId.current
    setLoading(true)
    setError(null)
    const controller = new AbortController()

    fetchPlanningApplications(boundary, controller.signal)
      .then(({ applications: apps, truncated: wasTruncated }) => {
        if (id !== reqId.current) return
        // The server already filters to the boundary; re-filter as a cheap
        // belt-and-braces guard so a pin can never render outside the outline.
        setApplications(
          apps.filter((app) => pointInGeometry(app.lng, app.lat, boundary))
        )
        setTruncated(wasTruncated)
      })
      .catch((err) => {
        if (err?.name === 'AbortError') return
        if (id !== reqId.current) return
        setError(err instanceof Error ? err.message : 'Planning data failed')
      })
      .finally(() => {
        if (id === reqId.current) setLoading(false)
      })
    return () => controller.abort()
    // boundaryKey captures boundary changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, boundaryKey])

  return {
    applications,
    // Enabled with no boundary yet = still resolving upstream (BUA polygon).
    loading: loading || (enabled && !boundary),
    error,
    truncated,
  }
}

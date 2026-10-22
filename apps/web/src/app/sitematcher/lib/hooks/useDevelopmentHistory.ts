'use client'

import { useEffect, useState } from 'react'
import type { PlanningApplication } from '../../types/unified-workspace'

// A development's history changes rarely within a session, so each is fetched once.
const cache = new Map<string, PlanningApplication[]>()

/**
 * Every application in a development, fetched when its timeline opens. Null until it arrives or if
 * it fails; the timeline then shows the applications the tab already listed.
 */
export function useDevelopmentHistory(developmentId: string | null, enabled: boolean): PlanningApplication[] | null {
  const [history, setHistory] = useState<PlanningApplication[] | null>(() =>
    developmentId ? cache.get(developmentId) ?? null : null
  )
  useEffect(() => {
    if (!enabled || !developmentId) return
    const cached = cache.get(developmentId)
    if (cached) { setHistory(cached); return }
    const controller = new AbortController()
    fetch(`/api/public/planning/development?developmentId=${encodeURIComponent(developmentId)}`, { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : null))
      .then((body: { applications?: PlanningApplication[] } | null) => {
        if (!body?.applications) return
        cache.set(developmentId, body.applications)
        setHistory(body.applications)
      })
      .catch(() => {})
    return () => controller.abort()
  }, [developmentId, enabled])
  return history
}

'use client'

import { useEffect, useRef, useState } from 'react'
import { useWorkspaceStore } from '../stores/unified-workspace-store'
import { findGaps, filterGssCodes } from '../services/gaps-service'
import type { GapResult } from '../../types/unified-workspace'

// Runs the Find-Gaps query (debounced) whenever the rules or population change,
// pushing matching gsscodes into the store for the map and returning the ranked
// list for the inspector. Only fetches while `enabled`.
export function useFindGaps(enabled: boolean) {
  const gapRules = useWorkspaceStore((s) => s.gapRules)
  const populationRange = useWorkspaceStore((s) => s.populationRange)
  const showSubFiveK = useWorkspaceStore((s) => s.showSubFiveK)
  const gapGeography = useWorkspaceStore((s) => s.gapGeography)
  const retailForms = useWorkspaceStore((s) => s.retailForms)
  const retailClassifications = useWorkspaceStore((s) => s.retailClassifications)
  const setGapAreaIds = useWorkspaceStore((s) => s.setGapAreaIds)

  const [results, setResults] = useState<GapResult[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const reqId = useRef(0)

  useEffect(() => {
    if (!enabled) return
    // No buckets ⇒ no query: clear results and the map's gsscode filter so the
    // national view shows zero highlighted towns until a filter is added.
    if (gapRules.length === 0) {
      reqId.current++
      setResults([])
      setTotal(0)
      setGapAreaIds(null)
      setLoading(false)
      setError(null)
      return
    }
    const id = ++reqId.current
    setLoading(true)
    setError(null)
    const effRange: [number, number] = [
      showSubFiveK ? 0 : populationRange[0],
      populationRange[1],
    ]
    const timer = setTimeout(async () => {
      try {
        const options = {
          geography: gapGeography,
          populationRange: effRange,
          retailForms,
          retailClassifications,
        }
        // Town mode keeps its existing parallel map-ID request. Retail mode's
        // find response already carries every matching RC_ID, so it avoids the
        // duplicate filter request entirely.
        const [find, codes] = gapGeography === 'town'
          ? await Promise.all([
              findGaps(gapRules, options),
              filterGssCodes(gapRules, effRange),
            ])
          : await findGaps(gapRules, options).then((response) => [
              response,
              response.matchingIds ?? [],
            ] as const)
        if (id !== reqId.current) return
        setResults(find.results)
        setTotal(find.total)
        setGapAreaIds(codes)
      } catch (err) {
        if (id !== reqId.current) return
        console.error('Find gaps error', err)
        setError(err instanceof Error ? err.message : 'Failed to load gaps')
      } finally {
        if (id === reqId.current) setLoading(false)
      }
    }, 400)
    return () => clearTimeout(timer)
  }, [
    enabled,
    gapRules,
    populationRange,
    showSubFiveK,
    gapGeography,
    retailForms,
    retailClassifications,
    setGapAreaIds,
  ])

  return { results, total, loading, error }
}

'use client'

import { useEffect, useRef, useState } from 'react'
import { useWorkspaceStore } from '../stores/unified-workspace-store'
import { findGaps, filterGssCodes } from '../services/gaps-service'
import type { BUAResult } from '../../types/unified-workspace'

// Runs the Find-Gaps query (debounced) whenever the rules or population change,
// pushing matching gsscodes into the store for the map and returning the ranked
// list for the inspector. Only fetches while `enabled`.
export function useFindGaps(enabled: boolean) {
  const gapRules = useWorkspaceStore((s) => s.gapRules)
  const populationRange = useWorkspaceStore((s) => s.populationRange)
  const setGapGssCodes = useWorkspaceStore((s) => s.setGapGssCodes)

  const [results, setResults] = useState<BUAResult[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const reqId = useRef(0)

  useEffect(() => {
    if (!enabled) return
    const id = ++reqId.current
    setLoading(true)
    setError(null)
    const timer = setTimeout(async () => {
      try {
        const [find, codes] = await Promise.all([
          findGaps(gapRules, populationRange),
          filterGssCodes(gapRules, populationRange),
        ])
        if (id !== reqId.current) return
        setResults(find.results)
        setTotal(find.total)
        setGapGssCodes(codes)
      } catch (err) {
        if (id !== reqId.current) return
        console.error('Find gaps error', err)
        setError(err instanceof Error ? err.message : 'Failed to load gaps')
      } finally {
        if (id === reqId.current) setLoading(false)
      }
    }, 400)
    return () => clearTimeout(timer)
  }, [enabled, gapRules, populationRange, setGapGssCodes])

  return { results, total, loading, error }
}

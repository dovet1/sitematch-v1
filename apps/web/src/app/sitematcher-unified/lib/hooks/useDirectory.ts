'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  fetchDirectoryAgentProfile,
  fetchDirectoryAgents,
  fetchDirectoryBrandProfile,
  fetchDirectoryBrands,
  fetchDirectoryInHouse,
} from '../services/directory-service'
import type {
  DirectoryAgentProfile,
  DirectoryAgentSummary,
  DirectoryBrandCard,
  DirectoryBrandProfile,
  DirectoryTeamMember,
} from '../../types/unified-workspace'

// Monotonic request-id + AbortController, matching useAreaData / useFindGaps. The id guard
// matters as much as the abort: an aborted fetch can still resolve, and without the guard a
// slow first response can overwrite a fast second one.
function useRequestGuard() {
  const reqId = useRef(0)
  return {
    next: () => ++reqId.current,
    isCurrent: (id: number) => id === reqId.current,
  }
}

// The three grid tabs. Loaded once on mount and filtered client-side — each endpoint is
// capped and reports `truncated`, which the view surfaces rather than silently hiding.
export function useDirectoryLists() {
  const [brands, setBrands] = useState<DirectoryBrandCard[]>([])
  const [agents, setAgents] = useState<DirectoryAgentSummary[]>([])
  const [inHouse, setInHouse] = useState<DirectoryTeamMember[]>([])
  const [truncated, setTruncated] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    let active = true

    setLoading(true)
    setError(null)

    Promise.all([
      fetchDirectoryBrands(controller.signal),
      fetchDirectoryAgents(controller.signal),
      fetchDirectoryInHouse(controller.signal),
    ])
      .then(([b, a, i]) => {
        if (!active) return
        setBrands(b.items)
        setAgents(a.items)
        setInHouse(i.items)
        setTruncated(b.truncated || a.truncated || i.truncated)
      })
      .catch((e: unknown) => {
        if (!active || (e instanceof DOMException && e.name === 'AbortError')) return
        setError(e instanceof Error ? e.message : 'Failed to load directory')
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
      controller.abort()
    }
  }, [])

  return { brands, agents, inHouse, truncated, loading, error }
}

// Brand / agent profiles, keyed on the nav stack's current node.
export function useDirectoryProfile(node: { kind: 'brand' | 'agent'; id: string } | null) {
  const [brandProfile, setBrandProfile] = useState<DirectoryBrandProfile | null>(null)
  const [agentProfile, setAgentProfile] = useState<DirectoryAgentProfile | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const guard = useRequestGuard()

  const kind = node?.kind ?? null
  const id = node?.id ?? null

  useEffect(() => {
    if (!kind || !id) {
      setBrandProfile(null)
      setAgentProfile(null)
      setError(null)
      return
    }

    const controller = new AbortController()
    const reqId = guard.next()
    setLoading(true)
    setError(null)

    const run =
      kind === 'brand'
        ? fetchDirectoryBrandProfile(id, controller.signal).then((p) => {
            if (!guard.isCurrent(reqId)) return
            setBrandProfile(p)
            setAgentProfile(null)
          })
        : fetchDirectoryAgentProfile(id, controller.signal).then((p) => {
            if (!guard.isCurrent(reqId)) return
            setAgentProfile(p)
            setBrandProfile(null)
          })

    run
      .catch((e: unknown) => {
        if (!guard.isCurrent(reqId) || (e instanceof DOMException && e.name === 'AbortError')) return
        setError(e instanceof Error ? e.message : 'Failed to load profile')
      })
      .finally(() => {
        if (guard.isCurrent(reqId)) setLoading(false)
      })

    return () => controller.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, id])

  const clear = useCallback(() => {
    setBrandProfile(null)
    setAgentProfile(null)
  }, [])

  return { brandProfile, agentProfile, loading, error, clear }
}

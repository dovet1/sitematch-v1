'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { fetchRequirementLocations } from '../services/requirements-service'
import { haversineMeters } from '../geo'
import type { RequirementLocation } from '../../types/unified-workspace'

export interface Requirements {
  // All requirement locations (map overlay).
  all: RequirementLocation[]
  // Requirements whose target location falls within the active radius, deduped
  // by listing (nearest location per listing). Powers the Summary promoted rows.
  local: RequirementLocation[]
  // Case-insensitive companyName match — the brand modal's live-requirement block.
  findByBrand: (name: string) => RequirementLocation | undefined
  loading: boolean
}

// Requirement locations are not viewport-scoped, so fetch the whole set once
// and derive proximity client-side. v1 classifies "local" by radius circle even
// under a drive/walk isochrone — good enough for the promoted list.
export function useRequirements(
  center: { lat: number; lon: number } | null,
  radiusKm: number
): Requirements {
  const [all, setAll] = useState<RequirementLocation[]>([])
  const [loading, setLoading] = useState(false)

  // Fetch the whole (non-viewport-scoped) requirement set once. No ref guard:
  // under React StrictMode the effect mounts/aborts/remounts, and a persistent
  // guard would skip the remount's fetch after the first was aborted — leaving
  // `all` permanently empty. The AbortController handles the double-invoke.
  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    fetchRequirementLocations(controller.signal)
      .then(setAll)
      .catch((err) => {
        if (err?.name !== 'AbortError') console.error('Requirements error', err)
      })
      .finally(() => setLoading(false))
    return () => controller.abort()
  }, [])

  const local = useMemo(() => {
    if (!center) return []
    const radiusM = radiusKm * 1000
    const nearestByListing = new Map<
      string,
      { req: RequirementLocation; dist: number }
    >()
    for (const req of all) {
      const dist = haversineMeters(
        center.lat,
        center.lon,
        req.coordinates.lat,
        req.coordinates.lng
      )
      if (dist > radiusM) continue
      const existing = nearestByListing.get(req.listingId)
      if (!existing || dist < existing.dist) {
        nearestByListing.set(req.listingId, { req, dist })
      }
    }
    return Array.from(nearestByListing.values())
      .sort((a, b) => a.dist - b.dist)
      .map((e) => e.req)
  }, [all, center?.lat, center?.lon, radiusKm])

  const findByBrand = useCallback(
    (name: string) => {
      const target = name.trim().toLowerCase()
      return all.find((r) => r.companyName.trim().toLowerCase() === target)
    },
    [all]
  )

  return { all, local, findByBrand, loading }
}

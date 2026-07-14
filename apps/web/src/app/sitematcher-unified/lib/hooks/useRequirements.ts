'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { fetchRequirementLocations } from '../services/requirements-service'
import { haversineMeters, isInCatchment } from '../geo'
import type { RequirementLocation } from '../../types/unified-workspace'

export interface Requirements {
  // Requirement locations inside the active catchment (isochrone polygon for
  // drive/walk, radius circle for distance), non-deduped — the map overlay
  // renders each site pin individually.
  withinCatchment: RequirementLocation[]
  // The deduped-per-listing counterpart (nearest location per listing) of
  // withinCatchment. Powers the Summary promoted rows.
  local: RequirementLocation[]
  // brand_id match over the *whole UK* set — the brand modal's "is any occupier
  // after this brand anywhere?" resolution. Matching on brand_id (not company_name)
  // avoids misses when a requirement's company_name differs from brands.name and
  // false-matches between same-named brands. The set is already free-tier gated
  // (it comes from /api/public/requirements/map), so a free user only ever resolves
  // requirements they're allowed to see. Intentionally NOT scoped to the catchment.
  findActiveRequirementByBrandId: (
    brandId: string | null | undefined
  ) => RequirementLocation | undefined
  loading: boolean
}

// Requirement locations are not viewport-scoped, so fetch the whole set once
// and derive catchment membership client-side. Membership uses the drive/walk
// isochrone when supplied, else a straight-line radius circle.
export function useRequirements(
  center: { lat: number; lon: number } | null,
  radiusKm: number,
  isochrone?: GeoJSON.Geometry | null
): Requirements {
  const [all, setAll] = useState<RequirementLocation[]>([])
  const [loading, setLoading] = useState(false)

  // Stable signature so a fresh-but-equal isochrone object doesn't re-trigger.
  const isochroneKey = isochrone ? JSON.stringify(isochrone) : null

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

  // Every location inside the catchment (non-deduped) — the map overlay.
  const withinCatchment = useMemo(() => {
    if (!center) return []
    return all.filter((req) =>
      isInCatchment(
        center,
        req.coordinates.lng,
        req.coordinates.lat,
        radiusKm,
        isochrone ?? null
      )
    )
    // isochroneKey captures isochrone changes; center/radius are primitives.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [all, center?.lat, center?.lon, radiusKm, isochroneKey])

  const local = useMemo(() => {
    if (!center) return []
    const nearestByListing = new Map<
      string,
      { req: RequirementLocation; dist: number }
    >()
    for (const req of all) {
      if (
        !isInCatchment(
          center,
          req.coordinates.lng,
          req.coordinates.lat,
          radiusKm,
          isochrone ?? null
        )
      )
        continue
      // Straight-line distance is fine for nearest-per-listing ordering.
      const dist = haversineMeters(
        center.lat,
        center.lon,
        req.coordinates.lat,
        req.coordinates.lng
      )
      const existing = nearestByListing.get(req.requirementId)
      if (!existing || dist < existing.dist) {
        nearestByListing.set(req.requirementId, { req, dist })
      }
    }
    return Array.from(nearestByListing.values())
      .sort((a, b) => a.dist - b.dist)
      .map((e) => e.req)
    // isochroneKey captures isochrone changes; center/radius are primitives.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [all, center?.lat, center?.lon, radiusKm, isochroneKey])

  const findActiveRequirementByBrandId = useCallback(
    (brandId: string | null | undefined) => {
      if (!brandId) return undefined
      return all.find((r) => r.brandId === brandId)
    },
    [all]
  )

  return { withinCatchment, local, findActiveRequirementByBrandId, loading }
}

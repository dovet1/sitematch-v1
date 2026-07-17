'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  fetchNearbyStores,
  fetchMissingFascias,
  type NearbyStore,
} from '../services/gaps-service'
import { buildBrandLandscape } from '../brand-landscape'
import { computeIsochroneMissing } from '../isochrone-missing'
import { boundingRadiusMeters, pointInGeometry, circleGeometry } from '../geo'
import { toDemographicsRequest } from '../catchment-request'
import { computeBrandDiff, computeStatDeltas } from '../point-comparison'
import type {
  ComparePair,
  ComparePoint,
  ComparePointResult,
  CompareStatRow,
  ReferenceData,
  MissingFascia,
} from '../../types/unified-workspace'

// The store/missing endpoints cap radius at 20km.
const MAX_FETCH_RADIUS_M = 20000

// Per-pin catchment outlines for the map (circle for distance, isochrone blob
// for drive/walk). Decoupled from the heavy comparison result so an outline can
// render as soon as its boundary resolves, even if later fetches fail.
export interface CompareBoundaries {
  a: GeoJSON.Geometry | null
  b: GeoJSON.Geometry | null
}

export interface PointComparison {
  loading: boolean
  error: string | null
  retry: () => void
  a: ComparePointResult | null
  b: ComparePointResult | null
  onlyA: ComparePointResult['present']
  onlyB: ComparePointResult['present']
  missingBoth: ComparePointResult['missing']
  bothCount: number
  statRows: CompareStatRow[]
  // Live per-pin catchment outlines (independent of loading/error above).
  boundaries: CompareBoundaries
}

const EMPTY: Pick<
  PointComparison,
  'a' | 'b' | 'onlyA' | 'onlyB' | 'missingBoth' | 'bothCount' | 'statRows'
> = {
  a: null,
  b: null,
  onlyA: [],
  onlyB: [],
  missingBoth: [],
  bothCount: 0,
  statRows: [],
}

const EMPTY_BOUNDARIES: CompareBoundaries = { a: null, b: null }

// One pin's resolved catchment: the LSOA codes + isochrone used for filtering,
// plus the display geometry drawn on the map.
interface PointBoundary {
  lsoaCodes: string[]
  isochrone: GeoJSON.Geometry | null
  boundary: GeoJSON.Geometry | null
}

async function fetchAggregatedStats(
  lsoaCodes: string[],
  signal: AbortSignal
): Promise<ComparePointResult['stats']> {
  if (lsoaCodes.length === 0)
    return { population: null, households: null, affluence: null }
  const res = await fetch('/api/demographics/data', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ geography_codes: lsoaCodes }),
    signal,
  })
  if (!res.ok) throw new Error(`demographics data failed (${res.status})`)
  const data = await res.json()
  const agg = data?.by_lsoa?.aggregated ?? {}
  return {
    population: agg.population_total ?? null,
    households: agg.households_total ?? null,
    affluence: agg.affluence?.avg_raw_score ?? null,
  }
}

// Step 1 — resolve the pin's catchment (same route as single-point Assess) and
// derive the display geometry. Kept separate so the map outline can render the
// moment this resolves, before the heavier landscape/stats fetches run.
async function fetchPointBoundary(
  point: ComparePoint,
  signal: AbortSignal
): Promise<PointBoundary> {
  const catchment = point.catchment
  const boundariesRes = await fetch('/api/demographics/boundaries', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      lat: point.lat,
      lng: point.lng,
      ...toDemographicsRequest(catchment),
      place_name: 'Dropped point',
    }),
    signal,
  })
  if (!boundariesRes.ok)
    throw new Error(`demographics boundaries failed (${boundariesRes.status})`)
  const boundaries = await boundariesRes.json()
  const lsoaCodes: string[] = boundaries.lsoa_codes ?? []
  const isochrone: GeoJSON.Geometry | null =
    catchment.mode === 'distance' ? null : boundaries.isochrone_geometry ?? null
  // Distance mode has no server polygon — draw a client circle instead.
  const boundary: GeoJSON.Geometry | null =
    catchment.mode === 'distance'
      ? circleGeometry(point.lng, point.lat, catchment.value)
      : isochrone
  return { lsoaCodes, isochrone, boundary }
}

// Step 2 — the landscape (stores + missing brands) and demographics for one pin,
// given its already-resolved boundary.
async function fetchPointData(
  point: ComparePoint,
  resolved: PointBoundary,
  refData: ReferenceData,
  signal: AbortSignal
): Promise<ComparePointResult> {
  const { lsoaCodes, isochrone } = resolved

  // Isochrone modes fetch a bounding circle then filter to the polygon; the RPC
  // radius must be a whole number of metres.
  const fetchRadius = Math.round(
    isochrone
      ? Math.min(
          boundingRadiusMeters(point.lat, point.lng, isochrone),
          MAX_FETCH_RADIUS_M
        )
      : point.catchment.value * 1000
  )

  const [allStores, serverMissing] = await Promise.all([
    fetchNearbyStores(point.lat, point.lng, fetchRadius, signal),
    fetchMissingFascias(point.lat, point.lng, fetchRadius, signal),
  ])

  const stores: NearbyStore[] = isochrone
    ? allStores.filter((s) => pointInGeometry(s.lon, s.lat, isochrone))
    : allStores
  const missingFascias: MissingFascia[] = isochrone
    ? computeIsochroneMissing(stores, allStores, serverMissing, refData)
    : serverMissing

  const { present } = buildBrandLandscape(stores, [], refData)
  const { missing } = buildBrandLandscape(stores, missingFascias, refData)

  const stats = await fetchAggregatedStats(lsoaCodes, signal)

  return { present, missing, stats }
}

// Fetches and diffs the retail/demographics landscape for both compared points,
// each using its own catchment. Fetches whenever a pair exists (covers the modal
// and the persistent tray). Per-pin catchment outlines are published separately
// (via `boundaries`) as soon as each boundary resolves.
export function usePointComparison(
  pair: ComparePair | null,
  refData: ReferenceData | null
): PointComparison {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState(EMPTY)
  const [boundaries, setBoundaries] = useState<CompareBoundaries>(EMPTY_BOUNDARIES)
  const [retryNonce, setRetryNonce] = useState(0)
  const reqId = useRef(0)

  const retry = useCallback(() => setRetryNonce((n) => n + 1), [])

  // Key on coordinates AND each pin's catchment so editing either pin re-fetches.
  const armKey = (p: ComparePoint) =>
    `${p.lat.toFixed(5)},${p.lng.toFixed(5)}:${p.catchment.mode}:${p.catchment.value}`
  const pairKey = pair ? `${armKey(pair.a)}|${armKey(pair.b)}` : null

  useEffect(() => {
    if (!pair || !refData) {
      setLoading(false)
      setError(null)
      setResult(EMPTY)
      setBoundaries(EMPTY_BOUNDARIES)
      return
    }

    const id = ++reqId.current
    const controller = new AbortController()
    // A changed pair/catchment invalidates any previous comparison immediately.
    setLoading(true)
    setError(null)
    setResult(EMPTY)
    setBoundaries(EMPTY_BOUNDARIES)

    // One pin: resolve its boundary (publishing the outline right away, guarded
    // against stale/aborted responses), then fetch its landscape + stats.
    const fetchArm = async (
      point: ComparePoint,
      arm: 'a' | 'b'
    ): Promise<ComparePointResult> => {
      const resolved = await fetchPointBoundary(point, controller.signal)
      if (id === reqId.current)
        setBoundaries((prev) => ({ ...prev, [arm]: resolved.boundary }))
      return fetchPointData(point, resolved, refData, controller.signal)
    }

    Promise.all([fetchArm(pair.a, 'a'), fetchArm(pair.b, 'b')])
      .then(([a, b]) => {
        if (id !== reqId.current) return
        const diff = computeBrandDiff(a.present, b.present, a.missing, b.missing)
        setResult({
          a,
          b,
          onlyA: diff.onlyA,
          onlyB: diff.onlyB,
          missingBoth: diff.missingBoth,
          bothCount: diff.bothCount,
          statRows: computeStatDeltas(a, b),
        })
        setLoading(false)
      })
      .catch((err) => {
        if (err?.name === 'AbortError' || id !== reqId.current) return
        console.error('Point comparison error', err)
        setError(err?.message ?? 'Failed to build the comparison')
        setResult(EMPTY)
        setLoading(false)
      })

    return () => controller.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pairKey, retryNonce, refData])

  return { loading, error, retry, ...result, boundaries }
}

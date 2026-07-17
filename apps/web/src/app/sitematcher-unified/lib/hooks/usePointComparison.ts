'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  fetchNearbyStores,
  fetchMissingFascias,
  type NearbyStore,
} from '../services/gaps-service'
import { buildBrandLandscape } from '../brand-landscape'
import { computeIsochroneMissing } from '../isochrone-missing'
import { boundingRadiusMeters, pointInGeometry } from '../geo'
import { toDemographicsRequest } from '../catchment-request'
import { computeBrandDiff, computeStatDeltas } from '../point-comparison'
import type {
  CatchmentDefinition,
  ComparePair,
  ComparePoint,
  ComparePointResult,
  CompareStatRow,
  ReferenceData,
  MissingFascia,
} from '../../types/unified-workspace'

// The store/missing endpoints cap radius at 20km.
const MAX_FETCH_RADIUS_M = 20000

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

async function fetchPointData(
  point: ComparePoint,
  catchment: CatchmentDefinition,
  refData: ReferenceData,
  signal: AbortSignal
): Promise<ComparePointResult> {
  // 1) Resolve the catchment exactly like single-point Assess (same route).
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

  // 2) Fetch the store landscape. Isochrone modes fetch a bounding circle then
  //    filter to the polygon; the RPC radius must be a whole number of metres.
  const fetchRadius = Math.round(
    isochrone
      ? Math.min(
          boundingRadiusMeters(point.lat, point.lng, isochrone),
          MAX_FETCH_RADIUS_M
        )
      : catchment.value * 1000
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

  // 3) Aggregated demographics for the resolved LSOAs.
  const stats = await fetchAggregatedStats(lsoaCodes, signal)

  return { present, missing, stats }
}

// Fetches and diffs the retail/demographics landscape for both compared points.
// Fetches whenever a pair exists (covers the modal and the persistent tray).
export function usePointComparison(
  pair: ComparePair | null,
  catchment: CatchmentDefinition,
  refData: ReferenceData | null
): PointComparison {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState(EMPTY)
  const [retryNonce, setRetryNonce] = useState(0)
  const reqId = useRef(0)

  const retry = useCallback(() => setRetryNonce((n) => n + 1), [])

  const pairKey = pair
    ? `${pair.a.lat.toFixed(5)},${pair.a.lng.toFixed(5)}|${pair.b.lat.toFixed(
        5
      )},${pair.b.lng.toFixed(5)}`
    : null
  const catchmentKey = `${catchment.mode}:${catchment.value}`

  useEffect(() => {
    if (!pair || !refData) {
      setLoading(false)
      setError(null)
      setResult(EMPTY)
      return
    }

    const id = ++reqId.current
    const controller = new AbortController()
    // A changed pair invalidates any previous comparison immediately.
    setLoading(true)
    setError(null)
    setResult(EMPTY)

    Promise.all([
      fetchPointData(pair.a, catchment, refData, controller.signal),
      fetchPointData(pair.b, catchment, refData, controller.signal),
    ])
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
  }, [pairKey, catchmentKey, retryNonce, refData])

  return { loading, error, retry, ...result }
}

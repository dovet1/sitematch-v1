// Client-side fetch wrappers over the GapFinder / stores endpoints. These
// centralize error handling and map the workspace rule/geography state to the
// server contracts.

import type {
  BUAResult,
  GapGeography,
  GapRule,
  ReferenceData,
  RetailCentreForm,
  RetailCentreResult,
  MissingFascia,
} from '../../types/unified-workspace'

export const MIN_POPULATION = 5001
export const MAX_POPULATION = 1200000

interface ApiRule {
  id: string
  operator: 'has' | 'has_not' | 'has_within' | 'has_not_within'
  targetType: 'fascia' | 'category'
  targetIds: string[]
  distance?: number
  matchingLogic: 'any' | 'all'
  connector: 'and' | 'or'
}

function operatorFor(rule: GapRule): ApiRule['operator'] {
  if (rule.kind === 'proximity') {
    return rule.op === 'within' ? 'has_within' : 'has_not_within'
  }
  return rule.op === 'has' ? 'has' : 'has_not'
}

// Only rules with resolved target ids are sent; empty rules are skipped.
export function toFilterSet(rules: GapRule[]) {
  const apiRules: ApiRule[] = rules
    .filter((r) => r.targetIds.length > 0)
    .map((r) => ({
      id: r.id,
      operator: operatorFor(r),
      targetType: r.type === 'category' ? 'category' : 'fascia',
      targetIds: r.targetIds,
      ...(r.kind === 'proximity' ? { distance: (r.km ?? 5) * 1000 } : {}),
      matchingLogic: 'any' as const,
      connector: 'and' as const,
    }))
  return { rules: apiRules }
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`${url} failed (${res.status}): ${detail}`)
  }
  return res.json() as Promise<T>
}

export async function fetchReferenceData(
  signal?: AbortSignal
): Promise<ReferenceData> {
  const res = await fetch('/api/public/gapfinder-reference-data', { signal })
  if (!res.ok) throw new Error(`reference-data failed (${res.status})`)
  const data = await res.json()
  return {
    categories: data.categories ?? [],
    brands: data.brands ?? [],
    fasciaCategoryMappings: data.fasciaCategoryMappings ?? [],
  }
}

export async function findGaps(
  rules: GapRule[],
  options: {
    geography: GapGeography
    populationRange: [number, number]
    retailForms?: RetailCentreForm[]
    retailClassifications?: string[]
  }
): Promise<{
  results: Array<BUAResult | RetailCentreResult>
  total: number
  matchingIds?: string[]
}> {
  const body = {
    geography: options.geography,
    ...(options.geography === 'town'
      ? { minPop: options.populationRange[0], maxPop: options.populationRange[1] }
      : {
          retailForms: options.retailForms,
          retailClassifications: options.retailClassifications,
        }),
    filterSet: toFilterSet(rules),
  }
  const data = await postJson<{
    results: Array<BUAResult | RetailCentreResult>
    total: number
    matchingIds?: string[]
  }>(
    '/api/public/gaps/find',
    body
  )
  return {
    results: data.results ?? [],
    total: data.total ?? 0,
    matchingIds: data.matchingIds,
  }
}

export async function filterGssCodes(
  rules: GapRule[],
  populationRange: [number, number]
): Promise<string[]> {
  const body = {
    minPop: populationRange[0],
    maxPop: populationRange[1],
    filterSet: toFilterSet(rules),
  }
  const data = await postJson<{ gsscodes: string[] }>(
    '/api/public/gaps/filter',
    body
  )
  return data.gsscodes ?? []
}

export async function fetchMissingFascias(
  lat: number,
  lon: number,
  radiusMeters: number,
  signal?: AbortSignal
): Promise<MissingFascia[]> {
  const url = `/api/public/stores/missing-fascias?lat=${lat}&lon=${lon}&radius=${radiusMeters}`
  const res = await fetch(url, { signal })
  if (!res.ok) throw new Error(`missing-fascias failed (${res.status})`)
  const data = await res.json()
  return data.missingFascias ?? []
}

export interface NearbyStore {
  id: string
  name: string
  brand_id: string
  fascia_id: string
  fascia_name?: string | null
  brand_name?: string | null
  logo_domain?: string | null
  logo_url?: string | null
  lat: number
  lon: number
  town: string | null
  postcode: string | null
}

export async function fetchNearbyStores(
  lat: number,
  lon: number,
  radiusMeters: number,
  signal?: AbortSignal
): Promise<NearbyStore[]> {
  const url = `/api/public/stores/nearby?lat=${lat}&lon=${lon}&radius=${radiusMeters}`
  const res = await fetch(url, { signal })
  if (!res.ok) throw new Error(`nearby failed (${res.status})`)
  const data = await res.json()
  return data.stores ?? []
}

// Every store inside a BUA polygon (find-gaps selected location, scenario 1).
export async function fetchStoresInBua(
  gsscode: string,
  signal?: AbortSignal
): Promise<NearbyStore[]> {
  const url = `/api/public/stores/in-bua?gsscode=${encodeURIComponent(gsscode)}`
  const res = await fetch(url, { signal })
  if (!res.ok) throw new Error(`in-bua failed (${res.status})`)
  const data = await res.json()
  return data.stores ?? []
}

export async function fetchStoresInGapArea(
  geography: GapGeography,
  areaId: string,
  signal?: AbortSignal
): Promise<NearbyStore[]> {
  const params = new URLSearchParams({ geography, areaId })
  const res = await fetch(`/api/public/stores/in-gap-area?${params.toString()}`, { signal })
  if (!res.ok) throw new Error(`in-gap-area failed (${res.status})`)
  const data = await res.json()
  return data.stores ?? []
}

export async function fetchRetailCentreBoundary(
  areaId: string,
  signal?: AbortSignal
): Promise<GeoJSON.Geometry | null> {
  const params = new URLSearchParams({ areaId })
  const res = await fetch(`/api/public/gaps/retail-centre-boundary?${params.toString()}`, {
    signal,
  })
  if (!res.ok) throw new Error(`retail-centre-boundary failed (${res.status})`)
  const data = await res.json()
  return data.geometry ?? null
}

// Viewport-scoped, fascia/category-filtered store pins (find-gaps brand context,
// scenario 2). Returns a truncation flag so the caller can surface an honest hint.
export async function fetchStoresInViewport(
  bbox: [number, number, number, number],
  filters: { fasciaIds?: string[]; categoryIds?: string[] },
  signal?: AbortSignal
): Promise<{ stores: NearbyStore[]; truncated: boolean }> {
  const [minLon, minLat, maxLon, maxLat] = bbox
  const params = new URLSearchParams({
    minLon: String(minLon),
    minLat: String(minLat),
    maxLon: String(maxLon),
    maxLat: String(maxLat),
  })
  if (filters.fasciaIds?.length) params.set('fasciaIds', filters.fasciaIds.join(','))
  if (filters.categoryIds?.length) params.set('categoryIds', filters.categoryIds.join(','))

  const res = await fetch(`/api/public/stores/in-bbox?${params.toString()}`, { signal })
  if (!res.ok) throw new Error(`in-bbox failed (${res.status})`)
  const data = await res.json()
  return { stores: data.stores ?? [], truncated: Boolean(data.truncated) }
}

// Client-side fetch wrappers over the existing GapFinder / stores endpoints.
// v1 introduces no new API routes — these centralize error handling and the
// mapping from the workspace's GapRule shape to the server's FilterSet contract.

import type {
  BUAResult,
  GapRule,
  ReferenceData,
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
function toFilterSet(rules: GapRule[]) {
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
  return { categories: data.categories ?? [], brands: data.brands ?? [] }
}

export async function findGaps(
  rules: GapRule[],
  populationRange: [number, number]
): Promise<{ results: BUAResult[]; total: number }> {
  const body = {
    minPop: populationRange[0],
    maxPop: populationRange[1],
    filterSet: toFilterSet(rules),
  }
  const data = await postJson<{ results: BUAResult[]; total: number }>(
    '/api/public/gaps/find',
    body
  )
  return { results: data.results ?? [], total: data.total ?? 0 }
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

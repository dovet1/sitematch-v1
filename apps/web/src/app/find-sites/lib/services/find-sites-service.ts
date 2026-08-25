// Thin client wrapper over GET /api/public/sites/search — builds the query string, handles abort
// + error surfacing, and returns the typed response DTO. Mirrors the gaps-service pattern.

import type {
  FindSitesResponse,
  FindSitesSearchParams,
} from '@/lib/site-matching/find-sites-dto'

/** Thrown when a request is aborted (a newer search superseded it) — callers ignore it. */
export class FindSitesAbortError extends Error {
  constructor() {
    super('Find Sites search aborted')
    this.name = 'FindSitesAbortError'
  }
}

export async function searchFindSites(
  params: Pick<FindSitesSearchParams, 'preset' | 'brandId' | 'fasciaIds' | 'minMiles' | 'bbox' | 'minAcres' | 'topN'>,
  signal?: AbortSignal
): Promise<FindSitesResponse> {
  const qs = new URLSearchParams({ preset: params.preset })
  if (params.brandId) qs.set('brandId', params.brandId)
  if (params.fasciaIds && params.fasciaIds.length) qs.set('fasciaIds', params.fasciaIds.join(','))
  if (params.minMiles != null) qs.set('minMiles', String(params.minMiles))
  if (params.minAcres != null) qs.set('minAcres', String(params.minAcres))
  if (params.topN != null) qs.set('topN', String(params.topN))
  if (params.bbox) qs.set('bbox', params.bbox.join(','))

  let res: Response
  try {
    res = await fetch(`/api/public/sites/search?${qs.toString()}`, { signal })
  } catch (err) {
    if ((err as Error)?.name === 'AbortError') throw new FindSitesAbortError()
    throw err
  }

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(body.error || `Search failed (${res.status})`)
  }
  return (await res.json()) as FindSitesResponse
}

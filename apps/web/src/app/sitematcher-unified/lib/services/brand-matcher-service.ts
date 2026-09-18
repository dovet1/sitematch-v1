// Thin fetch wrappers for /api/public/brand-matcher (Plus-gated, flag-gated server-side).

import type {
  BrandMatcherQuery,
  BrandMatcherResponse,
  BrandMatcherStats,
} from '../../types/brand-matcher'

async function readError(res: Response): Promise<string> {
  if (res.status === 403) return 'Brand Matcher requires a Plus subscription'
  const body = (await res.json().catch(() => null)) as { error?: string } | null
  return body?.error ?? `Request failed: ${res.status}`
}

export async function fetchBrandMatcherStats(signal?: AbortSignal): Promise<BrandMatcherStats> {
  const res = await fetch('/api/public/brand-matcher', { signal })
  if (!res.ok) throw new Error(await readError(res))
  return (await res.json()) as BrandMatcherStats
}

export async function fetchBrandMatches(
  query: BrandMatcherQuery,
  signal?: AbortSignal
): Promise<BrandMatcherResponse> {
  const res = await fetch('/api/public/brand-matcher', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(query),
    signal,
  })
  if (!res.ok) throw new Error(await readError(res))
  return (await res.json()) as BrandMatcherResponse
}

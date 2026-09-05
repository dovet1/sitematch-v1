// Client-side fetch wrapper over the brand floor-area profiles endpoint.
// The table behind it is service_role-only, so this is the only route in.

import type { FloorAreaProfile } from '../size-filter'

export type FloorAreaProfileMap = Record<string, FloorAreaProfile[]>

export async function fetchFloorAreaProfiles(
  brandIds: string[],
  signal?: AbortSignal
): Promise<FloorAreaProfileMap> {
  if (brandIds.length === 0) return {}
  const res = await fetch('/api/public/brands/floor-area-profiles', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ brandIds }),
    signal,
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`floor-area-profiles failed (${res.status}): ${detail}`)
  }
  const data = await res.json()
  return (data.profiles ?? {}) as FloorAreaProfileMap
}

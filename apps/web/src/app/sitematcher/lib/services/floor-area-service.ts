// Client-side fetch wrapper over the brand floor-area profiles endpoint.
// The table behind it is service_role-only, so this is the only route in.

import type { FloorAreaProfile, MeasuredEstate } from '../size-filter'

export type FloorAreaProfileMap = Record<string, FloorAreaProfile[]>
export type MeasuredEstateMap = Record<string, MeasuredEstate>

export interface FloorAreaResponse {
  profiles: FloorAreaProfileMap
  // Brands with no distribution: their individual measured shops.
  measured: MeasuredEstateMap
}

export async function fetchFloorAreaProfiles(
  brandIds: string[],
  signal?: AbortSignal
): Promise<FloorAreaResponse> {
  if (brandIds.length === 0) return { profiles: {}, measured: {} }
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
  return {
    profiles: (data.profiles ?? {}) as FloorAreaProfileMap,
    measured: (data.measured ?? {}) as MeasuredEstateMap,
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { createStoreService } from '@/lib/stores-service'
import { createServerClient } from '@/lib/supabase'
import type { Store } from '@/lib/stores'

export const dynamic = 'force-dynamic'

async function addFasciaNames(stores: Store[]): Promise<Store[]> {
  if (stores.length === 0) {
    return stores
  }

  const fasciaIds = Array.from(new Set(stores.map(store => store.fascia_id).filter(Boolean)))
  if (fasciaIds.length === 0) {
    return stores
  }

  const supabase = await createServerClient()
  const { data } = await supabase
    .from('fascias')
    .select('id, name')
    .in('id', fasciaIds)

  const fasciaNameById = new Map((data || []).map((fascia: any) => [fascia.id, fascia.name]))

  return stores.map(store => ({
    ...store,
    fascia_name: fasciaNameById.get(store.fascia_id) ?? store.fascia_name ?? null
  }))
}

/**
 * Get stores near a point - used for Assess Area mode
 *
 * Query parameters:
 * - lat: Latitude (required)
 * - lon: Longitude (required)
 * - radius: Radius in meters (default 5000, max 20000)
 * - fasciaIds: Comma-separated fascia IDs (optional)
 * - brandIds: Comma-separated brand IDs (optional, legacy fallback)
 * - categoryIds: Comma-separated category UUIDs (optional)
 *
 * Returns:
 * {
 *   stores: Store[],
 *   total: number
 * }
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const lat = Number(searchParams.get('lat'))
    const lon = Number(searchParams.get('lon'))
    const radius = Math.min(Number(searchParams.get('radius')) || 5000, 20000)
    const fasciaIds = searchParams
      .get('fasciaIds')
      ?.split(',')
      .map(id => id.trim())
      .filter(id => id.length > 0)
    const brandIds = searchParams
      .get('brandIds')
      ?.split(',')
      .map(id => id.trim())
      .filter(id => id.length > 0)
    const categoryIds = searchParams
      .get('categoryIds')
      ?.split(',')
      .map(id => id.trim())
      .filter(id => id.length > 0)

    // Validate coordinates
    if (isNaN(lat) || isNaN(lon)) {
      return NextResponse.json(
        { stores: [], total: 0, error: 'Invalid coordinates' },
        { status: 400 }
      )
    }

    const service = await createStoreService()
    const stores = await service.getStoresNearPoint(lat, lon, radius, fasciaIds, categoryIds, brandIds)
    const enrichedStores = await addFasciaNames(stores)

    return NextResponse.json({ stores: enrichedStores, total: enrichedStores.length })
  } catch (error) {
    return NextResponse.json(
      { stores: [], total: 0, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

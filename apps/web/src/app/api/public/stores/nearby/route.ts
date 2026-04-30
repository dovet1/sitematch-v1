import { NextRequest, NextResponse } from 'next/server'
import { createStoreService } from '@/lib/stores-service'

export const dynamic = 'force-dynamic'

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

    return NextResponse.json({ stores, total: stores.length })
  } catch (error) {
    return NextResponse.json(
      { stores: [], total: 0, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

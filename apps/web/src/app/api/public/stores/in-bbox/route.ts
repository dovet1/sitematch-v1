import { NextRequest, NextResponse } from 'next/server'
import { createStoreService } from '@/lib/stores-service'
import { enrichStores } from '@/lib/store-enrichment'

export const dynamic = 'force-dynamic'

function parseIds(raw: string | null): string[] | undefined {
  const ids = raw
    ?.split(',')
    .map(id => id.trim())
    .filter(id => id.length > 0)
  return ids && ids.length > 0 ? ids : undefined
}

/**
 * Get stores within a viewport envelope, optionally filtered to fascia/category
 * ids - find-gaps brand-context pins. Filtering happens inside the RPC.
 *
 * Query parameters:
 * - minLon, minLat, maxLon, maxLat: Envelope bounds (required)
 * - fasciaIds: Comma-separated fascia IDs (optional)
 * - categoryIds: Comma-separated category UUIDs (optional)
 *
 * Returns: { stores: Store[], total: number, truncated: boolean }
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const minLon = Number(searchParams.get('minLon'))
    const minLat = Number(searchParams.get('minLat'))
    const maxLon = Number(searchParams.get('maxLon'))
    const maxLat = Number(searchParams.get('maxLat'))

    if ([minLon, minLat, maxLon, maxLat].some(n => Number.isNaN(n))) {
      return NextResponse.json(
        { stores: [], total: 0, truncated: false, error: 'Invalid bounds' },
        { status: 400 }
      )
    }

    const fasciaIds = parseIds(searchParams.get('fasciaIds'))
    const categoryIds = parseIds(searchParams.get('categoryIds'))

    const service = await createStoreService()
    const { stores, truncated } = await service.getStoresInBbox(
      [minLon, minLat, maxLon, maxLat],
      fasciaIds,
      categoryIds
    )
    const enrichedStores = await enrichStores(stores)

    return NextResponse.json({
      stores: enrichedStores,
      total: enrichedStores.length,
      truncated,
    })
  } catch (error) {
    return NextResponse.json(
      { stores: [], total: 0, truncated: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

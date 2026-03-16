import { NextRequest, NextResponse } from 'next/server'
import { createStoreService } from '@/lib/stores-service'

export const dynamic = 'force-dynamic'

/**
 * Get filtered gsscodes for map display
 * Returns only the gsscodes that match the filter criteria (for Mapbox filtering)
 *
 * Request body (JSON):
 * {
 *   minPop: number,
 *   maxPop: number,
 *   includeBrands?: string[],  // Fascia UUIDs
 *   includeCategories?: string[],  // Category UUIDs
 *   excludeBrands?: string[],  // Fascia UUIDs
 *   excludeCategories?: string[],  // Category UUIDs
 *   nearbyExclude?: Array<{
 *     brandIds?: string[],  // Fascia UUIDs
 *     categoryIds?: string[],  // Category UUIDs
 *     distance: number
 *   }>
 * }
 *
 * Returns:
 * {
 *   gsscodes: string[],  // All matching gsscodes (no limit)
 *   total: number
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const filters = await request.json()

    // Validate required fields
    if (typeof filters.minPop !== 'number' || typeof filters.maxPop !== 'number') {
      return NextResponse.json(
        {
          gsscodes: [],
          total: 0,
          error: 'minPop and maxPop are required'
        },
        { status: 400 }
      )
    }

    const service = await createStoreService()
    const { gsscodes, total } = await service.getFilteredGssCodes(filters)

    return NextResponse.json({
      gsscodes,
      total
    })
  } catch (error) {
    console.error('Filter API error:', error)
    return NextResponse.json(
      {
        gsscodes: [],
        total: 0,
        error: error instanceof Error ? error.message : 'Internal server error'
      },
      { status: 500 }
    )
  }
}

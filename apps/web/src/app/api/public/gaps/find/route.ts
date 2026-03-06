import { NextRequest, NextResponse } from 'next/server'
import { createStoreService } from '@/lib/stores-service'

export const dynamic = 'force-dynamic'

/**
 * Find gaps - BUAs matching complex filter criteria
 *
 * Request body (JSON):
 * {
 *   minPop: number,
 *   maxPop: number,
 *   includeBrands?: number[],
 *   includeCategories?: number[],
 *   excludeBrands?: number[],
 *   excludeCategories?: number[],
 *   nearbyExclude?: Array<{
 *     brandIds?: number[],
 *     categoryIds?: number[],
 *     distance: number  // in meters: 1000, 3000, 5000, or 10000
 *   }>
 * }
 *
 * Returns:
 * {
 *   results: BUA[],
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
          results: [],
          total: 0,
          error: 'minPop and maxPop are required'
        },
        { status: 400 }
      )
    }

    const service = await createStoreService()
    const results = await service.findGaps(filters)

    return NextResponse.json({
      results,
      total: results.length
    })
  } catch (error) {
    console.error('Find gaps API error:', error)
    return NextResponse.json(
      {
        results: [],
        total: 0,
        error: error instanceof Error ? error.message : 'Internal server error'
      },
      { status: 500 }
    )
  }
}

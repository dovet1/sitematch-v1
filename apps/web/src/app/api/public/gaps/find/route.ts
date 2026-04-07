import { NextRequest, NextResponse } from 'next/server'
import { createStoreService } from '@/lib/stores-service'

export const dynamic = 'force-dynamic'

/**
 * Find gaps - BUAs matching complex filter criteria
 *
 * Request body (JSON) - Supports both legacy and new filter formats:
 *
 * LEGACY FORMAT (backward compatible):
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
 *     distance: number  // in meters: 1000, 3000, 5000, or 10000
 *   }>
 * }
 *
 * NEW FORMAT (advanced filtering):
 * {
 *   minPop: number,
 *   maxPop: number,
 *   filterSet: {
 *     rules: Array<{
 *       id: string,
 *       operator: 'has' | 'has_not' | 'has_within' | 'has_not_within',
 *       targetType: 'fascia' | 'category',
 *       targetIds: string[],  // UUIDs
 *       distance?: number,  // for proximity operators
 *       matchingLogic: 'any' | 'all',
 *       connector?: 'and' | 'or'
 *     }>
 *   }
 * }
 *
 * Returns:
 * {
 *   results: BUA[],
 *   total: number,
 *   showing: number
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
    const { results, total } = await service.findGaps(filters)

    return NextResponse.json({
      results,
      total,
      showing: results.length
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

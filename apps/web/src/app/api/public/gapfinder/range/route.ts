import { NextRequest, NextResponse } from 'next/server'
import { createBUAService } from '@/lib/buas'
import { requireGapFinderAccess } from '@/lib/gapfinder-access'

export const dynamic = 'force-dynamic'

/**
 * Get Built-Up Areas within a population range
 *
 * Query parameters:
 * - minPop: Minimum population (default 0)
 * - maxPop: Maximum population (default 9787426)
 * - limit: Maximum number of results (default 100, max 1000)
 *
 * Returns:
 * {
 *   results: BUA[],
 *   total: number,
 *   minPop: number,
 *   maxPop: number
 * }
 */
export async function GET(request: NextRequest) {
  try {
    const access = await requireGapFinderAccess()
    if (!access.authorized) return access.response

    const { searchParams } = new URL(request.url)
    const minPopParam = searchParams.get('minPop')
    const maxPopParam = searchParams.get('maxPop')
    const limitParam = searchParams.get('limit')

    const minPop = minPopParam ? Number(minPopParam) : 0
    const maxPop = maxPopParam ? Number(maxPopParam) : 9787426
    const limit = limitParam ? Math.min(Number(limitParam), 1000) : 100

    // Validate parameters
    if (isNaN(minPop) || isNaN(maxPop)) {
      return NextResponse.json({
        results: [],
        total: 0,
        minPop: 0,
        maxPop: 0,
        error: 'Invalid population parameters'
      }, { status: 400 })
    }

    if (minPop > maxPop) {
      return NextResponse.json({
        results: [],
        total: 0,
        minPop,
        maxPop,
        error: 'Minimum population cannot be greater than maximum'
      }, { status: 400 })
    }

    // Create service and fetch by range
    const service = await createBUAService()
    const results = await service.getByPopulationRange(minPop, maxPop, limit)

    return NextResponse.json({
      results,
      total: results.length,
      minPop,
      maxPop
    })
  } catch (error) {
    console.error('BUA range API error:', error)
    return NextResponse.json(
      {
        results: [],
        total: 0,
        minPop: 0,
        maxPop: 0,
        error: error instanceof Error ? error.message : 'Internal server error'
      },
      { status: 500 }
    )
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { createBUAService } from '@/lib/buas'
import { requireGapFinderAccess } from '@/lib/gapfinder-access'

export const dynamic = 'force-dynamic'

/**
 * Search for Built-Up Areas by name
 *
 * Query parameters:
 * - q: Search query (minimum 2 characters, required)
 * - limit: Maximum number of results (default 20, max 100)
 *
 * Returns:
 * {
 *   results: BUA[],
 *   total: number,
 *   query: string
 * }
 */
export async function GET(request: NextRequest) {
  try {
    const access = await requireGapFinderAccess()
    if (!access.authorized) return access.response

    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q') || ''
    const limitParam = searchParams.get('limit')
    const limit = limitParam ? Math.min(Number(limitParam), 100) : 20

    // Validate query
    if (query.length < 2) {
      return NextResponse.json({
        results: [],
        total: 0,
        query,
        error: 'Query must be at least 2 characters'
      }, { status: 400 })
    }

    // Create service and search
    const service = await createBUAService()
    const results = await service.searchBUAs(query, limit)

    return NextResponse.json({
      results,
      total: results.length,
      query
    })
  } catch (error) {
    console.error('BUA search API error:', error)
    return NextResponse.json(
      {
        results: [],
        total: 0,
        query: '',
        error: error instanceof Error ? error.message : 'Internal server error'
      },
      { status: 500 }
    )
  }
}

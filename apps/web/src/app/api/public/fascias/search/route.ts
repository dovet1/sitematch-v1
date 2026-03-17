import { NextRequest, NextResponse } from 'next/server'
import { createStoreService } from '@/lib/stores-service'

export const dynamic = 'force-dynamic'

/**
 * Search for fascias by name (autocomplete)
 *
 * Query parameters:
 * - q: Search query (minimum 2 characters, required)
 * - limit: Maximum number of results (default 50, max 100)
 *
 * Returns:
 * {
 *   fascias: Fascia[],
 *   total: number,
 *   query: string
 * }
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q') || ''
    const limit = Math.min(Number(searchParams.get('limit')) || 50, 100)

    // Validate query
    if (query.length < 2) {
      return NextResponse.json({
        fascias: [],
        total: 0,
        query,
        error: 'Query must be at least 2 characters'
      }, { status: 400 })
    }

    const service = await createStoreService()
    const fascias = await service.searchFascias(query, limit)

    return NextResponse.json({
      fascias,
      total: fascias.length,
      query
    })
  } catch (error) {
    console.error('Fascia search API error:', error)
    return NextResponse.json(
      {
        fascias: [],
        total: 0,
        query: '',
        error: error instanceof Error ? error.message : 'Internal server error'
      },
      { status: 500 }
    )
  }
}

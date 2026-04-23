import { NextRequest, NextResponse } from 'next/server'
import { createStoreService } from '@/lib/stores-service'

export const dynamic = 'force-dynamic'

/**
 * Search for fascias by name (autocomplete)
 *
 * Query parameters:
 * - q: Search query (minimum 2 characters unless brandId is provided)
 * - brandId: Optional brand UUID to return fascias for a specific brand
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
    const brandId = searchParams.get('brandId') || ''
    const limit = Math.min(Number(searchParams.get('limit')) || 50, 100)

    // Validate input
    if (!brandId && query.length < 2) {
      return NextResponse.json({
        fascias: [],
        total: 0,
        query,
        error: 'Query must be at least 2 characters unless brandId is provided'
      }, { status: 400 })
    }

    const service = await createStoreService()
    const fascias = await service.getFascias({
      query,
      brandId: brandId || undefined,
      limit
    })

    return NextResponse.json({
      fascias,
      total: fascias.length,
      query,
      brandId: brandId || null
    })
  } catch (error) {
    console.error('Fascia search API error:', error)
    return NextResponse.json(
      {
        fascias: [],
        total: 0,
        query: '',
        brandId: null,
        error: error instanceof Error ? error.message : 'Internal server error'
      },
      { status: 500 }
    )
  }
}

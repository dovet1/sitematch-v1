import { NextRequest, NextResponse } from 'next/server'
import { createStoreService } from '@/lib/stores-service'

export const dynamic = 'force-dynamic'

/**
 * Get all brands with their fascias
 *
 * Query parameters:
 * - limit: Maximum number of results (default 1000, max 2000)
 *
 * Returns:
 * {
 *   brands: Brand[],
 *   total: number
 * }
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = Math.min(Number(searchParams.get('limit')) || 1000, 2000)

    const service = await createStoreService()

    // Get all brands by searching with a single character that matches everything
    // Or we can add a new method to get all brands
    const brands = await service.searchBrands('', limit)

    return NextResponse.json({
      brands,
      total: brands.length
    })
  } catch (error) {
    console.error('Get all brands API error:', error)
    return NextResponse.json(
      {
        brands: [],
        total: 0,
        error: error instanceof Error ? error.message : 'Internal server error'
      },
      { status: 500 }
    )
  }
}

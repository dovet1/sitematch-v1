import { NextResponse } from 'next/server'
import { createStoreService } from '@/lib/stores-service'

/**
 * Get all reference data for GapFinder in a single optimized call
 *
 * This endpoint combines categories, brands (with nested fascias), and fascia-category mappings
 * into a single response to eliminate the N+1 query pattern that was causing ~203 HTTP requests
 *
 * Returns:
 * {
 *   categories: Category[],
 *   brands: Array<Brand & { fascias: Fascia[] }>,
 *   fasciaCategoryMappings: FasciaCategoryMapping[]
 * }
 */
export async function GET() {
  try {
    const service = await createStoreService()

    // Fetch all reference data in a single optimized call
    const data = await service.getReferenceData(1000)

    // Return with aggressive caching headers
    // - max-age=3600: Cache for 1 hour
    // - stale-while-revalidate=86400: Serve stale for up to 24 hours while revalidating
    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400'
      }
    })
  } catch (error) {
    console.error('Get reference data API error:', error)
    return NextResponse.json(
      {
        categories: [],
        brands: [],
        fasciaCategoryMappings: [],
        error: error instanceof Error ? error.message : 'Internal server error'
      },
      { status: 500 }
    )
  }
}

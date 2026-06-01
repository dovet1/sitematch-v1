import { NextResponse } from 'next/server'
import { createStoreService } from '@/lib/stores-service'

// Force dynamic rendering to prevent static optimization
export const dynamic = 'force-dynamic'

// Revalidate every 5 minutes (ISR pattern)
export const revalidate = 300

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

    // Return with moderate caching headers aligned with ISR
    // - max-age=300: Cache for 5 minutes (matches revalidate)
    // - stale-while-revalidate=900: Serve stale for up to 15 minutes while revalidating
    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'public, max-age=300, stale-while-revalidate=900'
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

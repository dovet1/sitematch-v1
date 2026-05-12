import { NextResponse } from 'next/server'
import { requireGapFinderAccess } from '@/lib/gapfinder-access'
import { getRequirementMapFeatures } from '@/lib/requirement-map-data'

export const dynamic = 'force-dynamic'

/**
 * Get brands (company names) with their associated listing IDs from the same
 * data source used for the map pins. This ensures the selector always shows
 * exactly what's visible on the map.
 *
 * Returns:
 * {
 *   brands: Array<{ brandName: string, listingIds: string[], count: number }>,
 *   total: number
 * }
 */
export async function GET() {
  try {
    const access = await requireGapFinderAccess()
    if (!access.authorized) return access.response

    // Fetch the SAME features that appear on the map
    const features = await getRequirementMapFeatures(access.supabase, {
      isFreeTier: false
    })

    // Group features by company name, collecting listing IDs
    const brandMap = new Map<string, Set<string>>()

    features.forEach(feature => {
      const companyName = feature.properties.company_name
      const listingId = feature.properties.id

      if (!brandMap.has(companyName)) {
        brandMap.set(companyName, new Set())
      }
      brandMap.get(companyName)!.add(listingId)
    })

    // Convert to array format for selector
    const brands = Array.from(brandMap.entries())
      .map(([brandName, listingIds]) => ({
        brandName,
        listingIds: Array.from(listingIds),
        count: listingIds.size
      }))
      .sort((a, b) => a.brandName.localeCompare(b.brandName))

    return NextResponse.json({
      brands,
      total: brands.length
    })
  } catch (error) {
    console.error('Requirement companies API error:', error)
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

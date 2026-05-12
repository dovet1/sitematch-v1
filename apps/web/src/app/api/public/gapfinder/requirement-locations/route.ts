import { NextRequest, NextResponse } from 'next/server'
import { requireGapFinderAccess } from '@/lib/gapfinder-access'
import { getRequirementMapFeatures } from '@/lib/requirement-map-data'

export const dynamic = 'force-dynamic'

/**
 * Get requirement locations using the same listing/location eligibility rules
 * as the requirement directory map.
 *
 * Query parameters:
 * - minLat, minLon, maxLat, maxLon: Viewport bounds (required for API compatibility; not used for filtering)
 * - listingIds: Comma-separated listing IDs for filtering (optional)
 *
 * Returns:
 * {
 *   results: RequirementLocation[],
 *   total: number,
 *   debug: { totalBeforeFilter, totalAfterFilter, ... },
 *   error?: string
 * }
 */
export async function GET(request: NextRequest) {
  try {
    const access = await requireGapFinderAccess()
    if (!access.authorized) return access.response

    const { searchParams } = new URL(request.url)

    // Parse viewport bounds for backwards-compatible validation. The directory map
    // does not filter by bounds, so this endpoint intentionally does not either.
    const minLatParam = searchParams.get('minLat')
    const minLonParam = searchParams.get('minLon')
    const maxLatParam = searchParams.get('maxLat')
    const maxLonParam = searchParams.get('maxLon')
    const listingIdsParam = searchParams.get('listingIds')

    // Validate required parameters
    if (!minLatParam || !minLonParam || !maxLatParam || !maxLonParam) {
      return NextResponse.json({
        results: [],
        total: 0,
        error: 'Missing required viewport coordinates (minLat, minLon, maxLat, maxLon)'
      }, { status: 400 })
    }

    const minLat = Number(minLatParam)
    const minLon = Number(minLonParam)
    const maxLat = Number(maxLatParam)
    const maxLon = Number(maxLonParam)

    // Validate coordinates are numbers
    if (isNaN(minLat) || isNaN(minLon) || isNaN(maxLat) || isNaN(maxLon)) {
      return NextResponse.json({
        results: [],
        total: 0,
        error: 'Invalid viewport coordinates'
      }, { status: 400 })
    }

    // Parse listing IDs filter
    const listingIds = listingIdsParam
      ? listingIdsParam.split(',').map(id => id.trim()).filter(id => id.length > 0)
      : null

    const features = await getRequirementMapFeatures(access.supabase, {
      isFreeTier: false
    })

    // Filter by listing ID (robust, exact matching)
    const filteredResults = features
      .filter(feature =>
        !listingIds ||
        listingIds.length === 0 ||
        listingIds.includes(feature.properties.id)
      )
      .map(feature => ({
        id: feature.properties.location_id,
        listingId: feature.properties.id,
        companyName: feature.properties.company_name,
        title: feature.properties.title,
        listingType: feature.properties.listing_type,
        placeName: feature.properties.place_name,
        formattedAddress: feature.properties.formatted_address,
        coordinates: {
          lng: feature.geometry.coordinates[0],
          lat: feature.geometry.coordinates[1]
        }
      }))

    // Development-mode debug logging for listing ID filtering
    if (listingIds && listingIds.length > 0 && process.env.NODE_ENV === 'development') {
      const matchedListings = filteredResults.reduce<Array<{ id: string; name: string }>>((acc, result) => {
        if (!acc.some(listing => listing.id === result.listingId)) {
          acc.push({ id: result.listingId, name: result.companyName })
        }

        return acc
      }, [])

      console.log('[Gapfinder] Listing ID filtering:', {
        requested: listingIds,
        matched: matchedListings,
        beforeFilter: features.length,
        afterFilter: filteredResults.length
      })
    }

    // Build debug metadata with optional listing ID filtering info
    const debugMetadata = {
      totalBeforeFilter: features.length,
      totalAfterFilter: filteredResults.length,
      sampleLocationIds: filteredResults.slice(0, 20).map(result => result.id),
      isFreeTier: false,
      // Add matched listing IDs when filtering is active
      ...(listingIds && listingIds.length > 0 && {
        requestedListingIds: listingIds,
        matchedListingIds: filteredResults.reduce<string[]>((acc, result) => {
          if (!acc.includes(result.listingId)) {
            acc.push(result.listingId)
          }

          return acc
        }, [])
      })
    }

    return NextResponse.json({
      results: filteredResults,
      total: filteredResults.length,
      debug: debugMetadata
    })
  } catch (error) {
    console.error('Requirement locations API error:', error)
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

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

/**
 * Get requirement locations (listing_locations from approved listings) within viewport bounds
 *
 * Query parameters:
 * - minLat, minLon, maxLat, maxLon: Viewport bounds (required)
 * - companyNames: Comma-separated company names for filtering (optional)
 * - limit: Maximum number of results (default 500, max 2000)
 *
 * Returns:
 * {
 *   results: RequirementLocation[],
 *   total: number,
 *   error?: string
 * }
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    // Parse viewport bounds
    const minLatParam = searchParams.get('minLat')
    const minLonParam = searchParams.get('minLon')
    const maxLatParam = searchParams.get('maxLat')
    const maxLonParam = searchParams.get('maxLon')
    const companyNamesParam = searchParams.get('companyNames')
    const limitParam = searchParams.get('limit')

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
    const limit = limitParam ? Math.min(Number(limitParam), 2000) : 500

    // Validate coordinates are numbers
    if (isNaN(minLat) || isNaN(minLon) || isNaN(maxLat) || isNaN(maxLon)) {
      return NextResponse.json({
        results: [],
        total: 0,
        error: 'Invalid viewport coordinates'
      }, { status: 400 })
    }

    // Parse company names filter
    const companyNames = companyNamesParam
      ? companyNamesParam.split(',').map(name => name.trim()).filter(name => name.length > 0)
      : null

    // Create Supabase client
    const supabase = await createServerClient()

    // Build query
    let query = supabase
      .from('listing_locations')
      .select(`
        id,
        listing_id,
        place_name,
        formatted_address,
        coordinates,
        listings!inner (
          company_name,
          title,
          listing_type,
          status
        )
      `)
      .eq('listings.status', 'approved')
      .not('coordinates', 'is', null)
      .limit(limit)

    // Execute query
    const { data, error } = await query

    if (error) {
      console.error('Requirement locations query error:', error)
      return NextResponse.json({
        results: [],
        total: 0,
        error: error.message || 'Failed to fetch requirement locations'
      }, { status: 500 })
    }

    // Filter by viewport bounds and company names in application code
    // (Supabase doesn't support JSONB field filtering in query builder easily)

    const filteredResults = (data || [])
      .filter(location => {
        // Check coordinates exist and are valid
        if (!location.coordinates) {
          return false
        }

        // Coordinates can be either [lng, lat] array or { lat, lng } object
        let lat: number
        let lng: number

        if (Array.isArray(location.coordinates)) {
          // Array format: [lng, lat]
          if (location.coordinates.length !== 2 ||
              typeof location.coordinates[0] !== 'number' ||
              typeof location.coordinates[1] !== 'number') {
            return false
          }
          lng = location.coordinates[0]
          lat = location.coordinates[1]
        } else if (typeof location.coordinates === 'object') {
          // Object format: { lat, lng }
          const coords = location.coordinates as { lat: number; lng: number }
          if (typeof coords.lat !== 'number' || typeof coords.lng !== 'number') {
            return false
          }
          lat = coords.lat
          lng = coords.lng
        } else {
          return false
        }

        // Check viewport bounds
        if (lat < minLat || lat > maxLat) {
          return false
        }
        if (lng < minLon || lng > maxLon) {
          return false
        }

        // Check company name filter
        if (companyNames && companyNames.length > 0) {
          const listing = Array.isArray(location.listings) ? location.listings[0] : location.listings
          if (!listing || !companyNames.includes(listing.company_name)) {
            return false
          }
        }

        return true
      })
      .slice(0, limit)
      .map(location => {
        const listing = Array.isArray(location.listings) ? location.listings[0] : location.listings

        // Normalize coordinates to { lat, lng } object format
        let coordinates: { lat: number; lng: number }
        if (Array.isArray(location.coordinates)) {
          coordinates = {
            lng: location.coordinates[0],
            lat: location.coordinates[1]
          }
        } else {
          coordinates = location.coordinates as { lat: number; lng: number }
        }

        return {
          id: location.id,
          listingId: location.listing_id,
          companyName: listing.company_name,
          title: listing.title,
          listingType: listing.listing_type,
          placeName: location.place_name,
          formattedAddress: location.formatted_address,
          coordinates
        }
      })

    return NextResponse.json({
      results: filteredResults,
      total: filteredResults.length
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

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

/**
 * Get stores within viewport bounds - used for Find Gaps mode with filters
 *
 * Query parameters:
 * - minLat: Southwest latitude (required)
 * - minLon: Southwest longitude (required)
 * - maxLat: Northeast latitude (required)
 * - maxLon: Northeast longitude (required)
 * - includeBrandIds: Comma-separated fascia UUIDs for included stores (optional)
 * - includeCategories: Comma-separated category UUIDs for included stores (optional)
 * - excludeBrandIds: Comma-separated fascia UUIDs for excluded stores (optional)
 * - excludeCategories: Comma-separated category UUIDs for excluded stores (optional)
 * - proximityBrandIds: Comma-separated fascia UUIDs for proximity stores (optional)
 * - limit: Max stores per type (default 2000, max 5000)
 *
 * Returns:
 * {
 *   includedStores: Store[],
 *   excludedStores: Store[],
 *   proximityStores: Store[],
 *   totalIncluded: number,
 *   totalExcluded: number,
 *   totalProximity: number
 * }
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams

    // Extract viewport bounds
    const minLat = Number(searchParams.get('minLat'))
    const minLon = Number(searchParams.get('minLon'))
    const maxLat = Number(searchParams.get('maxLat'))
    const maxLon = Number(searchParams.get('maxLon'))

    // Validate coordinates
    if (isNaN(minLat) || isNaN(minLon) || isNaN(maxLat) || isNaN(maxLon)) {
      return NextResponse.json(
        {
          includedStores: [],
          excludedStores: [],
          proximityStores: [],
          totalIncluded: 0,
          totalExcluded: 0,
          totalProximity: 0,
          error: 'Invalid viewport coordinates'
        },
        { status: 400 }
      )
    }

    // Extract filter parameters
    const includeBrandIds = searchParams
      .get('includeBrandIds')
      ?.split(',')
      .filter(id => id.trim().length > 0)

    const includeCategories = searchParams
      .get('includeCategories')
      ?.split(',')
      .filter(id => id.trim().length > 0)

    const excludeBrandIds = searchParams
      .get('excludeBrandIds')
      ?.split(',')
      .filter(id => id.trim().length > 0)

    const excludeCategories = searchParams
      .get('excludeCategories')
      ?.split(',')
      .filter(id => id.trim().length > 0)

    const proximityBrandIds = searchParams
      .get('proximityBrandIds')
      ?.split(',')
      .filter(id => id.trim().length > 0)

    const limit = Math.min(Number(searchParams.get('limit')) || 2000, 5000)

    const supabase = await createServerClient()

    // Fetch included stores (if any include filters are provided)
    let includedStores: any[] = []
    let totalIncluded = 0

    if ((includeBrandIds && includeBrandIds.length > 0) || (includeCategories && includeCategories.length > 0)) {
      const { data, error } = await supabase.rpc('get_included_stores_in_viewport', {
        p_min_lat: minLat,
        p_min_lon: minLon,
        p_max_lat: maxLat,
        p_max_lon: maxLon,
        p_brand_ids: includeBrandIds || null,
        p_category_ids: includeCategories || null,
        p_limit: limit
      })

      if (error) {
        console.error('Failed to fetch included stores:', error)
      } else {
        includedStores = data || []
        totalIncluded = includedStores.length
      }
    }

    // Fetch excluded stores (if any exclude filters are provided)
    let excludedStores: any[] = []
    let totalExcluded = 0

    if ((excludeBrandIds && excludeBrandIds.length > 0) || (excludeCategories && excludeCategories.length > 0)) {
      const { data, error } = await supabase.rpc('get_excluded_stores_in_viewport', {
        p_min_lat: minLat,
        p_min_lon: minLon,
        p_max_lat: maxLat,
        p_max_lon: maxLon,
        p_brand_ids: excludeBrandIds || null,
        p_category_ids: excludeCategories || null,
        p_limit: limit
      })

      if (error) {
        console.error('Failed to fetch excluded stores:', error)
      } else {
        excludedStores = data || []
        totalExcluded = excludedStores.length
      }
    }

    // Fetch proximity stores (if any proximity filters are provided)
    let proximityStores: any[] = []
    let totalProximity = 0

    if (proximityBrandIds && proximityBrandIds.length > 0) {
      const { data, error } = await supabase.rpc('get_included_stores_in_viewport', {
        p_min_lat: minLat,
        p_min_lon: minLon,
        p_max_lat: maxLat,
        p_max_lon: maxLon,
        p_brand_ids: proximityBrandIds,
        p_category_ids: null,
        p_limit: limit
      })

      if (error) {
        console.error('Failed to fetch proximity stores:', error)
      } else {
        proximityStores = data || []
        totalProximity = proximityStores.length
      }
    }

    return NextResponse.json({
      includedStores,
      excludedStores,
      proximityStores,
      totalIncluded,
      totalExcluded,
      totalProximity
    })
  } catch (error) {
    console.error('Viewport stores API error:', error)
    return NextResponse.json(
      {
        includedStores: [],
        excludedStores: [],
        proximityStores: [],
        totalIncluded: 0,
        totalExcluded: 0,
        totalProximity: 0,
        error: error instanceof Error ? error.message : 'Internal server error'
      },
      { status: 500 }
    )
  }
}

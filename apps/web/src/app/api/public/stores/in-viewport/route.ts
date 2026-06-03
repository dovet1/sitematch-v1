import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

async function addMatchedTargetIds(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  stores: any[],
  brandIds?: string[],
  categoryIds?: string[]
) {
  if (stores.length === 0) {
    return stores
  }

  const categoryIdsToMatch = categoryIds?.filter(Boolean) || []
  const matchedCategoriesByFascia = new Map<string, string[]>()

  if (categoryIdsToMatch.length > 0) {
    const fasciaIds = Array.from(new Set(stores.map(store => store.fascia_id).filter(Boolean)))

    if (fasciaIds.length > 0) {
      const { data } = await supabase
        .from('fascia_categories')
        .select('fascia_id, category_id')
        .in('fascia_id', fasciaIds)
        .in('category_id', categoryIdsToMatch)

      ;(data || []).forEach((row: { fascia_id: string; category_id: string }) => {
        const existing = matchedCategoriesByFascia.get(row.fascia_id) || []
        existing.push(row.category_id)
        matchedCategoriesByFascia.set(row.fascia_id, existing)
      })
    }
  }

  const brandIdSet = new Set(brandIds?.filter(Boolean) || [])

  return stores.map((store) => {
    const matchedTargetIds = new Set<string>()
    const displayTargetIds = new Set<string>()

    if (store.fascia_id && brandIdSet.has(store.fascia_id)) {
      matchedTargetIds.add(store.fascia_id)
      displayTargetIds.add(store.fascia_id)
    }

    for (const categoryId of matchedCategoriesByFascia.get(store.fascia_id) || []) {
      matchedTargetIds.add(categoryId)
      displayTargetIds.add(store.fascia_id)
    }

    return {
      ...store,
      matchedTargetIds: Array.from(matchedTargetIds),
      displayTargetIds: Array.from(displayTargetIds)
    }
  })
}

async function enrichStoresForDisplay(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  stores: any[]
) {
  if (stores.length === 0) {
    return stores
  }

  const storeIds = Array.from(new Set(stores.map(store => store.id).filter(Boolean)))
  const fasciaIds = Array.from(new Set(stores.map(store => store.fascia_id).filter(Boolean)))

  const [storeDetailsResult, fasciasResult] = await Promise.all([
    storeIds.length > 0
      ? supabase
          .from('stores')
          .select('id, address_line_1, address_line_2, suburb, town, county, postcode')
          .in('id', storeIds)
      : Promise.resolve({ data: [] }),
    fasciaIds.length > 0
      ? supabase
          .from('fascias')
          .select('id, name')
          .in('id', fasciaIds)
      : Promise.resolve({ data: [] })
  ])

  const storeDetailsById = new Map(
    (storeDetailsResult.data || []).map((store: any) => [store.id, store])
  )
  const fasciaNameById = new Map(
    (fasciasResult.data || []).map((fascia: any) => [fascia.id, fascia.name])
  )

  return stores.map(store => {
    const details = storeDetailsById.get(store.id) || {}

    return {
      ...store,
      address_line_1: details.address_line_1 ?? store.address_line_1 ?? null,
      address_line_2: details.address_line_2 ?? store.address_line_2 ?? null,
      suburb: details.suburb ?? store.suburb ?? null,
      town: details.town ?? store.town ?? null,
      county: details.county ?? store.county ?? null,
      postcode: details.postcode ?? store.postcode ?? null,
      fascia_name: fasciaNameById.get(store.fascia_id) ?? store.fascia_name ?? null
    }
  })
}

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
 * - proximityIncludeBrandIds: Comma-separated fascia UUIDs for proximity inclusion stores (optional)
 * - proximityIncludeCategories: Comma-separated category UUIDs for proximity inclusion stores (optional)
 * - proximityExcludeBrandIds: Comma-separated fascia UUIDs for proximity exclusion stores (optional)
 * - proximityExcludeCategories: Comma-separated category UUIDs for proximity exclusion stores (optional)
 * - limit: Max stores per type (default 2000, max 5000)
 *
 * Returns:
 * {
 *   includedStores: Store[],
 *   excludedStores: Store[],
 *   proximityIncludedStores: Store[],
 *   proximityExcludedStores: Store[],
 *   totalIncluded: number,
 *   totalExcluded: number,
 *   totalProximityIncluded: number,
 *   totalProximityExcluded: number
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
          proximityIncludedStores: [],
          proximityExcludedStores: [],
          totalIncluded: 0,
          totalExcluded: 0,
          totalProximityIncluded: 0,
          totalProximityExcluded: 0,
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

    const proximityIncludeBrandIds = searchParams
      .get('proximityIncludeBrandIds')
      ?.split(',')
      .filter(id => id.trim().length > 0)

    const proximityIncludeCategories = searchParams
      .get('proximityIncludeCategories')
      ?.split(',')
      .filter(id => id.trim().length > 0)

    const proximityExcludeBrandIds = searchParams
      .get('proximityExcludeBrandIds')
      ?.split(',')
      .filter(id => id.trim().length > 0)

    const proximityExcludeCategories = searchParams
      .get('proximityExcludeCategories')
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

      if (!error) {
        includedStores = await addMatchedTargetIds(supabase, data || [], includeBrandIds, includeCategories)
        includedStores = await enrichStoresForDisplay(supabase, includedStores)
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

      if (!error) {
        excludedStores = await addMatchedTargetIds(supabase, data || [], excludeBrandIds, excludeCategories)
        excludedStores = await enrichStoresForDisplay(supabase, excludedStores)
        totalExcluded = excludedStores.length
      }
    }

    // Fetch proximity included stores (has_within operator)
    let proximityIncludedStores: any[] = []
    let totalProximityIncluded = 0

    if ((proximityIncludeBrandIds && proximityIncludeBrandIds.length > 0) ||
        (proximityIncludeCategories && proximityIncludeCategories.length > 0)) {
      const { data, error } = await supabase.rpc('get_included_stores_in_viewport', {
        p_min_lat: minLat,
        p_min_lon: minLon,
        p_max_lat: maxLat,
        p_max_lon: maxLon,
        p_brand_ids: proximityIncludeBrandIds || null,
        p_category_ids: proximityIncludeCategories || null,
        p_limit: limit
      })

      if (!error) {
        proximityIncludedStores = await addMatchedTargetIds(
          supabase,
          data || [],
          proximityIncludeBrandIds,
          proximityIncludeCategories
        )
        proximityIncludedStores = await enrichStoresForDisplay(supabase, proximityIncludedStores)
        totalProximityIncluded = proximityIncludedStores.length
      }
    }

    // Fetch proximity excluded stores (has_not_within operator)
    let proximityExcludedStores: any[] = []
    let totalProximityExcluded = 0

    if ((proximityExcludeBrandIds && proximityExcludeBrandIds.length > 0) ||
        (proximityExcludeCategories && proximityExcludeCategories.length > 0)) {
      const { data, error } = await supabase.rpc('get_excluded_stores_in_viewport', {
        p_min_lat: minLat,
        p_min_lon: minLon,
        p_max_lat: maxLat,
        p_max_lon: maxLon,
        p_brand_ids: proximityExcludeBrandIds || null,
        p_category_ids: proximityExcludeCategories || null,
        p_limit: limit
      })

      if (!error) {
        proximityExcludedStores = await addMatchedTargetIds(
          supabase,
          data || [],
          proximityExcludeBrandIds,
          proximityExcludeCategories
        )
        proximityExcludedStores = await enrichStoresForDisplay(supabase, proximityExcludedStores)
        totalProximityExcluded = proximityExcludedStores.length
      }
    }

    return NextResponse.json({
      includedStores,
      excludedStores,
      proximityIncludedStores,
      proximityExcludedStores,
      totalIncluded,
      totalExcluded,
      totalProximityIncluded,
      totalProximityExcluded
    })
  } catch (error) {
    return NextResponse.json(
      {
        includedStores: [],
        excludedStores: [],
        proximityIncludedStores: [],
        proximityExcludedStores: [],
        totalIncluded: 0,
        totalExcluded: 0,
        totalProximityIncluded: 0,
        totalProximityExcluded: 0,
        error: error instanceof Error ? error.message : 'Internal server error'
      },
      { status: 500 }
    )
  }
}

/**
 * Store Service - Abstracts Supabase queries for store and gap analysis data
 * Uses precomputed summary tables for fast filtering
 */

import { createServerClient } from '@/lib/supabase'
import type { Category, Brand, Store } from '@/lib/stores'
import type { FilterSet, FilterRule } from '@/types/filters'

export class StoreService {
  private supabase: any

  constructor(supabaseClient: any) {
    this.supabase = supabaseClient
  }

  /**
   * Fetch all store categories
   * @returns Array of categories ordered by name
   */
  async getCategories(): Promise<Category[]> {
    const { data, error } = await this.supabase
      .from('categories')
      .select('*')
      .order('name')

    if (error) {
      console.error('Failed to fetch categories:', error)
      throw new Error(`Failed to fetch categories: ${error.message}`)
    }

    return data || []
  }

  /**
   * Search brands by name with autocomplete
   * @param query Search query string
   * @param limit Maximum results (default 20, max 100)
   * @returns Array of matching brands ordered by name
   */
  async searchBrands(query: string, limit = 20): Promise<Brand[]> {
    let dbQuery = this.supabase
      .from('brands')
      .select('*')
      .order('name')
      .limit(Math.min(limit, 2000))

    // Only add the search filter if query is provided
    if (query && query.length >= 2) {
      dbQuery = dbQuery.ilike('name', `%${query}%`)
    }

    const { data, error } = await dbQuery

    if (error) {
      console.error('Failed to search brands:', error)
      throw new Error(`Failed to search brands: ${error.message}`)
    }

    return data || []
  }

  /**
   * Search for fascias by name (autocomplete)
   * Returns fascias with their parent brand information
   * @param query Search term (minimum 2 characters)
   * @param limit Maximum number of results (default 50, max 100)
   * @returns Array of matching fascias with brand info, ordered by name
   */
  async searchFascias(query: string, limit = 50): Promise<any[]> {
    if (query.length < 2) {
      return []
    }

    const { data, error } = await this.supabase
      .from('fascias')
      .select('id, name, brand_id, brands(id, name)')
      .ilike('name', `%${query}%`)
      .order('name')
      .limit(Math.min(limit, 100))

    if (error) {
      console.error('Failed to search fascias:', error)
      throw new Error(`Failed to search fascias: ${error.message}`)
    }

    return data || []
  }

  /**
   * Get stores within radius of a point (for Assess Area mode)
   * Uses PostGIS ST_DWithin for spatial query
   * @param lat Latitude of center point
   * @param lon Longitude of center point
   * @param radiusMeters Radius in meters
   * @param brandIds Optional brand ID filters
   * @param categoryIds Optional category ID filters
   * @returns Array of stores within radius
   */
  async getStoresNearPoint(
    lat: number,
    lon: number,
    radiusMeters: number,
    brandIds?: string[],
    categoryIds?: string[]  // Category IDs (UUIDs)
  ): Promise<Store[]> {
    // Use PostGIS RPC function for spatial query
    let query = this.supabase.rpc('get_stores_near_point', {
      p_lat: lat,
      p_lon: lon,
      p_radius_m: radiusMeters
    })

    if (brandIds && brandIds.length > 0) {
      query = query.in('brand_id', brandIds)
    }

    if (categoryIds && categoryIds.length > 0) {
      // Join with fascia_categories for category filtering
      const { data: fasciaIds } = await this.supabase
        .from('fascia_categories')
        .select('fascia_id')
        .in('category_id', categoryIds)

      if (fasciaIds && fasciaIds.length > 0) {
        query = query.in('fascia_id', fasciaIds.map((f: any) => f.fascia_id))
      }
    }

    const { data, error } = await query.limit(1000)

    if (error) {
      console.error('Failed to fetch nearby stores:', error)
      throw new Error(`Failed to fetch nearby stores: ${error.message}`)
    }

    return data || []
  }

  /**
   * Filter BUAs using AND logic for rules with matchingLogic='all'
   * This is a post-filter step because the RPC function only supports OR logic
   * @param gsscodes Array of BUA gsscodes from initial filter
   * @param andLogicRules Rules that require ALL targets to be present
   * @returns Filtered array of gsscodes
   */

  /**
   * Convert new FilterSet format to legacy filter format
   * This allows backward compatibility while supporting the new advanced filtering system
   * @param filterSet New FilterSet format
   * @returns Legacy filter format
   */
  convertFilterSetToLegacy(filterSet: FilterSet): {
    includeBrands?: string[]
    includeCategories?: string[]
    excludeBrands?: string[]
    excludeCategories?: string[]
    nearbyExclude?: Array<{
      brandIds?: string[]
      categoryIds?: string[]
      distance: number
      matchAll?: boolean
    }>
    nearbyInclude?: Array<{
      brandIds?: string[]
      categoryIds?: string[]
      distance: number
      matchAll?: boolean
    }>
    // NEW: Match-all flags for AND logic support
    includeBrandsMatchAll?: boolean
    includeCategoriesMatchAll?: boolean
    excludeBrandsMatchAll?: boolean
    excludeCategoriesMatchAll?: boolean
  } {
    const legacy: {
      includeBrands?: string[]
      includeCategories?: string[]
      excludeBrands?: string[]
      excludeCategories?: string[]
      nearbyExclude?: Array<{
        brandIds?: string[]
        categoryIds?: string[]
        distance: number
        matchAll?: boolean
      }>
      nearbyInclude?: Array<{
        brandIds?: string[]
        categoryIds?: string[]
        distance: number
        matchAll?: boolean
      }>
      includeBrandsMatchAll?: boolean
      includeCategoriesMatchAll?: boolean
      excludeBrandsMatchAll?: boolean
      excludeCategoriesMatchAll?: boolean
    } = {}

    // Process each rule
    for (const rule of filterSet.rules) {
      const isFascia = rule.targetType === 'fascia'
      const isCategory = rule.targetType === 'category'
      const isMatchAll = rule.matchingLogic === 'all'

      switch (rule.operator) {
        case 'has':
          // Include filters with AND/OR logic support
          if (isFascia) {
            legacy.includeBrands = [...(legacy.includeBrands || []), ...rule.targetIds]
            // Set match-all flag if this rule requires ALL targets
            if (isMatchAll && rule.targetIds.length > 1) {
              legacy.includeBrandsMatchAll = true
            }
          } else if (isCategory) {
            legacy.includeCategories = [...(legacy.includeCategories || []), ...rule.targetIds]
            // Set match-all flag if this rule requires ALL targets
            if (isMatchAll && rule.targetIds.length > 1) {
              legacy.includeCategoriesMatchAll = true
            }
          }
          break

        case 'has_not':
          // Exclude filters with AND/OR logic support
          if (isFascia) {
            legacy.excludeBrands = [...(legacy.excludeBrands || []), ...rule.targetIds]
            // Set match-all flag if this rule requires NONE OF ALL targets
            if (isMatchAll && rule.targetIds.length > 1) {
              legacy.excludeBrandsMatchAll = true
            }
          } else if (isCategory) {
            legacy.excludeCategories = [...(legacy.excludeCategories || []), ...rule.targetIds]
            // Set match-all flag if this rule requires NONE OF ALL targets
            if (isMatchAll && rule.targetIds.length > 1) {
              legacy.excludeCategoriesMatchAll = true
            }
          }
          break

        case 'has_within':
          // Proximity inclusion with AND/OR logic support
          if (!legacy.nearbyInclude) {
            legacy.nearbyInclude = []
          }
          legacy.nearbyInclude.push({
            brandIds: isFascia ? rule.targetIds : undefined,
            categoryIds: isCategory ? rule.targetIds : undefined,
            distance: rule.distance || 5000,
            matchAll: isMatchAll && rule.targetIds.length > 1,  // Set AND logic flag
          })
          break

        case 'has_not_within':
          // Proximity exclusion with AND/OR logic support
          if (!legacy.nearbyExclude) {
            legacy.nearbyExclude = []
          }
          legacy.nearbyExclude.push({
            brandIds: isFascia ? rule.targetIds : undefined,
            categoryIds: isCategory ? rule.targetIds : undefined,
            distance: rule.distance || 5000,
            matchAll: isMatchAll && rule.targetIds.length > 1,  // Set AND logic flag
          })
          break
      }
    }

    // Deduplicate arrays
    if (legacy.includeBrands) {
      legacy.includeBrands = Array.from(new Set(legacy.includeBrands))
    }
    if (legacy.includeCategories) {
      legacy.includeCategories = Array.from(new Set(legacy.includeCategories))
    }
    if (legacy.excludeBrands) {
      legacy.excludeBrands = Array.from(new Set(legacy.excludeBrands))
    }
    if (legacy.excludeCategories) {
      legacy.excludeCategories = Array.from(new Set(legacy.excludeCategories))
    }

    return legacy
  }

  /**
   * Find gaps - BUAs matching complex filter criteria
   * Uses precomputed bua_store_presence and bua_store_nearby tables for performance
   * @param filters Complex filter object (supports both legacy and new FilterSet format)
   * @returns Array of matching BUAs ordered by population descending
   */
  async findGaps(filters: {
    minPop: number
    maxPop: number
    // Legacy format (for backward compatibility)
    includeBrands?: string[]  // Fascia IDs (UUIDs)
    includeCategories?: string[]  // Category IDs (UUIDs)
    excludeBrands?: string[]  // Fascia IDs (UUIDs)
    excludeCategories?: string[]  // Category IDs (UUIDs)
    nearbyExclude?: Array<{
      brandIds?: string[]  // Fascia IDs (UUIDs)
      categoryIds?: string[]  // Category IDs (UUIDs)
      distance: number
    }>
    // NEW: Advanced filter format
    filterSet?: FilterSet
  }): Promise<{ results: any[], total: number }> {
    // If filterSet is provided, convert it to legacy format
    let actualFilters = filters
    if (filters.filterSet) {
      const legacyFilters = this.convertFilterSetToLegacy(filters.filterSet)
      actualFilters = {
        minPop: filters.minPop,
        maxPop: filters.maxPop,
        ...legacyFilters,
      }
    }
    // Use RPC function for all filtering logic including AND/OR
    const { gsscodes: allMatchingGsscodes, total } = await this.getFilteredGssCodes(actualFilters)

    console.log(`✅ [findGaps] RPC returned ${total} matching BUAs after all filters`)

    // Now fetch detailed BUA data for top 1,000 by population
    const { data, error } = await this.supabase
      .from('built_up_areas')
      .select('gsscode, name, pop, pop_final, pop_official, pop_band, centroid_lat, centroid_lon')
      .in('gsscode', allMatchingGsscodes.slice(0, 1000))  // Top 1,000 gsscodes (already sorted by pop)
      .order('pop_final', { ascending: false, nullsLast: true })

    if (error) {
      console.error('Failed to fetch BUA details:', error)
      throw new Error(`Failed to fetch BUA details: ${error.message}`)
    }

    return { results: data || [], total }
  }

  /**
   * Get filtered gsscodes for map display (no limit, returns all matching gsscodes)
   * This is used by the map to filter the Mapbox tileset client-side
   * Uses the Supabase RPC function for efficient server-side filtering
   * @param filters Complex filter object (supports both legacy and new FilterSet format)
   * @returns Array of matching gsscodes and total count
   */
  async getFilteredGssCodes(filters: {
    minPop: number
    maxPop: number
    // Legacy format (for backward compatibility)
    includeBrands?: string[]  // Fascia IDs (UUIDs)
    includeCategories?: string[]  // Category IDs (UUIDs)
    excludeBrands?: string[]  // Fascia IDs (UUIDs)
    excludeCategories?: string[]  // Category IDs (UUIDs)
    nearbyExclude?: Array<{
      brandIds?: string[]  // Fascia IDs (UUIDs)
      categoryIds?: string[]  // Category IDs (UUIDs)
      distance: number
    }>
    // NEW: Advanced filter format
    filterSet?: FilterSet
  }): Promise<{ gsscodes: string[], total: number }> {
    // If filterSet is provided, convert it to legacy format
    let actualFilters = filters
    if (filters.filterSet) {
      const legacyFilters = this.convertFilterSetToLegacy(filters.filterSet)
      actualFilters = {
        minPop: filters.minPop,
        maxPop: filters.maxPop,
        ...legacyFilters,
      }
    }
    // Call the Supabase RPC function for efficient server-side filtering
    // NOTE: Supabase's default max-rows is 1000. To get all results, we need to paginate.
    // Since we can't override the limit for RPC calls easily, we'll paginate through results.

    // Transform proximity rules into JSONB format for RPC
    let nearbyExcludeFascias: any[] | null = null
    let nearbyExcludeCategories: any[] | null = null
    let nearbyIncludeFascias: any[] | null = null
    let nearbyIncludeCategories: any[] | null = null

    // Proximity exclusion
    if (actualFilters.nearbyExclude && actualFilters.nearbyExclude.length > 0) {
      // Group by fascias vs categories
      const fasciaRules = actualFilters.nearbyExclude
        .filter(rule => rule.brandIds && rule.brandIds.length > 0)
        .map(rule => ({
          distance_m: rule.distance,
          ids: rule.brandIds,
          match_all: rule.matchAll || false  // Include AND logic flag
        }))

      const categoryRules = actualFilters.nearbyExclude
        .filter(rule => rule.categoryIds && rule.categoryIds.length > 0)
        .map(rule => ({
          distance_m: rule.distance,
          ids: rule.categoryIds,
          match_all: rule.matchAll || false  // Include AND logic flag
        }))

      nearbyExcludeFascias = fasciaRules.length > 0 ? fasciaRules : null
      nearbyExcludeCategories = categoryRules.length > 0 ? categoryRules : null
    }

    // Proximity inclusion
    if (actualFilters.nearbyInclude && actualFilters.nearbyInclude.length > 0) {
      // Group by fascias vs categories
      const fasciaRules = actualFilters.nearbyInclude
        .filter(rule => rule.brandIds && rule.brandIds.length > 0)
        .map(rule => ({
          distance_m: rule.distance,
          ids: rule.brandIds,
          match_all: rule.matchAll || false  // Include AND logic flag
        }))

      const categoryRules = actualFilters.nearbyInclude
        .filter(rule => rule.categoryIds && rule.categoryIds.length > 0)
        .map(rule => ({
          distance_m: rule.distance,
          ids: rule.categoryIds,
          match_all: rule.matchAll || false  // Include AND logic flag
        }))

      nearbyIncludeFascias = fasciaRules.length > 0 ? fasciaRules : null
      nearbyIncludeCategories = categoryRules.length > 0 ? categoryRules : null
    }

    const allGsscodes: string[] = []
    let offset = 0
    const pageSize = 1000
    let hasMore = true

    while (hasMore) {
      const { data, error } = await this.supabase
        .rpc('get_filtered_bua_gsscodes', {
          p_min_pop: actualFilters.minPop,
          p_max_pop: actualFilters.maxPop,
          p_include_fascias: actualFilters.includeBrands && actualFilters.includeBrands.length > 0 ? actualFilters.includeBrands : null,
          p_include_categories: actualFilters.includeCategories && actualFilters.includeCategories.length > 0 ? actualFilters.includeCategories : null,
          p_exclude_fascias: actualFilters.excludeBrands && actualFilters.excludeBrands.length > 0 ? actualFilters.excludeBrands : null,
          p_exclude_categories: actualFilters.excludeCategories && actualFilters.excludeCategories.length > 0 ? actualFilters.excludeCategories : null,
          p_nearby_exclude_fascias: nearbyExcludeFascias,
          p_nearby_exclude_categories: nearbyExcludeCategories,
          p_nearby_include_fascias: nearbyIncludeFascias,
          p_nearby_include_categories: nearbyIncludeCategories,
          // NEW: Match-all flags for AND logic
          p_include_fascias_match_all: actualFilters.includeBrandsMatchAll || false,
          p_include_categories_match_all: actualFilters.includeCategoriesMatchAll || false,
          p_exclude_fascias_match_all: actualFilters.excludeBrandsMatchAll || false,
          p_exclude_categories_match_all: actualFilters.excludeCategoriesMatchAll || false
        })
        .range(offset, offset + pageSize - 1)

      if (error) {
        console.error('Failed to get filtered gsscodes:', error)
        throw new Error(`Failed to get filtered gsscodes: ${error.message}`)
      }

      const gsscodes = (data || []).map((row: any) => row.gsscode)
      allGsscodes.push(...gsscodes)

      // If we got fewer results than pageSize, we've reached the end
      hasMore = gsscodes.length === pageSize
      offset += pageSize

      console.log(`✅ [Map Filter RPC] Page ${Math.floor(offset / pageSize)}: ${gsscodes.length} BUAs (total so far: ${allGsscodes.length})`)
    }

    console.log(`✅ [Map Filter RPC] Finished - Total: ${allGsscodes.length} matching BUAs`)

    // POST-FILTER: If filterSet has AND logic, we need to manually filter results
    if (filters.filterSet) {
      const andLogicRules = filters.filterSet.rules.filter(
        rule => rule.matchingLogic === 'all' && rule.targetIds.length > 1 && rule.operator === 'has'
      )

      if (andLogicRules.length > 0) {
        console.log(`⚙️ [Map Filter] Applying client-side AND logic for ${andLogicRules.length} rule(s)`)
        const filteredGsscodes = await this.filterBUAsWithAndLogic(allGsscodes, andLogicRules)
        console.log(`✅ [Map Filter] After AND logic: ${filteredGsscodes.length} BUAs (was ${allGsscodes.length})`)
        return { gsscodes: filteredGsscodes, total: filteredGsscodes.length }
      }
    }

    return { gsscodes: allGsscodes, total: allGsscodes.length }
  }
}

/**
 * Create a StoreService instance with server-side Supabase client
 * Use this in API routes and server components
 */
export async function createStoreService() {
  const supabaseClient = await createServerClient()
  return new StoreService(supabaseClient)
}

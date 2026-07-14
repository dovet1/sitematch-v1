/**
 * Store Service - Abstracts Supabase queries for store and gap analysis data
 * Uses precomputed summary tables for fast filtering
 */

import { createServerClient } from '@/lib/supabase'
import type { Category, Brand, Fascia, Store } from '@/lib/stores'
import type { FilterSet } from '@/types/filters'

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
   * Get fascias, optionally scoped to a brand and/or name query
   * @param options Query options
   * @returns Array of matching fascias with brand info, ordered by name
   */
  async getFascias(options: {
    query?: string
    brandId?: string
    limit?: number
  } = {}): Promise<Array<Fascia & { brands?: { id: string; name: string } }>> {
    const { query = '', brandId, limit = 50 } = options

    let dbQuery = this.supabase
      .from('fascias')
      .select('id, name, brand_id, definition, created_at, brands(id, name)')
      .order('name')
      .limit(Math.min(limit, 100))

    if (brandId) {
      dbQuery = dbQuery.eq('brand_id', brandId)
    }

    if (query && query.length >= 2) {
      dbQuery = dbQuery.ilike('name', `%${query}%`)
    } else if (!brandId) {
      return []
    }

    const { data, error } = await dbQuery

    if (error) {
      console.error('Failed to get fascias:', error)
      throw new Error(`Failed to get fascias: ${error.message}`)
    }

    return data || []
  }

  /**
   * Get all fascia-category mappings
   * This is used to build the category → brand → fascia tree structure
   * @returns Array of fascia-category mappings
   */
  async getFasciaCategoryMappings(): Promise<Array<{
    fascia_id: string
    category_id: string
    is_primary: boolean
  }>> {
    const { data, error } = await this.supabase
      .from('fascia_categories')
      .select('fascia_id, category_id, is_primary')
      .order('category_id, fascia_id')

    if (error) {
      console.error('Failed to fetch fascia-category mappings:', error)
      throw new Error(`Failed to fetch fascia-category mappings: ${error.message}`)
    }

    return data || []
  }

  /**
   * Get all reference data for GapFinder in a single optimized call
   * Returns categories, brands with nested fascias, and fascia-category mappings
   * @param limit Maximum number of brands to return (default 1000)
   * @returns Object containing all reference data
   */
  async getReferenceData(limit = 1000): Promise<{
    categories: Category[]
    brands: Array<Brand & { fascias: Fascia[] }>
    fasciaCategoryMappings: Array<{
      fascia_id: string
      category_id: string
      is_primary: boolean
    }>
  }> {
    // Fetch all data in parallel
    const [categoriesResult, brandsResult, mappingsResult] = await Promise.all([
      // Fetch categories
      this.supabase
        .from('categories')
        .select('*')
        .order('name'),

      // Fetch brands with nested fascias using Supabase JOIN
      this.supabase
        .from('brands')
        .select('id, name, fascias(id, name, brand_id, definition, created_at)')
        .order('name')
        .limit(Math.min(limit, 2000)),

      // Fetch fascia-category mappings
      this.supabase
        .from('fascia_categories')
        .select('fascia_id, category_id, is_primary')
        .order('category_id, fascia_id')
    ])

    // Check for errors
    if (categoriesResult.error) {
      console.error('Failed to fetch categories:', categoriesResult.error)
      throw new Error(`Failed to fetch categories: ${categoriesResult.error.message}`)
    }
    if (brandsResult.error) {
      console.error('Failed to fetch brands:', brandsResult.error)
      throw new Error(`Failed to fetch brands: ${brandsResult.error.message}`)
    }
    if (mappingsResult.error) {
      console.error('Failed to fetch mappings:', mappingsResult.error)
      throw new Error(`Failed to fetch mappings: ${mappingsResult.error.message}`)
    }

    // Sort fascias within each brand by name (Supabase doesn't support ordering nested relations easily)
    const brands = (brandsResult.data || []).map((brand: any) => ({
      ...brand,
      fascias: (brand.fascias || []).sort((a: Fascia, b: Fascia) =>
        a.name.localeCompare(b.name)
      )
    }))

    return {
      categories: categoriesResult.data || [],
      brands,
      fasciaCategoryMappings: mappingsResult.data || []
    }
  }

  /**
   * Get fascias that are NOT present within radius of a point
   * Filters by active category/fascia selections with category hierarchy expansion
   * @param lat Latitude of center point
   * @param lon Longitude of center point
   * @param radiusMeters Radius in meters
   * @param fasciaIds Optional fascia ID filters
   * @param categoryIds Optional category ID filters (will be expanded via get_category_descendants)
   * @returns Array of missing fascias with brand/category info and nearest store distance
   */
  async getMissingFascias(
    lat: number,
    lon: number,
    radiusMeters: number,
    fasciaIds?: string[],
    categoryIds?: string[]
  ): Promise<Array<{
    fasciaId: string
    fasciaName: string
    brandId: string
    brandName: string
    categoryId: string | null
    categoryName: string | null
    nearestStoreDistance?: number
    nearestStoreName?: string
    nearestStoreTown?: string
    logoDomain: string | null
    logoUrl: string | null
  }>> {
    const { data, error } = await this.supabase.rpc('get_missing_fascias_near_point', {
      p_lat: lat,
      p_lon: lon,
      p_radius_m: radiusMeters,
      p_fascia_ids: fasciaIds || null,
      p_category_ids: categoryIds || null
    })

    if (error) {
      console.error('Failed to fetch missing fascias:', error)
      throw new Error(`Failed to fetch missing fascias: ${error.message}`)
    }

    const rows = data || []

    // Best-effort brand-logo lookup: logos are decorative, so a failure here must
    // not break the Assess Area sidebar. Enrich by brand ID (unbounded per-request,
    // unlike the capped reference-data endpoint), mirroring the nearby-stores route.
    const brandLogoById = new Map<string, { domain: string | null; logo_url: string | null }>()
    const brandIds = Array.from(
      new Set(rows.map((row: any) => row.brand_id).filter(Boolean))
    )
    if (brandIds.length > 0) {
      const { data: brandRows, error: brandError } = await this.supabase
        .from('brands')
        .select('id, domain, logo_url')
        .in('id', brandIds)
      if (brandError) {
        console.error('Failed to fetch brand logos for missing fascias:', brandError)
      } else {
        for (const brand of brandRows || []) {
          brandLogoById.set(brand.id, {
            domain: brand.domain ?? null,
            logo_url: brand.logo_url ?? null,
          })
        }
      }
    }

    // Map snake_case to camelCase
    return rows.map((row: any) => {
      const logo = brandLogoById.get(row.brand_id)
      return {
        fasciaId: row.fascia_id,
        fasciaName: row.fascia_name,
        brandId: row.brand_id,
        brandName: row.brand_name,
        categoryId: row.category_id,
        categoryName: row.category_name,
        nearestStoreDistance: row.nearest_store_distance,
        nearestStoreName: row.nearest_store_name,
        nearestStoreTown: row.nearest_store_town,
        logoDomain: logo?.domain ?? null,
        logoUrl: logo?.logo_url ?? null,
      }
    })
  }

  /**
   * Get stores within radius of a point (for Assess Area mode)
   * Uses PostGIS ST_DWithin for spatial query
   * @param lat Latitude of center point
   * @param lon Longitude of center point
   * @param radiusMeters Radius in meters
   * @param fasciaIds Optional fascia ID filters
   * @param categoryIds Optional category ID filters
   * @param legacyBrandIds Optional brand ID filters kept for older callers
   * @returns Array of stores within radius
   */
  async getStoresNearPoint(
    lat: number,
    lon: number,
    radiusMeters: number,
    fasciaIds?: string[],
    categoryIds?: string[],  // Category IDs (UUIDs)
    legacyBrandIds?: string[]
  ): Promise<Store[]> {
    // Use PostGIS RPC function for spatial query
    let query = this.supabase.rpc('get_stores_near_point', {
      p_lat: lat,
      p_lon: lon,
      p_radius_m: radiusMeters
    })

    const selectedFasciaIds = new Set(fasciaIds || [])

    if (categoryIds && categoryIds.length > 0) {
      // Join with fascia_categories for category filtering
      const { data: categoryFascias } = await this.supabase
        .from('fascia_categories')
        .select('fascia_id')
        .in('category_id', categoryIds)

      categoryFascias?.forEach((f: any) => selectedFasciaIds.add(f.fascia_id))
    }

    if (selectedFasciaIds.size > 0) {
      query = query.in('fascia_id', Array.from(selectedFasciaIds))
    } else if (categoryIds && categoryIds.length > 0) {
      query = query.eq('fascia_id', '00000000-0000-0000-0000-000000000000')
    } else if (legacyBrandIds && legacyBrandIds.length > 0) {
      query = query.in('brand_id', legacyBrandIds)
    }

    const { data, error } = await query.limit(1000)

    if (error) {
      console.error('Failed to fetch nearby stores:', error)
      throw new Error(`Failed to fetch nearby stores: ${error.message}`)
    }

    return data || []
  }

  /**
   * Get filtered gsscodes using the new expression-based database function
   * This function properly evaluates AND/OR connectors between rules
   * @param filterSet FilterSet with rules and connectors
   * @param minPop Minimum population
   * @param maxPop Maximum population
   * @returns Array of matching gsscodes and total count
   */
  async getFilteredGssCodesWithExpression(
    filterSet: FilterSet,
    minPop: number,
    maxPop: number
  ): Promise<{ gsscodes: string[], total: number }> {
    console.log('✅ [Expression Filter] Using new filter_buas_with_expression function')

    const normalizedFilterSet = this.normalizeFilterSet(filterSet)

    if (normalizedFilterSet.rules.length === 0) {
      return this.getAllGssCodesInPopulationRange(minPop, maxPop)
    }

    const allGsscodes: string[] = []
    let offset = 0
    const pageSize = 1000
    let hasMore = true

    while (hasMore) {
      const { data, error } = await this.supabase
        .rpc('filter_buas_with_expression', {
          p_filter_expression: normalizedFilterSet,
          p_min_pop: minPop,
          p_max_pop: maxPop
        })
        .range(offset, offset + pageSize - 1)

      if (error) {
        console.error('Failed to get filtered gsscodes with expression:', error)
        throw new Error(`Failed to get filtered gsscodes: ${error.message}`)
      }

      const gsscodes = (data || []).map((row: any) => row.gsscode)
      allGsscodes.push(...gsscodes)

      hasMore = gsscodes.length === pageSize
      offset += pageSize

      console.log(`✅ [Expression Filter] Page ${Math.floor(offset / pageSize)}: ${gsscodes.length} BUAs (total: ${allGsscodes.length})`)
    }

    console.log(`✅ [Expression Filter] Total: ${allGsscodes.length} matching BUAs`)

    return {
      gsscodes: allGsscodes,
      total: allGsscodes.length
    }
  }

  private normalizeFilterSet(filterSet: FilterSet): FilterSet {
    const rules = (filterSet.rules || [])
      .filter(rule => Array.isArray(rule.targetIds) && rule.targetIds.length > 0)
      .map((rule, index, validRules) => ({
        ...rule,
        connector: index < validRules.length - 1 ? (rule.connector || 'and') : undefined
      }))

    return { rules }
  }

  private async getAllGssCodesInPopulationRange(
    minPop: number,
    maxPop: number
  ): Promise<{ gsscodes: string[], total: number }> {
    const allGsscodes: string[] = []
    let offset = 0
    const pageSize = 1000
    let hasMore = true

    while (hasMore) {
      const { data, error } = await this.supabase
        .from('built_up_areas')
        .select('gsscode, pop_final')
        .gte('pop_final', minPop)
        .lte('pop_final', maxPop)
        .order('pop_final', { ascending: false, nullsLast: true })
        .range(offset, offset + pageSize - 1)

      if (error) {
        console.error('Failed to get gsscodes in population range:', error)
        throw new Error(`Failed to get gsscodes in population range: ${error.message}`)
      }

      const gsscodes = (data || []).map((row: any) => row.gsscode)
      allGsscodes.push(...gsscodes)

      hasMore = gsscodes.length === pageSize
      offset += pageSize
    }

    return {
      gsscodes: allGsscodes,
      total: allGsscodes.length
    }
  }

  /**
   * Filter BUAs using AND logic for rules with matchingLogic='all'
   * This is a post-filter step because the RPC function only supports OR logic
   * @param gsscodes Array of BUA gsscodes from initial filter
   * @param andLogicRules Rules that require ALL targets to be present
   * @returns Filtered array of gsscodes
   * @deprecated No longer needed with new expression-based filtering
   */

  /**
   * Convert new FilterSet format to legacy filter format
   * This allows backward compatibility while supporting the new advanced filtering system
   * @param filterSet New FilterSet format
   * @returns Legacy filter format
   * @deprecated Use getFilteredGssCodesWithExpression instead for proper connector support
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
    // Pass filters directly to getFilteredGssCodes - it will handle FilterSet vs legacy
    const { gsscodes: allMatchingGsscodes, total } = await this.getFilteredGssCodes(filters)

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
      matchAll?: boolean
    }>
    nearbyInclude?: Array<{
      brandIds?: string[]  // Fascia IDs (UUIDs)
      categoryIds?: string[]  // Category IDs (UUIDs)
      distance: number
      matchAll?: boolean
    }>
    // NEW: Match-all flags for AND logic support
    includeBrandsMatchAll?: boolean
    includeCategoriesMatchAll?: boolean
    excludeBrandsMatchAll?: boolean
    excludeCategoriesMatchAll?: boolean
    // NEW: Advanced filter format
    filterSet?: FilterSet
  }): Promise<{ gsscodes: string[], total: number }> {
    // NEW: If filterSet is provided, use the new expression-based function
    if (filters.filterSet) {
      return this.getFilteredGssCodesWithExpression(
        filters.filterSet,
        filters.minPop,
        filters.maxPop
      )
    }

    // LEGACY: Fall back to old conversion for backward compatibility
    const actualFilters = filters
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

    // TODO: POST-FILTER: If filterSet has AND logic, we need to manually filter results
    // This feature is not yet implemented
    // if (filters.filterSet && filters.filterSet.rules) {
    //   const andLogicRules = filters.filterSet.rules.filter(
    //     (rule: FilterRule) => rule.matchingLogic === 'all' && rule.targetIds.length > 1 && rule.operator === 'has'
    //   )
    //
    //   if (andLogicRules.length > 0) {
    //     console.log(`⚙️ [Map Filter] Applying client-side AND logic for ${andLogicRules.length} rule(s)`)
    //     const filteredGsscodes = await this.filterBUAsWithAndLogic(allGsscodes, andLogicRules)
    //     console.log(`✅ [Map Filter] After AND logic: ${filteredGsscodes.length} BUAs (was ${allGsscodes.length})`)
    //     return { gsscodes: filteredGsscodes, total: filteredGsscodes.length }
    //   }
    // }

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

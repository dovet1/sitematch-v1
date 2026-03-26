/**
 * Store Service - Abstracts Supabase queries for store and gap analysis data
 * Uses precomputed summary tables for fast filtering
 */

import { createServerClient } from '@/lib/supabase'
import type { Category, Brand, Store } from '@/lib/stores'

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
   * Find gaps - BUAs matching complex filter criteria
   * Uses precomputed bua_store_presence and bua_store_nearby tables for performance
   * @param filters Complex filter object
   * @returns Array of matching BUAs ordered by population descending
   */
  async findGaps(filters: {
    minPop: number
    maxPop: number
    includeBrands?: string[]  // Fascia IDs (UUIDs)
    includeCategories?: string[]  // Category IDs (UUIDs)
    excludeBrands?: string[]  // Fascia IDs (UUIDs)
    excludeCategories?: string[]  // Category IDs (UUIDs)
    nearbyExclude?: Array<{
      brandIds?: string[]  // Fascia IDs (UUIDs)
      categoryIds?: string[]  // Category IDs (UUIDs)
      distance: number
    }>
  }): Promise<{ results: any[], total: number }> {
    // Always use RPC function for consistent population filtering logic
    // (RPC handles the special case where minPop < 5000 includes all BUAs with pop < 5000)
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
   * @param filters Complex filter object
   * @returns Array of matching gsscodes and total count
   */
  async getFilteredGssCodes(filters: {
    minPop: number
    maxPop: number
    includeBrands?: string[]  // Fascia IDs (UUIDs)
    includeCategories?: string[]  // Category IDs (UUIDs)
    excludeBrands?: string[]  // Fascia IDs (UUIDs)
    excludeCategories?: string[]  // Category IDs (UUIDs)
    nearbyExclude?: Array<{
      brandIds?: string[]  // Fascia IDs (UUIDs)
      categoryIds?: string[]  // Category IDs (UUIDs)
      distance: number
    }>
  }): Promise<{ gsscodes: string[], total: number }> {
    // Call the Supabase RPC function for efficient server-side filtering
    // NOTE: Supabase's default max-rows is 1000. To get all results, we need to paginate.
    // Since we can't override the limit for RPC calls easily, we'll paginate through results.

    // Transform proximity exclusion rules into JSONB format for RPC
    let nearbyExcludeFascias: any[] | null = null
    let nearbyExcludeCategories: any[] | null = null

    if (filters.nearbyExclude && filters.nearbyExclude.length > 0) {
      // Group by fascias vs categories
      const fasciaRules = filters.nearbyExclude
        .filter(rule => rule.brandIds && rule.brandIds.length > 0)
        .map(rule => ({
          distance_m: rule.distance,
          ids: rule.brandIds
        }))

      const categoryRules = filters.nearbyExclude
        .filter(rule => rule.categoryIds && rule.categoryIds.length > 0)
        .map(rule => ({
          distance_m: rule.distance,
          ids: rule.categoryIds
        }))

      nearbyExcludeFascias = fasciaRules.length > 0 ? fasciaRules : null
      nearbyExcludeCategories = categoryRules.length > 0 ? categoryRules : null
    }

    const allGsscodes: string[] = []
    let offset = 0
    const pageSize = 1000
    let hasMore = true

    while (hasMore) {
      const { data, error } = await this.supabase
        .rpc('get_filtered_bua_gsscodes', {
          p_min_pop: filters.minPop,
          p_max_pop: filters.maxPop,
          p_include_fascias: filters.includeBrands && filters.includeBrands.length > 0 ? filters.includeBrands : null,
          p_include_categories: filters.includeCategories && filters.includeCategories.length > 0 ? filters.includeCategories : null,
          p_exclude_fascias: filters.excludeBrands && filters.excludeBrands.length > 0 ? filters.excludeBrands : null,
          p_exclude_categories: filters.excludeCategories && filters.excludeCategories.length > 0 ? filters.excludeCategories : null,
          p_nearby_exclude_fascias: nearbyExcludeFascias,
          p_nearby_exclude_categories: nearbyExcludeCategories
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

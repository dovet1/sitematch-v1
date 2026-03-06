/**
 * Store Service - Abstracts Supabase queries for store and gap analysis data
 * Uses precomputed summary tables for fast filtering
 */

import { createServerClient } from '@/lib/supabase-server'
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
    if (query.length < 2) {
      return []
    }

    const { data, error } = await this.supabase
      .from('brands')
      .select('*')
      .ilike('name', `%${query}%`)
      .order('name')
      .limit(Math.min(limit, 100))

    if (error) {
      console.error('Failed to search brands:', error)
      throw new Error(`Failed to search brands: ${error.message}`)
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
    brandIds?: number[],
    categoryIds?: number[]
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
    includeBrands?: number[]
    includeCategories?: number[]
    excludeBrands?: number[]
    excludeCategories?: number[]
    nearbyExclude?: Array<{
      brandIds?: number[]
      categoryIds?: number[]
      distance: number
    }>
  }): Promise<any[]> {
    let query = this.supabase
      .from('built_up_areas')
      .select('gsscode, name, pop, pop_band, centroid_lat, centroid_lon')
      .gte('pop', filters.minPop)
      .lte('pop', filters.maxPop)

    // Include filters: BUAs that HAVE these stores
    if (filters.includeBrands && filters.includeBrands.length > 0) {
      const { data: buaCodes } = await this.supabase
        .from('bua_store_presence')
        .select('bua_gsscode')
        .in('brand_id', filters.includeBrands)

      if (buaCodes && buaCodes.length > 0) {
        const gsscodesToInclude = buaCodes.map((b: any) => b.bua_gsscode)
        query = query.in('gsscode', gsscodesToInclude)
      } else {
        // No BUAs have these brands, return empty
        return []
      }
    }

    if (filters.includeCategories && filters.includeCategories.length > 0) {
      const { data: buaCodes } = await this.supabase
        .from('bua_store_presence')
        .select('bua_gsscode')
        .in('category_id', filters.includeCategories)

      if (buaCodes && buaCodes.length > 0) {
        const gsscodesToInclude = buaCodes.map((b: any) => b.bua_gsscode)
        query = query.in('gsscode', gsscodesToInclude)
      } else {
        // No BUAs have these categories, return empty
        return []
      }
    }

    // Exclude filters: BUAs that DON'T have these stores
    if (filters.excludeBrands && filters.excludeBrands.length > 0) {
      const { data: buaCodes } = await this.supabase
        .from('bua_store_presence')
        .select('bua_gsscode')
        .in('brand_id', filters.excludeBrands)

      if (buaCodes && buaCodes.length > 0) {
        const gsscodesToExclude = buaCodes.map((b: any) => b.bua_gsscode)
        query = query.not('gsscode', 'in', gsscodesToExclude)
      }
    }

    if (filters.excludeCategories && filters.excludeCategories.length > 0) {
      const { data: buaCodes } = await this.supabase
        .from('bua_store_presence')
        .select('bua_gsscode')
        .in('category_id', filters.excludeCategories)

      if (buaCodes && buaCodes.length > 0) {
        const gsscodesToExclude = buaCodes.map((b: any) => b.bua_gsscode)
        query = query.not('gsscode', 'in', gsscodesToExclude)
      }
    }

    // Proximity exclusion: BUAs that DON'T have stores within X km
    if (filters.nearbyExclude && filters.nearbyExclude.length > 0) {
      for (const exclude of filters.nearbyExclude) {
        if (exclude.brandIds && exclude.brandIds.length > 0) {
          const { data: buaCodes } = await this.supabase
            .from('bua_store_nearby')
            .select('bua_gsscode')
            .eq('distance_m', exclude.distance)
            .in('brand_id', exclude.brandIds)

          if (buaCodes && buaCodes.length > 0) {
            const gsscodesToExclude = buaCodes.map((b: any) => b.bua_gsscode)
            query = query.not('gsscode', 'in', gsscodesToExclude)
          }
        }

        if (exclude.categoryIds && exclude.categoryIds.length > 0) {
          const { data: buaCodes } = await this.supabase
            .from('bua_store_nearby')
            .select('bua_gsscode')
            .eq('distance_m', exclude.distance)
            .in('category_id', exclude.categoryIds)

          if (buaCodes && buaCodes.length > 0) {
            const gsscodesToExclude = buaCodes.map((b: any) => b.bua_gsscode)
            query = query.not('gsscode', 'in', gsscodesToExclude)
          }
        }
      }
    }

    query = query.order('pop', { ascending: false }).limit(1000)

    const { data, error } = await query

    if (error) {
      console.error('Failed to find gaps:', error)
      throw new Error(`Failed to find gaps: ${error.message}`)
    }

    return data || []
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

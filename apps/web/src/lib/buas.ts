import { createServerClient } from '@/lib/supabase'
import type { Database } from '@/lib/supabase'

export interface BUA {
  gsscode: string
  name: string
  pop: number  // Legacy - use pop_final instead
  pop_final: number | null
  pop_official: number | null
  pop_band: string
  centroid_lat: number
  centroid_lon: number
}

export class BUAService {
  private supabase: any

  constructor(supabaseClient: any) {
    this.supabase = supabaseClient
  }

  /**
   * Search for BUAs by name using case-insensitive pattern matching
   * @param query Search query (minimum 2 characters)
   * @param limit Maximum number of results (default 20)
   * @returns Array of BUA records ordered by population descending
   */
  async searchBUAs(query: string, limit = 20): Promise<BUA[]> {
    if (query.length < 2) {
      return []
    }

    const { data, error } = await this.supabase
      .from('built_up_areas')
      .select('gsscode, name, pop, pop_final, pop_official, pop_band, centroid_lat, centroid_lon')
      .ilike('name', `%${query}%`)
      .order('pop_final', { ascending: false, nullsLast: true })
      .limit(Math.min(limit, 100))

    if (error) {
      console.error('BUA search error:', error)
      throw new Error(`Failed to search BUAs: ${error.message}`)
    }

    return data || []
  }

  /**
   * Get a single BUA by its GSS code
   * @param gsscode ONS GSS code for the BUA
   * @returns BUA record or null if not found
   */
  async getBUAByCode(gsscode: string): Promise<BUA | null> {
    const { data, error } = await this.supabase
      .from('built_up_areas')
      .select('gsscode, name, pop, pop_final, pop_official, pop_band, centroid_lat, centroid_lon')
      .eq('gsscode', gsscode)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        // Not found
        return null
      }
      console.error('BUA lookup error:', error)
      throw new Error(`Failed to fetch BUA: ${error.message}`)
    }

    return data
  }

  /**
   * Get BUAs within a population range
   * @param minPop Minimum population
   * @param maxPop Maximum population
   * @param limit Maximum number of results
   * @returns Array of BUA records
   */
  async getByPopulationRange(
    minPop: number,
    maxPop: number,
    limit = 100
  ): Promise<BUA[]> {
    const { data, error } = await this.supabase
      .from('built_up_areas')
      .select('gsscode, name, pop, pop_final, pop_official, pop_band, centroid_lat, centroid_lon')
      .gte('pop_final', minPop)
      .lte('pop_final', maxPop)
      .order('pop_final', { ascending: false, nullsLast: true })
      .limit(Math.min(limit, 1000))

    if (error) {
      console.error('BUA range query error:', error)
      throw new Error(`Failed to query BUAs: ${error.message}`)
    }

    return data || []
  }
}

/**
 * Create a BUA service instance with server-side Supabase client
 * Use this in API routes and server components
 */
export async function createBUAService() {
  const supabaseClient = await createServerClient()
  return new BUAService(supabaseClient)
}

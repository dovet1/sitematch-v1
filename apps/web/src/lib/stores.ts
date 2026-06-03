/**
 * TypeScript interfaces for store-related Supabase tables
 * These match the actual database schema for the Gap Analysis feature
 */

export interface Category {
  id: string  // UUID in database
  name: string
  parent_category_id: string | null  // UUID in database
  created_at: string
}

export interface Brand {
  id: string  // UUID in database
  name: string
  created_at: string
}

export interface Fascia {
  id: string  // UUID in database
  brand_id: string  // UUID in database
  name: string
  definition: string | null
  created_at: string
}

export interface FasciaCategory {
  fascia_id: string  // UUID in database
  category_id: string  // UUID in database
  is_primary: boolean
  created_at: string
}

export interface Store {
  id: string  // UUID in database
  store_id: string
  brand_id: string  // UUID in database
  fascia_id: string  // UUID in database
  fascia_name?: string | null
  name: string
  lon: number
  lat: number
  location: string  // PostGIS geography
  postcode: string | null
  town: string | null
  suburb: string | null
  county: string | null
  address_line_1: string | null
  address_line_2: string | null
  pqi: number | null
  open_date: string | null
  size_band: string | null
  created_at: string
}

export interface ViewportStore {
  id: string
  store_id: string | number
  brand_id: string
  fascia_id: string
  fascia_name?: string | null
  name: string
  lat: number
  lon: number
  location?: string
  postcode?: string | null
  town?: string | null
  suburb?: string | null
  county?: string | null
  address_line_1?: string | null
  address_line_2?: string | null
  pqi?: number | null
  open_date?: string | null
  size_band?: string | null
  created_at?: string
  matchedTargetIds?: string[]
  displayTargetIds?: string[]
}

export interface BUAStorePresence {
  bua_gsscode: string
  category_id: string  // UUID in database
  brand_id: string  // UUID in database
  fascia_id: string  // UUID in database
  store_count: number
  created_at: string
}

export interface BUAStoreNearby {
  bua_gsscode: string
  distance_m: number  // 1000, 3000, 5000, or 10000
  category_id: string  // UUID in database
  brand_id: string  // UUID in database
  fascia_id: string  // UUID in database
  store_count: number
  created_at: string
}

export interface MissingFasciaInfo {
  fasciaId: string
  fasciaName: string
  brandId: string
  brandName: string
  categoryId: string | null
  categoryName: string | null
  nearestStoreDistance?: number  // meters
  nearestStoreName?: string
  nearestStoreTown?: string
}

export interface ComparisonData {
  missingInAOnly: MissingFasciaInfo[]
  missingInBOnly: MissingFasciaInfo[]
  missingInBoth: MissingFasciaInfo[]
}

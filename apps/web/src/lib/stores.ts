/**
 * TypeScript interfaces for store-related Supabase tables
 * These match the actual database schema for the Gap Analysis feature
 */

export interface Category {
  id: number
  name: string
  parent_category_id: number | null
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
  fascia_id: number
  category_id: number
  is_primary: boolean
  created_at: string
}

export interface Store {
  id: string  // UUID in database
  store_id: string
  brand_id: string  // UUID in database
  fascia_id: string  // UUID in database
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

export interface BUAStorePresence {
  bua_gsscode: string
  category_id: number
  brand_id: number
  fascia_id: number
  store_count: number
  created_at: string
}

export interface BUAStoreNearby {
  bua_gsscode: string
  distance_m: number  // 1000, 3000, 5000, or 10000
  category_id: number
  brand_id: number
  fascia_id: number
  store_count: number
  created_at: string
}

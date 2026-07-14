import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { createBrowserClient, createServerClient as createSSRServerClient } from '@supabase/ssr'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables!')
  throw new Error('Supabase environment variables are not configured')
}

// Create a new browser client instance each time for fresh auth state
export const createClientClient = () => createBrowserClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    flowType: 'pkce',
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: typeof window !== 'undefined' ? window.localStorage : undefined
  }
})

// Legacy export for backward compatibility
export const browserClient = createBrowserClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    flowType: 'pkce',
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: typeof window !== 'undefined' ? window.localStorage : undefined
  }
})
export const supabase = browserClient

// Default createClient export for API routes
export const createClient = () => createBrowserClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    flowType: 'pkce',
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: typeof window !== 'undefined' ? window.localStorage : undefined
  }
})

// Server component client (for use in Server Components and API Routes)
export const createServerClient = async () => {
  try {
    const { cookies } = require('next/headers')
    const cookieStore = await cookies()

    return createSSRServerClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        cookies: {
          get(name: string) {
            try {
              return cookieStore.get(name)?.value
            } catch (error) {
              // Silently fail during build/static generation
              return undefined
            }
          },
          set(name: string, value: string, options: any) {
            try {
              cookieStore.set({ name, value, ...options })
            } catch (error) {
              // Silently fail during build/static generation
            }
          },
          remove(name: string, options: any) {
            try {
              cookieStore.set({ name, value: '', ...options })
            } catch (error) {
              // Silently fail during build/static generation
            }
          },
        },
      }
    )
  } catch (error) {
    // Silently fall back to browser client during build/static generation
    // This is expected when cookies() is called during static page generation
    return createBrowserClient(supabaseUrl, supabaseAnonKey)
  }
}

// Admin client (server-side only)
export const createAdminClient = () => {
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createSupabaseClient<Database>(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
}

// Database type definitions
export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          role: 'occupier' | 'admin'
          user_type: 'Commercial Occupier' | 'Landlord/developer' | 'Housebuilder' | 'Agent' | 'Consultant' | 'Government' | 'Other' | null
          user_company_name: string | null
          org_id: string | null
          subscription_status: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          newsletter_opt_in: boolean | null
          hide_sitesketcher_tutorial: boolean | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          role?: 'occupier' | 'admin'
          user_type?: 'Commercial Occupier' | 'Landlord/developer' | 'Housebuilder' | 'Agent' | 'Consultant' | 'Government' | 'Other' | null
          user_company_name?: string | null
          org_id?: string | null
          subscription_status?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          newsletter_opt_in?: boolean | null
          hide_sitesketcher_tutorial?: boolean | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          role?: 'occupier' | 'admin'
          user_type?: 'Commercial Occupier' | 'Landlord/developer' | 'Housebuilder' | 'Agent' | 'Consultant' | 'Government' | 'Other' | null
          user_company_name?: string | null
          org_id?: string | null
          subscription_status?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          newsletter_opt_in?: boolean | null
          hide_sitesketcher_tutorial?: boolean | null
          updated_at?: string
        }
      }
      organisations: {
        Row: {
          id: string
          name: string
          type: 'occupier' | 'landlord' | 'agent'
          logo_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          type: 'occupier' | 'landlord' | 'agent'
          logo_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          type?: 'occupier' | 'landlord' | 'agent'
          logo_url?: string | null
          updated_at?: string
        }
      }
      leads: {
        Row: {
          id: string
          email: string
          persona: 'agent' | 'investor' | 'landlord' | 'vendor'
          created_at: string
        }
        Insert: {
          id?: string
          email: string
          persona: 'agent' | 'investor' | 'landlord' | 'vendor'
          created_at?: string
        }
        Update: {
          id?: string
          email?: string
          persona?: 'agent' | 'investor' | 'landlord' | 'vendor'
        }
      }
      listings: {
        Row: {
          id: string
          title: string
          company_name: string
          company_domain: string | null
          clearbit_logo: boolean | null
          description: string | null
          sector_id: string
          use_class_id: string
          site_size_min: number | null
          site_size_max: number | null
          contact_name: string
          contact_title: string
          contact_email: string
          contact_phone: string | null
          brochure_url: string | null
          status: 'draft' | 'pending' | 'approved' | 'rejected' | 'archived'
          rejection_reason: string | null
          created_by: string
          created_at: string
          updated_at: string
          org_id: string | null
          linked_agency_id: string | null
        }
        Insert: {
          id?: string
          title: string
          company_name: string
          company_domain?: string | null
          clearbit_logo?: boolean | null
          description?: string | null
          sector_id: string
          use_class_id: string
          site_size_min?: number | null
          site_size_max?: number | null
          contact_name: string
          contact_title: string
          contact_email: string
          contact_phone?: string | null
          brochure_url?: string | null
          status?: 'draft' | 'pending' | 'approved' | 'rejected' | 'archived'
          rejection_reason?: string | null
          created_by: string
          created_at?: string
          updated_at?: string
          org_id?: string | null
          linked_agency_id?: string | null
        }
        Update: {
          id?: string
          title?: string
          company_name?: string
          company_domain?: string | null
          clearbit_logo?: boolean | null
          description?: string | null
          sector_id?: string
          use_class_id?: string
          site_size_min?: number | null
          site_size_max?: number | null
          contact_name?: string
          contact_title?: string
          contact_email?: string
          contact_phone?: string | null
          brochure_url?: string | null
          status?: 'draft' | 'pending' | 'approved' | 'rejected' | 'archived'
          rejection_reason?: string | null
          updated_at?: string
          org_id?: string | null
          linked_agency_id?: string | null
        }
      }
      sectors: {
        Row: {
          id: string
          name: string
          description: string | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
        }
      }
      use_classes: {
        Row: {
          id: string
          code: string
          name: string
          description: string | null
          created_at: string
        }
        Insert: {
          id?: string
          code: string
          name: string
          description?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          code?: string
          name?: string
          description?: string | null
        }
      }
      site_sketches: {
        Row: {
          id: string
          user_id: string
          name: string
          description: string | null
          data: any // JSONB
          thumbnail_url: string | null
          location: any | null // JSONB
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          description?: string | null
          data: any
          thumbnail_url?: string | null
          location?: any | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          data?: any
          thumbnail_url?: string | null
          location?: any | null
          updated_at?: string
        }
      }
      shared_cads: {
        Row: {
          id: string
          created_by: string | null
          name: string
          file_name: string
          url: string
          storage_path: string
          metres_per_pixel: number
          image_width_px: number
          image_height_px: number
          calibration_points: any | null // JSONB
          brand: string
          format: string
          source_store: string
          survey_year: number
          gia_sqm: number | null
          dims_label: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          created_by?: string | null
          name: string
          file_name: string
          url: string
          storage_path: string
          metres_per_pixel: number
          image_width_px: number
          image_height_px: number
          calibration_points?: any | null
          brand: string
          format: string
          source_store: string
          survey_year: number
          gia_sqm?: number | null
          dims_label?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          created_by?: string | null
          name?: string
          file_name?: string
          url?: string
          storage_path?: string
          metres_per_pixel?: number
          image_width_px?: number
          image_height_px?: number
          calibration_points?: any | null
          brand?: string
          format?: string
          source_store?: string
          survey_year?: number
          gia_sqm?: number | null
          dims_label?: string | null
          updated_at?: string
        }
      }
      listing_versions: {
        Row: {
          id: string
          listing_id: string
          content: any // JSONB
          status: string
          is_live: boolean
          reviewed_by: string | null
          reviewed_at: string | null
          review_notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          listing_id: string
          content: any
          status?: string
          is_live?: boolean
          reviewed_by?: string | null
          reviewed_at?: string | null
          review_notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          listing_id?: string
          content?: any
          status?: string
          is_live?: boolean
          reviewed_by?: string | null
          reviewed_at?: string | null
          review_notes?: string | null
          updated_at?: string
        }
      }
      built_up_areas: {
        Row: {
          gsscode: string
          name: string
          pop: number
          pop_final: number | null
          pop_official: number | null
          name_clean: string | null
          pop_band: string
          centroid_lat: number
          centroid_lon: number
          centroid: string | null
          created_at: string | null
        }
        Insert: {
          gsscode: string
          name: string
          pop: number
          pop_final?: number | null
          pop_official?: number | null
          name_clean?: string | null
          pop_band: string
          centroid_lat: number
          centroid_lon: number
          created_at?: string | null
        }
        Update: {
          gsscode?: string
          name?: string
          pop?: number
          pop_final?: number | null
          pop_official?: number | null
          name_clean?: string | null
          pop_band?: string
          centroid_lat?: number
          centroid_lon?: number
        }
      }
      requirements: {
        Row: {
          id: string
          brand_id: string | null
          company_name: string
          title: string | null
          description: string | null
          listing_type: string | null
          site_size_min: number | null
          site_size_max: number | null
          site_acreage_min: number | null
          site_acreage_max: number | null
          dwelling_count_min: number | null
          dwelling_count_max: number | null
          brochure_url: string | null
          property_page_link: string | null
          company_domain: string | null
          clearbit_logo: boolean
          is_featured_free: boolean
          verified_at: string | null
          status: string
          source_listing_id: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          brand_id?: string | null
          company_name: string
          title?: string | null
          description?: string | null
          listing_type?: string | null
          site_size_min?: number | null
          site_size_max?: number | null
          site_acreage_min?: number | null
          site_acreage_max?: number | null
          dwelling_count_min?: number | null
          dwelling_count_max?: number | null
          brochure_url?: string | null
          property_page_link?: string | null
          company_domain?: string | null
          clearbit_logo?: boolean
          is_featured_free?: boolean
          verified_at?: string | null
          status?: string
          source_listing_id?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          brand_id?: string | null
          company_name?: string
          title?: string | null
          description?: string | null
          listing_type?: string | null
          site_size_min?: number | null
          site_size_max?: number | null
          site_acreage_min?: number | null
          site_acreage_max?: number | null
          dwelling_count_min?: number | null
          dwelling_count_max?: number | null
          brochure_url?: string | null
          property_page_link?: string | null
          company_domain?: string | null
          clearbit_logo?: boolean
          is_featured_free?: boolean
          verified_at?: string | null
          status?: string
          source_listing_id?: string | null
          created_by?: string | null
          updated_at?: string
        }
      }
      requirement_locations: {
        Row: {
          id: string
          requirement_id: string
          place_name: string | null
          formatted_address: string | null
          coordinates: any | null
          region: string | null
          country: string | null
          created_at: string
        }
        Insert: {
          id?: string
          requirement_id: string
          place_name?: string | null
          formatted_address?: string | null
          coordinates?: any | null
          region?: string | null
          country?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          requirement_id?: string
          place_name?: string | null
          formatted_address?: string | null
          coordinates?: any | null
          region?: string | null
          country?: string | null
        }
      }
      requirement_contacts: {
        Row: {
          id: string
          requirement_id: string
          contact_name: string | null
          contact_title: string | null
          contact_email: string | null
          contact_phone: string | null
          contact_area: string | null
          headshot_url: string | null
          is_primary_contact: boolean
          created_at: string
        }
        Insert: {
          id?: string
          requirement_id: string
          contact_name?: string | null
          contact_title?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          contact_area?: string | null
          headshot_url?: string | null
          is_primary_contact?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          requirement_id?: string
          contact_name?: string | null
          contact_title?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          contact_area?: string | null
          headshot_url?: string | null
          is_primary_contact?: boolean
        }
      }
      requirement_sectors: {
        Row: {
          id: string
          requirement_id: string
          sector_id: string
          created_at: string
        }
        Insert: {
          id?: string
          requirement_id: string
          sector_id: string
          created_at?: string
        }
        Update: {
          id?: string
          requirement_id?: string
          sector_id?: string
        }
      }
      requirement_use_classes: {
        Row: {
          id: string
          requirement_id: string
          use_class_id: string
          created_at: string
        }
        Insert: {
          id?: string
          requirement_id: string
          use_class_id: string
          created_at?: string
        }
        Update: {
          id?: string
          requirement_id?: string
          use_class_id?: string
        }
      }
    }
  }
}
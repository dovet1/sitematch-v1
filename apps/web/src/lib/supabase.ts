import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { createBrowserClient, createServerClient as createSSRServerClient } from '@supabase/ssr'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables!')
  throw new Error('Supabase environment variables are not configured')
}

// Create a new browser client instance each time for fresh auth state
export const createClientClient = () => createBrowserClient(supabaseUrl, supabaseAnonKey)

// Legacy export for backward compatibility
export const browserClient = createBrowserClient(supabaseUrl, supabaseAnonKey)
export const supabase = browserClient

// Default createClient export for API routes
export const createClient = () => createBrowserClient(supabaseUrl, supabaseAnonKey)

// Server component client (for use in Server Components and API Routes)
export const createServerClient = () => {
  try {
    const { cookies } = require('next/headers')
    const cookieStore = cookies()
    
    return createSSRServerClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        cookies: {
          get(name: string) {
            try {
              return cookieStore.get(name)?.value
            } catch (error) {
              console.warn('Error getting cookie:', name, error)
              return undefined
            }
          },
          set(name: string, value: string, options: any) {
            try {
              cookieStore.set({ name, value, ...options })
            } catch (error) {
              console.warn('Error setting cookie:', name, error)
            }
          },
          remove(name: string, options: any) {
            try {
              cookieStore.set({ name, value: '', ...options })
            } catch (error) {
              console.warn('Error removing cookie:', name, error)
            }
          },
        },
      }
    )
  } catch (error) {
    console.error('Error creating server client:', error)
    // Fallback to regular client if server client fails
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
          user_type: 'Commercial Occupier' | 'Housebuilder' | 'Consultant' | 'Landlord/Vendor' | 'Developer' | 'Government' | 'Other'
          org_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          role?: 'occupier' | 'admin'
          user_type: 'Commercial Occupier' | 'Housebuilder' | 'Consultant' | 'Landlord/Vendor' | 'Developer' | 'Government' | 'Other'
          org_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          role?: 'occupier' | 'admin'
          user_type?: 'Commercial Occupier' | 'Housebuilder' | 'Consultant' | 'Agent' | 'Landlord/Vendor' | 'Developer' | 'Government' | 'Other'
          org_id?: string | null
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
    }
  }
}
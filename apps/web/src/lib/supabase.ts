import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { createBrowserClient, createServerClient as createSSRServerClient } from '@supabase/ssr'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables!')
  throw new Error('Supabase environment variables are not configured')
}

// Single browser client instance - used for all client-side operations
export const browserClient = createBrowserClient(supabaseUrl, supabaseAnonKey)

// Legacy export for backward compatibility - points to same instance
export const supabase = browserClient

// Export the same instance for consistency
export const createClientClient = () => browserClient

// Default createClient export for API routes
export const createClient = () => browserClient

// Server component client (for use in Server Components)
export const createServerClient = () => {
  const { cookies } = require('next/headers')
  const cookieStore = cookies()
  return createSSRServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: any) {
          try {
            cookieStore.set({ name, value, ...options })
          } catch (error) {
            // The `set` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
        remove(name: string, options: any) {
          try {
            cookieStore.set({ name, value: '', ...options })
          } catch (error) {
            // The `delete` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  )
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
          org_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          role?: 'occupier' | 'admin'
          org_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          role?: 'occupier' | 'admin'
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
        }
        Insert: {
          id?: string
          title: string
          company_name: string
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
        }
        Update: {
          id?: string
          title?: string
          company_name?: string
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
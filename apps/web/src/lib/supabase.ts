import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { createBrowserClient, createServerClient as createSSRServerClient } from '@supabase/ssr'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://nunvbolbcekvtlwuacul.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im51bnZib2xiY2VrdnRsd3VhY3VsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEyOTE1NjQsImV4cCI6MjA2Njg2NzU2NH0.jUm56NfiHXDwxf-wfeoID9_JNrpNpc_1i0On68LHoEU'

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
  return createSupabaseClient(supabaseUrl, supabaseServiceKey, {
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
      organization_audit: {
        Row: {
          id: string
          org_id: string
          action: 'created' | 'updated' | 'merged'
          metadata: Record<string, any>
          created_by: string
          created_at: string
        }
        Insert: {
          id?: string
          org_id: string
          action: 'created' | 'updated' | 'merged'
          metadata?: Record<string, any>
          created_by: string
          created_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          action?: 'created' | 'updated' | 'merged'
          metadata?: Record<string, any>
          created_by?: string
        }
      }
    }
  }
}
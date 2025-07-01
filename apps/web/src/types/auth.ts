import { User } from '@supabase/supabase-js'
import { Database } from '@/lib/supabase'

export type UserRole = 'occupier' | 'admin'
export type OrganisationType = 'occupier' | 'landlord' | 'agent'

export type DbUser = Database['public']['Tables']['users']['Row']
export type DbOrganisation = Database['public']['Tables']['organisations']['Row']

export interface AuthUser extends User {
  app_metadata: {
    role?: UserRole
    org_id?: string
  }
}

export interface UserProfile {
  id: string
  email: string
  role: UserRole
  org_id: string | null
  organisation?: DbOrganisation | null
  created_at: string
  updated_at: string
}

export interface AuthContextType {
  user: AuthUser | null
  profile: UserProfile | null
  loading: boolean
  signIn: (email: string, redirectTo?: string) => Promise<void>
  signOut: () => Promise<void>
  hasRole: (role: UserRole | UserRole[]) => boolean
  isAdmin: boolean
  isOccupier: boolean
  refresh: () => Promise<void>
}

export interface AuthState {
  user: AuthUser | null
  profile: UserProfile | null
  loading: boolean
  error: string | null
}
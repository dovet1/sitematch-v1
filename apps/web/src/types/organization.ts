import { Database } from '@/lib/supabase'

// Database types
export type Organization = Database['public']['Tables']['organisations']['Row']
export type OrganizationInsert = Database['public']['Tables']['organisations']['Insert']
export type OrganizationUpdate = Database['public']['Tables']['organisations']['Update']

// Auto-creation specific types
export interface OrganizationAutoCreationData {
  name: string
  description?: string
  type: 'occupier' // Default for auto-created orgs
  createdByUserId: string
}

export interface OrganizationCreationResult {
  success: boolean
  organizationId?: string
  organizationName?: string // May be modified for uniqueness
  error?: string
  errorCode?: 'DUPLICATE_NAME' | 'VALIDATION_ERROR' | 'DATABASE_ERROR' | 'USER_ASSIGNMENT_ERROR'
}

// Service response types
export interface UserOrganizationInfo {
  hasOrganization: boolean
  organizationId?: string
  organizationName?: string
}

export interface CreateListingWithOrgData {
  companyName: string
  companyDescription?: string
  // Additional listing data would be added here
  [key: string]: any
}

export interface CreateListingResult {
  success: boolean
  listingId?: string
  organizationId?: string
  organizationCreated?: boolean
  error?: string
}
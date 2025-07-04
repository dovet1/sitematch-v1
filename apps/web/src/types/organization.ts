import { Database } from '@/lib/supabase'

// Database types
export type Organization = Database['public']['Tables']['organisations']['Row']
export type OrganizationInsert = Database['public']['Tables']['organisations']['Insert']
export type OrganizationUpdate = Database['public']['Tables']['organisations']['Update']

// Auto-creation specific types
export interface OrganizationAutoCreationData {
  name: string
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
  // Company data for organization creation
  companyName: string
  logoFile?: File
  logoPreview?: string
  
  // Property requirements data (updated for multi-select)
  sectors?: string[]
  useClassIds?: string[]
  siteSizeMin?: number
  siteSizeMax?: number
  
  // Location data
  locations?: Array<{
    id: string;
    place_name: string;
    coordinates: [number, number];
    type: 'preferred' | 'acceptable';
    formatted_address: string;
    region?: string;
    country?: string;
  }>
  locationSearchNationwide?: boolean
  
  // File upload data
  brochureFiles?: Array<{
    id: string;
    name: string;
    url: string;
    path: string;
    type: 'brochure';
    size: number;
    mimeType: string;
    uploadedAt: Date;
  }>
  sitePlanFiles?: Array<{
    id: string;
    name: string;
    url: string;
    path: string;
    type: 'sitePlan';
    size: number;
    mimeType: string;
    uploadedAt: Date;
  }>
  fitOutFiles?: Array<{
    id: string;
    name: string;
    url: string;
    path: string;
    type: 'fitOut';
    size: number;
    mimeType: string;
    uploadedAt: Date;
  }>
  
  // Contact data
  contactName: string
  contactTitle: string
  contactEmail: string
  contactPhone?: string
}

export interface CreateListingResult {
  success: boolean
  listingId?: string
  organizationId?: string
  organizationCreated?: boolean
  error?: string
}
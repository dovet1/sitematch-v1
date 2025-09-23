// =====================================================
// Listings Types - Story 3.0
// Generated types for listings database schema
// =====================================================

import type { ListingAgentWithAgency } from './agencies';

export interface Sector {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
}

export interface UseClass {
  id: string;
  code: string;
  name: string;
  description: string | null;
  created_at: string;
}

export interface Listing {
  id: string;
  title: string;
  company_name: string;
  description: string | null;
  sector_id: string;
  use_class_id: string;
  site_size_min: number | null;
  site_size_max: number | null;
  // PRD-required contact fields
  contact_name: string;
  contact_title: string;
  contact_email: string;
  contact_phone: string | null;
  contact_area: string | null;
  // File references
  brochure_url: string | null;
  // Logo fields
  clearbit_logo: boolean;
  company_domain: string | null;
  // Listing type
  listing_type: 'residential' | 'commercial';
  status: ListingStatus;
  rejection_reason: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ListingLocation {
  id: string;
  listing_id: string;
  location_name: string;
  location_type: LocationType;
  coordinates: { lat: number; lng: number } | null;
  created_at: string;
}

export interface MediaFile {
  id: string;
  listing_id: string;
  file_type: MediaFileType;
  file_url: string;
  file_name: string;
  file_size: number;
  created_at: string;
}

export interface FAQ {
  id: string;
  listing_id: string;
  question: string;
  answer: string;
  display_order: number;
  created_at: string;
}

export interface CompanyLogo {
  id: string;
  listing_id: string;
  file_url: string;
  file_name: string;
  file_size: number;
  created_at: string;
}

export interface ListingDocument {
  id: string;
  listing_id: string;
  document_type: 'site_plan' | 'store_plan' | 'brochure';
  file_url: string;
  file_name: string;
  file_size: number;
  created_at: string;
}

export interface ListingGallery {
  id: string;
  listing_id: string;
  media_type: 'image' | 'video';
  file_url: string;
  file_name: string;
  file_size: number;
  thumbnail_url: string | null;
  display_order: number;
  created_at: string;
}

// =====================================================
// ENUMS
// =====================================================

export type ListingStatus = 'draft' | 'pending' | 'approved' | 'rejected' | 'archived';

// =====================================================
// MODERATION TYPES - Story 5.0
// =====================================================

export type RejectionReason = 
  | 'incomplete_company_info'
  | 'missing_contact_details'
  | 'unclear_requirements'
  | 'invalid_brochure'
  | 'duplicate_listing'
  | 'requirements_too_vague'
  | 'suspected_spam'
  | 'other';

export const REJECTION_REASONS: Record<RejectionReason, string> = {
  incomplete_company_info: 'Incomplete company information',
  missing_contact_details: 'Missing required contact details',
  unclear_requirements: 'Unclear property requirements',
  invalid_brochure: 'Invalid or poor quality brochure',
  duplicate_listing: 'Duplicate listing detected',
  requirements_too_vague: 'Requirements too vague or broad',
  suspected_spam: 'Suspected spam or invalid submission',
  other: 'Other (specify below)'
};

export type ModerationAction = 'approved' | 'rejected' | 'archived' | 'unarchived';

export interface ModerationLog {
  id: string;
  listing_id: string;
  admin_id: string;
  action: ModerationAction;
  reason?: string;
  created_at: string;
}

export interface ModerationRequest {
  action: ModerationAction;
  reason?: string;
  rejection_reason?: RejectionReason;
}

export interface BulkModerationRequest {
  listing_ids: string[];
  action: ModerationAction;
  reason?: string;
  rejection_reason?: RejectionReason;
}

export type LocationType = 'preferred' | 'acceptable'; // DEPRECATED - will be removed

export type MediaFileType = 'brochure' | 'logo' | 'site_plan' | 'fit_out' | 'image' | 'pdf' | 'video';

// =====================================================
// EXTENDED TYPES WITH RELATIONS
// =====================================================

export interface ListingWithDetails extends Listing {
  sector: Sector;
  use_class: UseClass;
  locations: ListingLocation[];
  media_files: MediaFile[];
  company_logos: CompanyLogo[];
  listing_documents: ListingDocument[];
  listing_galleries: ListingGallery[];
  faqs: FAQ[];
  listing_agents: ListingAgentWithAgency[];
}

// =====================================================
// API REQUEST/RESPONSE TYPES
// =====================================================

export interface CreateListingRequest {
  title: string;
  description?: string;
  company_name: string;
  sector_id: string;
  use_class_id: string;
  site_size_min?: number;
  site_size_max?: number;
  // Residential fields
  dwelling_count_min?: number;
  dwelling_count_max?: number;
  site_acreage_min?: number;
  site_acreage_max?: number;
  // PRD-required contact fields
  contact_name: string;
  contact_title: string;
  contact_email: string;
  contact_phone?: string;
  contact_area?: string;
  // File references
  brochure_url?: string;
  // Logo fields
  clearbit_logo?: boolean;
  company_domain?: string;
  // Property page link
  property_page_link?: string;
  // Listing type
  listing_type?: 'residential' | 'commercial';
  locations?: Omit<ListingLocation, 'id' | 'listing_id' | 'created_at'>[];
  media_files?: Omit<MediaFile, 'id' | 'listing_id' | 'created_at'>[];
  company_logos?: Omit<CompanyLogo, 'id' | 'listing_id' | 'created_at'>[];
  listing_documents?: Omit<ListingDocument, 'id' | 'listing_id' | 'created_at'>[];
  listing_galleries?: Omit<ListingGallery, 'id' | 'listing_id' | 'created_at'>[];
  faqs?: Omit<FAQ, 'id' | 'listing_id' | 'created_at'>[];
}

export interface UpdateListingRequest extends Partial<CreateListingRequest> {
  status?: ListingStatus;
}

export interface UpdateListingStatusRequest {
  status: ListingStatus;
  reason?: string;
}

export interface ListingsQueryParams {
  page?: number;
  limit?: number;
  status?: ListingStatus | 'all';
  sector_id?: string;
  use_class_id?: string;
  org_id?: string;
  search?: string;
  created_by?: string;
}

export interface ListingsResponse {
  data: ListingWithDetails[];
  meta: {
    total: number;
    page: number;
    limit: number;
    total_pages: number;
  };
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// =====================================================
// VALIDATION SCHEMAS
// =====================================================

export interface ListingValidationRules {
  title: {
    required: true;
    minLength: 5;
    maxLength: 200;
  };
  description: {
    maxLength: 2000;
  };
  sector_id: {
    required: true;
    format: 'uuid';
  };
  use_class_id: {
    required: true;
    format: 'uuid';
  };
  site_size_min: {
    min: 0;
    max: 10000000; // 10 million sq ft
  };
  site_size_max: {
    min: 0;
    max: 10000000;
  };
}

// =====================================================
// UTILITY TYPES
// =====================================================

export type ListingStatusFilter = ListingStatus | 'all';

export type SortField = 'created_at' | 'updated_at' | 'title' | 'status';

export type SortOrder = 'asc' | 'desc';

export interface ListingSortOptions {
  field: SortField;
  order: SortOrder;
}

// =====================================================
// FORM TYPES
// =====================================================

export interface ListingFormData extends CreateListingRequest {
  // Additional form-specific fields
  save_as_draft?: boolean;
  notify_admin?: boolean;
}

// =====================================================
// ERROR TYPES
// =====================================================

export interface ListingError {
  code: string;
  message: string;
  field?: string;
  details?: Record<string, any>;
}

export interface ValidationError extends ListingError {
  field: string;
  value: any;
  constraint: string;
}
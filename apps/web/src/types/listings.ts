// =====================================================
// Listings Types - Story 3.0
// Generated types for listings database schema
// =====================================================

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
  org_id: string;
  title: string;
  description: string | null;
  sector_id: string;
  use_class_id: string;
  site_size_min: number | null;
  site_size_max: number | null;
  brochure_url: string | null;
  status: ListingStatus;
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

// =====================================================
// ENUMS
// =====================================================

export type ListingStatus = 'draft' | 'pending' | 'approved' | 'rejected';

export type LocationType = 'preferred' | 'acceptable';

export type MediaFileType = 'brochure' | 'image' | 'pdf';

// =====================================================
// EXTENDED TYPES WITH RELATIONS
// =====================================================

export interface ListingWithDetails extends Listing {
  sector: Sector;
  use_class: UseClass;
  locations: ListingLocation[];
  media_files: MediaFile[];
  faqs: FAQ[];
}

// =====================================================
// API REQUEST/RESPONSE TYPES
// =====================================================

export interface CreateListingRequest {
  title: string;
  description?: string;
  sector_id: string;
  use_class_id: string;
  site_size_min?: number;
  site_size_max?: number;
  brochure_url?: string;
  locations?: Omit<ListingLocation, 'id' | 'listing_id' | 'created_at'>[];
  media_files?: Omit<MediaFile, 'id' | 'listing_id' | 'created_at'>[];
  faqs?: Omit<FAQ, 'id' | 'listing_id' | 'created_at'>[];
}

export interface UpdateListingRequest extends Partial<CreateListingRequest> {
  id: string;
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
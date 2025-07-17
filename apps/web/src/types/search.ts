// Search and filter types for Story 4.0

export interface SearchFilters {
  location: string;
  coordinates: { lat: number; lng: number } | null;
  companyName: string;
  sector: string[];
  useClass: string[];
  sizeMin: number | null;
  sizeMax: number | null;
  isNationwide: boolean;
}

export interface SearchResult {
  id: string;
  company_name: string;
  title: string;
  description: string;
  site_size_min: number | null;
  site_size_max: number | null;
  // Multiple sectors and use classes from junction tables
  sectors: Array<{ id: string; name: string }>;
  use_classes: Array<{ id: string; name: string; code: string }>;
  // Legacy single values for backwards compatibility
  sector: string | null;
  use_class: string | null;
  contact_name: string;
  contact_title: string;
  contact_email: string;
  contact_phone: string;
  is_nationwide: boolean;
  logo_url: string | null;
  // Logo management fields - Story 9.0
  clearbit_logo: boolean;
  company_domain: string | null;
  place_name: string | null;
  coordinates: { lat: number; lng: number } | null;
  created_at: string;
}

export interface SearchResponse {
  results: SearchResult[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface LocationSuggestion {
  id: string;
  name: string;
  description: string;
  coordinates: { lat: number; lng: number };
}

export interface FilterOption {
  value: string;
  label: string;
  count?: number;
}

export interface SectorOption extends FilterOption {
  id: string;
}

export interface UseClassOption extends FilterOption {
  id: string;
}

// Modal state management
export interface ModalState {
  isOpen: boolean;
  listingId: string | null;
  previousScrollPosition: number;
  searchState: SearchFilters;
}

// Enhanced modal content interfaces for LDM story
export interface ContactDetails {
  name: string;
  title: string;
  email: string;
  phone: string;
  contact_area?: string;
  headshot_url?: string;
}

export interface Location {
  id?: string;
  place_name: string;
  coordinates?: { lat: number; lng: number };
}

export interface FAQ {
  id: string;
  question: string;
  answer: string;
}

export interface FileAttachment {
  id: string;
  type: 'brochure' | 'fit_out' | 'site_plan';
  name: string;
  size: number;
  url: string;
  thumbnail_url?: string;
  mime_type?: string;
}

export interface EnhancedListingModalContent {
  // Core company information
  company: {
    name: string;
    logo_url?: string;
    sectors: string[];
    use_classes: string[];
    // Legacy fields for backward compatibility
    sector: string;
    use_class: string;
    site_size: string;
    dwelling_count: string;
    site_acreage: string;
  };
  
  // Enhanced contact information  
  contacts: {
    primary: ContactDetails;
    additional: ContactDetails[];
  };
  
  // Location requirements
  locations: {
    preferred: Location[];
    acceptable: Location[];
    is_nationwide: boolean;
  };
  
  // FAQs with ordering
  faqs: FAQ[];
  
  // File attachments
  files: {
    brochures: FileAttachment[];
    fit_outs: FileAttachment[];
    site_plans: FileAttachment[];
  };

  // Metadata
  id: string;
  title: string;
  description: string;
  created_at: string;
  listing_type: 'residential' | 'commercial';
}

export interface ListingModalProps {
  listingId: string | null;
  isOpen: boolean;
  onClose: () => void;
  searchState?: SearchFilters;
  scrollPosition?: number;
}

// Typography and animation constants
export const TYPOGRAPHY = {
  hero: 'heading-1',
  sectionHeading: 'heading-3',
  cardTitle: 'heading-4',
  bodyText: 'body-base',
  caption: 'caption'
} as const;

export const COLORS = {
  primary: 'var(--primary-500)',
  primaryHover: 'var(--primary-600)',
  secondary: 'var(--primary-50)',
  success: 'var(--success)',
  warning: 'var(--warning)',
  error: 'var(--error)',
  text: 'var(--foreground)',
  textMuted: 'var(--muted-foreground)'
} as const;

export const ANIMATIONS = {
  fast: '200ms',
  medium: '300ms',
  slow: '400ms',
  easing: 'ease-in-out'
} as const;
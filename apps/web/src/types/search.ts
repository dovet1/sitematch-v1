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
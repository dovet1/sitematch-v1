// =====================================================
// Location Types - Story 3.2
// TypeScript definitions for location functionality
// =====================================================

import type { LocationResult } from '@/lib/mapbox';

/**
 * Location selection with preference type
 */
export interface LocationSelection {
  id: string;
  place_name: string;
  coordinates: [number, number]; // [lng, lat]
  type: 'preferred' | 'acceptable';
  formatted_address: string;
  region?: string;
  country?: string;
}

/**
 * Location search state
 */
export interface LocationSearchState {
  query: string;
  results: LocationResult[];
  isLoading: boolean;
  error: string | null;
  selectedLocations: LocationSelection[];
  isNationwide: boolean;
}

/**
 * Location chip display properties
 */
export interface LocationChip {
  id: string;
  label: string;
  type: 'preferred' | 'acceptable';
  removable: boolean;
}

/**
 * Location validation result
 */
export interface LocationValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Location search options for component
 */
export interface LocationSearchProps {
  value: LocationSelection[];
  onChange: (locations: LocationSelection[]) => void;
  onValidationChange?: (validation: LocationValidation) => void;
  isNationwide: boolean;
  onNationwideChange: (isNationwide: boolean) => void;
  maxLocations?: number;
  placeholder?: string;
  disabled?: boolean;
  error?: string;
}

/**
 * Location chip props
 */
export interface LocationChipProps {
  location: LocationSelection;
  onRemove: (id: string) => void;
  onTypeChange?: (id: string, type: 'preferred' | 'acceptable') => void;
  showTypeToggle?: boolean;
  disabled?: boolean;
}

/**
 * Mapbox feature context (from API response)
 */
export interface MapboxContext {
  id: string;
  text: string;
  short_code?: string;
  wikidata?: string;
}

/**
 * Enhanced location result with additional metadata
 */
export interface EnhancedLocationResult extends LocationResult {
  distance?: number; // Distance from user if proximity is used
  relevance?: number; // Mapbox relevance score
  bbox?: [number, number, number, number]; // Bounding box
}

/**
 * Location search analytics
 */
export interface LocationSearchAnalytics {
  searchQuery: string;
  resultCount: number;
  selectedLocationId?: string;
  searchDuration: number;
  timestamp: Date;
}

/**
 * Location validation rules
 */
export interface LocationValidationRules {
  maxPreferred: number;
  maxAcceptable: number;
  maxTotal: number;
  allowDuplicates: boolean;
  requiresAtLeastOne: boolean;
  restrictToCountries?: string[];
}

/**
 * Default location validation rules
 */
export const DEFAULT_LOCATION_RULES: LocationValidationRules = {
  maxPreferred: 10,
  maxAcceptable: 20,
  maxTotal: 999,
  allowDuplicates: false,
  requiresAtLeastOne: true,
  restrictToCountries: ['GB', 'IE']
};

/**
 * Location preference levels
 */
export const LOCATION_TYPES = {
  PREFERRED: 'preferred' as const,
  ACCEPTABLE: 'acceptable' as const
};

/**
 * Location type display labels
 */
export const LOCATION_TYPE_LABELS = {
  preferred: 'Preferred',
  acceptable: 'Acceptable'
} as const;
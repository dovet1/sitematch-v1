// Saved Search Types

export interface SavedSearch {
  id: string;
  user_id: string;
  name: string;

  // Search criteria
  listing_type?: 'commercial' | 'residential' | null;

  // Location with radius
  location_address?: string | null;
  location_lat?: number | null;
  location_lng?: number | null;
  location_radius_miles?: number | null;

  // Filters
  sectors?: string[] | null;
  planning_use_classes?: string[] | null;
  min_size?: number | null;
  max_size?: number | null;

  // Email notifications
  email_notifications_enabled?: boolean;
  last_notified_at?: string | null;

  // Timestamps
  created_at: string;
  updated_at: string;
}

export interface CreateSavedSearch {
  name: string;
  listing_type?: 'commercial' | 'residential' | null;
  location_address?: string | null;
  location_lat?: number | null;
  location_lng?: number | null;
  location_radius_miles?: number | null;
  sectors?: string[] | null;
  planning_use_classes?: string[] | null;
  min_size?: number | null;
  max_size?: number | null;
  email_notifications_enabled?: boolean;
}

export interface UpdateSavedSearch extends Partial<CreateSavedSearch> {}

export interface MatchingListing {
  id: string;
  company_name: string;
  listing_type: 'commercial' | 'residential';
  status: string;
  created_at: string;
  location?: {
    address?: string;
    latitude?: number;
    longitude?: number;
  };
  sectors?: string[];
  planning_use_classes?: string[];
  size?: number;
  matched_search_id: string;
  matched_search_name: string;
  distance_miles?: number;
}

export interface SavedSearchWithMatches extends SavedSearch {
  match_count: number;
}

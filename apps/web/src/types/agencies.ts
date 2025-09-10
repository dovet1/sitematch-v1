// =====================================================
// Agency Types
// Types for managing agencies and their relationships to listings
// =====================================================

export interface Agency {
  id: string;
  name: string;
  description: string | null;
  website: string | null;
  email: string;
  phone: string | null;
  address: string | null;
  logo_url: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ListingAgent {
  id: string;
  listing_id: string;
  agency_id: string;
  added_at: string;
}

export interface ListingAgentWithAgency extends ListingAgent {
  agency: Agency;
}

// =====================================================
// API REQUEST/RESPONSE TYPES
// =====================================================

export interface AddListingAgentRequest {
  listing_id: string;
  agency_id: string;
}

export interface RemoveListingAgentRequest {
  listing_id: string;
  agency_id: string;
}

export interface ListingAgentsResponse {
  data: ListingAgentWithAgency[];
  success: boolean;
}

// =====================================================
// UTILITY TYPES
// =====================================================

export type ListingAgentOperation = 'add' | 'remove';

export interface ListingAgentAction {
  operation: ListingAgentOperation;
  agency_id: string;
  listing_id: string;
}
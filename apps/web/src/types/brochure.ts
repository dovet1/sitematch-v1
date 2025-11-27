// =====================================================
// Brochure Types - SiteBrochure MVP
// TypeScript types for the brochure generation feature
// =====================================================

import type { LocationSelection } from '@/types/locations';

export type LogoSource = 'logo_dev' | 'upload' | 'none';
export type BrochureTemplate = 'clean-modern' | 'gails-style';

// Database row type (matches Supabase table)
export interface BrochureRow {
  id: string;
  user_id: string;
  listing_id: string | null;

  // Company details
  company_name: string;
  company_domain: string | null;
  company_logo_source: LogoSource;
  company_logo_url: string | null;
  company_about: string | null;

  // Agent details
  agent_name: string;
  agent_company: string;
  agent_email: string;
  agent_phone: string | null;
  agent_domain: string | null;
  agent_logo_source: LogoSource;
  agent_logo_url: string | null;

  // Requirements
  requirements_summary: string;
  sqft_min: number | null;
  sqft_max: number | null;
  use_class: string | null;
  use_class_label: string | null;
  sector: string | null;
  sector_label: string | null;
  additional_notes: string | null;

  // Locations & Media
  target_locations: LocationSelection[];
  store_images: string[];

  // Branding
  brand_color: string | null;
  template: BrochureTemplate;

  // Timestamps
  created_at: string;
  updated_at: string;
}

// Form data for the wizard (client-side)
export interface BrochureFormData {
  // Step 0 - Data Source
  sourceType: 'listing' | 'scratch';
  listingId?: string;

  // Step 1 - Company & Agent Details
  companyName: string;
  companyDomain?: string;
  companyLogoSource: LogoSource;
  companyLogoUrl: string;
  companyAbout?: string;

  agentName: string;
  agentCompany: string;
  agentEmail: string;
  agentPhone: string;
  agentDomain?: string;
  agentLogoSource: LogoSource;
  agentLogoUrl: string;

  // Step 2 - Requirements
  requirementsSummary: string;
  sqftMin?: number;
  sqftMax?: number;
  useClass?: string;
  useClassLabel?: string;
  sector?: string;
  sectorLabel?: string;
  additionalNotes?: string;

  // Step 3 - Locations & Media
  targetLocations: LocationSelection[];
  storeImages: string[];

  // Step 4 - Brand Colour & Template
  brandColor: string;
  template: BrochureTemplate;
}

// Initial empty form data
export const INITIAL_BROCHURE_FORM_DATA: BrochureFormData = {
  sourceType: 'scratch',
  listingId: undefined,

  companyName: '',
  companyDomain: '',
  companyLogoSource: 'logo_dev',
  companyLogoUrl: '',

  agentName: '',
  agentCompany: '',
  agentEmail: '',
  agentPhone: '',
  agentDomain: '',
  agentLogoSource: 'logo_dev',
  agentLogoUrl: '',

  requirementsSummary: '',
  sqftMin: undefined,
  sqftMax: undefined,
  useClass: undefined,
  sector: undefined,
  additionalNotes: undefined,

  targetLocations: [],
  storeImages: [],

  brandColor: '#7c3aed', // Default violet
  template: 'clean-modern', // Default template
};

// Wizard step configuration
export type BrochureWizardStep = 0 | 1 | 2 | 3 | 4;

export interface BrochureStepConfig {
  step: BrochureWizardStep;
  title: string;
  description: string;
}

export const BROCHURE_STEPS: BrochureStepConfig[] = [
  { step: 0, title: 'Data Source', description: 'Choose where to pull data from' },
  { step: 1, title: 'Company & Agent', description: 'Company and agent details' },
  { step: 2, title: 'Requirements', description: 'Property requirements' },
  { step: 3, title: 'Locations & Media', description: 'Target locations and images' },
  { step: 4, title: 'Preview & Export', description: 'Review and download' },
];

// =====================================================
// Wizard Types - Story 3.1
// TypeScript types for the listing creation wizard
// =====================================================

// Contact data structure for listing_contacts table
export interface ListingContact {
  id?: string; // UUID, optional for new contacts
  listingId?: string; // UUID reference to listing
  contactName: string; // required
  contactTitle: string; // required
  contactEmail: string; // required, pre-filled from auth for primary
  contactPhone?: string; // optional, UK/international format
  contactArea?: string; // optional, e.g., "The South West"
  isPrimaryContact: boolean; // true for Step 1, false for Step 4
  headshotUrl?: string; // stored headshot URL
  headshotFile?: File; // local file for upload
  headshotPreview?: string; // base64 preview
  createdAt?: Date;
  updatedAt?: Date;
}

// Step-specific form data interfaces
export interface CompanyInfoData {
  companyName: string; // required
  listingType: 'residential' | 'commercial'; // required - type of listing
  // Primary contact data (goes to listing_contacts table)
  primaryContact: ListingContact;
  // Company logo - Story 9.0
  logoMethod?: 'clearbit' | 'upload'; // Method selection: Clearbit API or file upload
  companyDomain?: string; // For Clearbit logo fetching
  clearbitLogo?: boolean; // Whether using Clearbit logo
  logoFile?: File; // optional, PNG/JPG/SVG max 2MB (upload method)
  logoPreview?: string; // base64 preview or Clearbit URL
  logoUrl?: string; // uploaded logo URL or Clearbit URL
  // Requirements brochure (moved from step 4)
  brochureFiles?: Array<{
    id: string;
    name: string;
    url: string;
    path: string;
    type: 'brochure';
    size: number;
    mimeType: string;
    uploadedAt: Date;
  }>;
}

export interface RequirementDetailsData {
  // PRD-specified sector options - now multi-select and optional
  sectors?: string[]; // optional array of sector values
  useClassIds?: string[]; // optional array of use class IDs from multi-select
  siteSizeMin?: number; // square feet, from double-thumb slider
  siteSizeMax?: number; // square feet, from double-thumb slider
}

// Step 3: Location Data - Story 3.2
export interface LocationData {
  // Location search data - using LocationSelection type for consistency
  locations?: Array<{
    id: string;
    place_name: string;
    coordinates: [number, number];
    type: 'preferred' | 'acceptable'; // Deprecated - keeping for backward compatibility
    formatted_address: string;
    region?: string;
    country?: string;
  }>;
  locationSearchNationwide?: boolean;
}

// Step 4: Additional Contacts Data
export interface AdditionalContactsData {
  additionalContacts?: ListingContact[]; // Array of additional contacts (isPrimaryContact = false)
}

// Step 5: FAQ Data
export interface FAQData {
  faqs?: Array<{
    id?: string;
    question: string;
    answer: string;
    displayOrder: number;
  }>;
}

// Step 6: Supporting Documents Data - Story 3.2 (brochure removed)
export interface SupportingDocumentsData {
  // File upload data
  sitePlanFiles?: Array<{
    id: string;
    name: string;
    url: string;
    path: string;
    type: 'sitePlan';
    size: number;
    mimeType: string;
    uploadedAt: Date;
  }>;
  fitOutFiles?: Array<{
    id: string;
    name: string;
    url: string;
    path: string;
    type: 'fitOut';
    size: number;
    mimeType: string;
    uploadedAt: Date;
    displayOrder: number;
    caption?: string;
    isVideo?: boolean;
    thumbnail?: string;
  }>;
}

// PRD Use Class Options for Dropdown
export interface UseClassOption {
  id: string;
  code: string; // E.g., 'E(a)', 'B2', 'Sui Generis'
  name: string; // E.g., 'Retail', 'General Industrial'
  description: string;
}

// Combined wizard form data
export interface WizardFormData extends CompanyInfoData, RequirementDetailsData, LocationData, AdditionalContactsData, FAQData, SupportingDocumentsData {
  existingListingId?: string; // Draft listing ID that should be updated instead of creating new
}

// Wizard state management
export interface WizardState {
  currentStep: 1 | 2 | 3 | 4 | 5 | 6;
  formData: Partial<WizardFormData>;
  isValid: Record<number, boolean>;
  isSubmitting: boolean;
  errors: Record<string, string>;
  listingId?: string; // Draft listing ID created when wizard starts
}

// Step configuration
export interface WizardStep {
  number: 1 | 2 | 3 | 4 | 5 | 6;
  title: string;
  description: string;
  component: React.ComponentType<WizardStepProps>;
  isValid?: boolean;
  isCompleted?: boolean;
}

// Props for step components
export interface WizardStepProps {
  data: Partial<WizardFormData>;
  onUpdate: (data: Partial<WizardFormData>) => void;
  onNext: () => void;
  onPrevious: () => void;
  onValidationChange: (isValid: boolean) => void;
  isSubmitting?: boolean;
  errors?: Record<string, string>;
}

// Navigation actions
export type WizardAction = 
  | { type: 'SET_STEP'; step: 1 | 2 | 3 | 4 | 5 | 6 }
  | { type: 'UPDATE_DATA'; data: Partial<WizardFormData> }
  | { type: 'SET_VALID'; step: number; isValid: boolean }
  | { type: 'SET_SUBMITTING'; isSubmitting: boolean }
  | { type: 'SET_ERRORS'; errors: Record<string, string> }
  | { type: 'SET_LISTING_ID'; listingId: string }
  | { type: 'RESET' };

// Validation schema types
export interface ValidationRule {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  email?: boolean;
  phone?: boolean;
  min?: number;
  max?: number;
}

export interface ValidationSchema {
  step1: Record<keyof CompanyInfoData, ValidationRule>;
  step2: Record<keyof RequirementDetailsData, ValidationRule>;
  step3: Record<keyof LocationData, ValidationRule>;
  step4: Record<keyof AdditionalContactsData, ValidationRule>;
  step5: Record<keyof FAQData, ValidationRule>;
  step6: Record<keyof SupportingDocumentsData, ValidationRule>;
}

// Auto-organization creation
export interface OrganizationCreationResult {
  success: boolean;
  organizationId?: string;
  error?: string;
}

// Form submission types
export interface WizardSubmissionData extends WizardFormData {
  // Additional fields that might be added during submission
  orgId?: string;
  userId?: string;
  status?: 'draft' | 'pending';
  organizationCreated?: boolean;
}

export interface SubmissionResult {
  success: boolean;
  data?: any;
  error?: string;
  message?: string;
  listingId?: string;
  organizationId?: string;
  organizationCreated?: boolean;
  debug?: {
    faqsProcessed?: number;
    contactsProcessed?: number;
  };
}

// Progress indicator types
export interface ProgressStep {
  number: number;
  title: string;
  description?: string;
  isActive: boolean;
  isCompleted: boolean;
  isAccessible: boolean;
}

// Auto-save functionality
export interface AutoSaveState {
  lastSaved: Date | null;
  isDirty: boolean;
  isSaving: boolean;
  saveError?: string;
}

// Wizard context type
export interface WizardContextType {
  state: WizardState;
  dispatch: React.Dispatch<WizardAction>;
  goToStep: (step: 1 | 2 | 3 | 4 | 5 | 6) => void;
  goNext: () => void;
  goPrevious: () => void;
  updateData: (data: Partial<WizardFormData>) => void;
  submitWizard: () => Promise<SubmissionResult>;
  resetWizard: () => void;
  autoSave: AutoSaveState;
}
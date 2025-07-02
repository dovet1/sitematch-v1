// =====================================================
// Wizard Types - Story 3.1
// TypeScript types for the listing creation wizard
// =====================================================

// Step-specific form data interfaces
export interface CompanyInfoData {
  companyName: string; // required
  companyDescription?: string; // optional
  contactEmail: string; // pre-filled from auth, read-only
  contactPhone?: string; // optional
}

export interface RequirementDetailsData {
  title: string; // required
  description?: string; // optional
  sector: 'retail' | 'office' | 'industrial' | 'leisure' | 'mixed'; // required
  useClass: string; // required
  siteSizeMin?: number; // square feet
  siteSizeMax?: number; // square feet
}

// Combined wizard form data
export interface WizardFormData extends CompanyInfoData, RequirementDetailsData {}

// Wizard state management
export interface WizardState {
  currentStep: 1 | 2;
  formData: Partial<WizardFormData>;
  isValid: Record<number, boolean>;
  isSubmitting: boolean;
  errors: Record<string, string>;
}

// Step configuration
export interface WizardStep {
  number: 1 | 2;
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
  | { type: 'SET_STEP'; step: 1 | 2 }
  | { type: 'UPDATE_DATA'; data: Partial<WizardFormData> }
  | { type: 'SET_VALID'; step: number; isValid: boolean }
  | { type: 'SET_SUBMITTING'; isSubmitting: boolean }
  | { type: 'SET_ERRORS'; errors: Record<string, string> }
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
}

// Form submission types
export interface WizardSubmissionData extends WizardFormData {
  // Additional fields that might be added during submission
  orgId?: string;
  userId?: string;
  status?: 'draft' | 'pending';
}

export interface SubmissionResult {
  success: boolean;
  data?: any;
  error?: string;
  listingId?: string;
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
  goToStep: (step: 1 | 2) => void;
  goNext: () => void;
  goPrevious: () => void;
  updateData: (data: Partial<WizardFormData>) => void;
  submitWizard: () => Promise<SubmissionResult>;
  resetWizard: () => void;
  autoSave: AutoSaveState;
}
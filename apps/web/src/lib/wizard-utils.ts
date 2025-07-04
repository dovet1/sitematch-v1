// =====================================================
// Wizard Utilities - Story 3.1
// Utility functions for the listing creation wizard
// =====================================================

import type {
  WizardFormData,
  ValidationSchema,
  ValidationRule,
  CompanyInfoData,
  RequirementDetailsData,
  LocationData,
  SupportingDocumentsData,
  AutoSaveState
} from '@/types/wizard';

// =====================================================
// VALIDATION UTILITIES
// =====================================================

export const validationSchema: ValidationSchema = {
  step1: {
    companyName: { required: true, minLength: 2, maxLength: 100 },
    contactName: { required: true, minLength: 2, maxLength: 100 },
    contactTitle: { required: true, minLength: 2, maxLength: 100 },
    contactEmail: { required: true, email: true },
    contactPhone: { phone: true },
    logoFile: {},
    logoPreview: {}
  },
  step2: {
    sectors: {},
    useClassIds: {},
    siteSizeMin: { min: 0, max: 10000000 },
    siteSizeMax: { min: 0, max: 10000000 }
  },
  step3: {
    locations: {}, // Not required - handled by cross-field validation
    locationSearchNationwide: {}
  },
  step4: {
    brochureFiles: {},
    sitePlanFiles: {},
    fitOutFiles: {}
  }
};

export function validateField(value: any, rule: ValidationRule): string | null {
  // Handle required fields
  if (rule.required) {
    if (!value || 
        (typeof value === 'string' && !value.trim()) ||
        (Array.isArray(value) && value.length === 0)) {
      return 'This field is required';
    }
  }

  // Skip further validation if field is empty and not required
  if (!value || (typeof value === 'string' && !value.trim())) {
    return null;
  }

  const stringValue = String(value);

  // Length validations
  if (rule.minLength && stringValue.length < rule.minLength) {
    return `Must be at least ${rule.minLength} characters`;
  }

  if (rule.maxLength && stringValue.length > rule.maxLength) {
    return `Must be no more than ${rule.maxLength} characters`;
  }

  // Email validation
  if (rule.email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(stringValue)) {
      return 'Please enter a valid email address';
    }
  }

  // Phone validation (basic UK format)
  if (rule.phone) {
    const phoneRegex = /^(\+44|0)[1-9]\d{8,9}$/;
    if (!phoneRegex.test(stringValue.replace(/\s/g, ''))) {
      return 'Please enter a valid UK phone number';
    }
  }

  // Numeric validations
  if (typeof value === 'number') {
    if (rule.min !== undefined && value < rule.min) {
      return `Must be at least ${rule.min}`;
    }
    if (rule.max !== undefined && value > rule.max) {
      return `Must be no more than ${rule.max}`;
    }
  }

  return null;
}

export function validateStep(stepNumber: 1 | 2 | 3 | 4, data: Partial<WizardFormData>): Record<string, string> {
  const errors: Record<string, string> = {};
  let schema;
  
  if (stepNumber === 1) {
    schema = validationSchema.step1;
  } else if (stepNumber === 2) {
    schema = validationSchema.step2;
  } else if (stepNumber === 3) {
    schema = validationSchema.step3;
  } else if (stepNumber === 4) {
    schema = validationSchema.step4;
  } else {
    return errors;
  }

  Object.entries(schema).forEach(([fieldName, rule]) => {
    const value = data[fieldName as keyof WizardFormData];
    const error = validateField(value, rule);
    if (error) {
      errors[fieldName] = error;
    }
  });

  // Cross-field validation for step 2
  if (stepNumber === 2) {
    const { siteSizeMin, siteSizeMax } = data;
    if (siteSizeMin && siteSizeMax && siteSizeMin > siteSizeMax) {
      errors.siteSizeMin = 'Minimum size cannot be greater than maximum size';
    }
  }

  // Cross-field validation for step 3
  if (stepNumber === 3) {
    const { locations, locationSearchNationwide } = data;
    // Require either locations OR nationwide flag
    const hasLocations = locations && Array.isArray(locations) && locations.length > 0;
    const isNationwide = locationSearchNationwide === true;
    
    if (!hasLocations && !isNationwide) {
      errors.locations = 'Please select at least one location or choose nationwide coverage';
    }
  }

  return errors;
}

export function isStepValid(stepNumber: 1 | 2 | 3 | 4, data: Partial<WizardFormData>): boolean {
  const errors = validateStep(stepNumber, data);
  return Object.keys(errors).length === 0;
}

// =====================================================
// LOCAL STORAGE UTILITIES
// =====================================================

const STORAGE_KEY = 'listing-wizard-data';
const STORAGE_TIMESTAMP_KEY = 'listing-wizard-timestamp';

export function saveToLocalStorage(data: Partial<WizardFormData>): void {
  try {
    // Create a sanitized version without File objects for localStorage
    const sanitizedData = { ...data };
    
    // Remove File objects as they can't be serialized
    if (sanitizedData.logoFile instanceof File) {
      delete sanitizedData.logoFile;
    }
    
    // Keep the logoPreview (base64 string) if it exists
    // This allows us to restore the logo preview on reload
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitizedData));
    localStorage.setItem(STORAGE_TIMESTAMP_KEY, new Date().toISOString());
  } catch (error) {
    console.warn('Failed to save wizard data to localStorage:', error);
  }
}

export function loadFromLocalStorage(): Partial<WizardFormData> | null {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return null;

    // Check if data is older than 24 hours
    const timestamp = localStorage.getItem(STORAGE_TIMESTAMP_KEY);
    if (timestamp) {
      const savedTime = new Date(timestamp);
      const now = new Date();
      const hoursAgo = (now.getTime() - savedTime.getTime()) / (1000 * 60 * 60);
      
      if (hoursAgo > 24) {
        clearLocalStorage();
        return null;
      }
    }

    return JSON.parse(data);
  } catch (error) {
    console.warn('Failed to load wizard data from localStorage:', error);
    clearLocalStorage();
    return null;
  }
}

export function clearLocalStorage(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(STORAGE_TIMESTAMP_KEY);
  } catch (error) {
    console.warn('Failed to clear wizard data from localStorage:', error);
  }
}

// =====================================================
// STEP NAVIGATION UTILITIES
// =====================================================

export function canNavigateToStep(targetStep: 1 | 2 | 3 | 4, currentStep: 1 | 2 | 3 | 4, stepValidation: Record<number, boolean>): boolean {
  // Can always go to step 1
  if (targetStep === 1) return true;
  
  // Can only go to step 2 if step 1 is valid
  if (targetStep === 2) return stepValidation[1] === true;
  
  // Can only go to step 3 if steps 1 and 2 are valid
  if (targetStep === 3) return stepValidation[1] === true && stepValidation[2] === true;
  
  // Can only go to step 4 if steps 1, 2 and 3 are valid
  if (targetStep === 4) return stepValidation[1] === true && stepValidation[2] === true && stepValidation[3] === true;
  
  return false;
}

export function getNextStep(currentStep: 1 | 2 | 3 | 4): 2 | 3 | 4 | null {
  if (currentStep === 1) return 2;
  if (currentStep === 2) return 3;
  if (currentStep === 3) return 4;
  return null;
}

export function getPreviousStep(currentStep: 1 | 2 | 3 | 4): 1 | 2 | 3 | null {
  if (currentStep === 2) return 1;
  if (currentStep === 3) return 2;
  if (currentStep === 4) return 3;
  return null;
}

// =====================================================
// FORM DATA UTILITIES
// =====================================================

export function mergeFormData(current: Partial<WizardFormData>, updates: Partial<WizardFormData>): Partial<WizardFormData> {
  return {
    ...current,
    ...updates
  };
}

export function getStepData(stepNumber: 1 | 2 | 3 | 4, formData: Partial<WizardFormData>): Partial<CompanyInfoData> | Partial<RequirementDetailsData> | Partial<LocationData> | Partial<SupportingDocumentsData> {
  if (stepNumber === 1) {
    const { companyName, contactName, contactTitle, contactEmail, contactPhone, logoFile, logoPreview } = formData;
    return { companyName, contactName, contactTitle, contactEmail, contactPhone, logoFile, logoPreview };
  } else if (stepNumber === 2) {
    const { sectors, useClassIds, siteSizeMin, siteSizeMax } = formData;
    return { sectors, useClassIds, siteSizeMin, siteSizeMax };
  } else if (stepNumber === 3) {
    const { locations, locationSearchNationwide } = formData;
    return { locations, locationSearchNationwide };
  } else if (stepNumber === 4) {
    const { brochureFiles, sitePlanFiles, fitOutFiles } = formData;
    return { brochureFiles, sitePlanFiles, fitOutFiles };
  }
  return {};
}

export function isFormComplete(data: Partial<WizardFormData>): boolean {
  return isStepValid(1, data) && isStepValid(2, data) && isStepValid(3, data) && isStepValid(4, data);
}

// =====================================================
// FORMATTING UTILITIES
// =====================================================

export function formatSiteSize(min?: number, max?: number): string {
  if (!min && !max) return 'Not specified';
  if (min && !max) return `${min.toLocaleString()}+ sq ft`;
  if (!min && max) return `Up to ${max.toLocaleString()} sq ft`;
  if (min !== undefined && max !== undefined && min === max) return `${min.toLocaleString()} sq ft`;
  if (min !== undefined && max !== undefined) return `${min.toLocaleString()} - ${max.toLocaleString()} sq ft`;
  return 'Not specified';
}

export function formatSector(sector: string): string {
  const sectorLabels: Record<string, string> = {
    retail: 'Retail',
    office: 'Office',
    industrial: 'Industrial',
    leisure: 'Leisure',
    mixed: 'Mixed Use'
  };
  return sectorLabels[sector] || sector;
}

// =====================================================
// AUTO-SAVE UTILITIES
// =====================================================

export function createAutoSaveState(): AutoSaveState {
  return {
    lastSaved: null,
    isDirty: false,
    isSaving: false
  };
}

export function shouldAutoSave(autoSave: AutoSaveState, data: Partial<WizardFormData>): boolean {
  if (autoSave.isSaving) return false;
  if (!autoSave.isDirty) return false;
  
  // Auto-save after 30 seconds of no changes
  if (autoSave.lastSaved) {
    const timeSinceLastSave = Date.now() - autoSave.lastSaved.getTime();
    return timeSinceLastSave > 30000; // 30 seconds
  }
  
  return true;
}

// =====================================================
// WIZARD STEPS CONFIGURATION
// =====================================================

export interface StepConfig {
  number: 1 | 2 | 3;
  title: string;
  description: string;
  fields: string[];
}

export const wizardSteps: StepConfig[] = [
  {
    number: 1,
    title: 'Company Information',
    description: 'Tell us about your company and contact details',
    fields: ['companyName', 'contactName', 'contactTitle', 'contactEmail', 'contactPhone', 'logoFile']
  },
  {
    number: 2,
    title: 'Property Requirements',
    description: 'Specify your property requirements and preferences',
    fields: ['sectors', 'useClassIds', 'siteSizeMin', 'siteSizeMax']
  },
  {
    number: 3,
    title: 'Location & Files',
    description: 'Add target locations and supporting documents',
    fields: ['locations', 'brochureFiles', 'sitePlanFiles', 'fitOutFiles']
  }
];

export function getStepConfig(stepNumber: 1 | 2 | 3): StepConfig {
  return wizardSteps.find(step => step.number === stepNumber) || wizardSteps[0];
}
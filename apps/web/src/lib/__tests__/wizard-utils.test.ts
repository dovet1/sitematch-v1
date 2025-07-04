// =====================================================
// Wizard Utils Tests - Story 3.1
// Unit tests for wizard utility functions
// =====================================================

import {
  validateField,
  validateStep,
  isStepValid,
  saveToLocalStorage,
  loadFromLocalStorage,
  clearLocalStorage,
  canNavigateToStep,
  getNextStep,
  getPreviousStep,
  mergeFormData,
  getStepData,
  isFormComplete,
  formatSiteSize,
  formatSector
} from '../wizard-utils';

import type { WizardFormData, ValidationRule } from '@/types/wizard';

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
});

describe('Validation Functions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('validateField', () => {
    it('validates required fields', () => {
      const rule: ValidationRule = { required: true };
      
      expect(validateField('', rule)).toBe('This field is required');
      expect(validateField('  ', rule)).toBe('This field is required');
      expect(validateField(null, rule)).toBe('This field is required');
      expect(validateField(undefined, rule)).toBe('This field is required');
      expect(validateField('value', rule)).toBeNull();
    });

    it('validates string length', () => {
      const rule: ValidationRule = { minLength: 5, maxLength: 10 };
      
      expect(validateField('abc', rule)).toBe('Must be at least 5 characters');
      expect(validateField('abcdefghijk', rule)).toBe('Must be no more than 10 characters');
      expect(validateField('abcdef', rule)).toBeNull();
    });

    it('validates email format', () => {
      const rule: ValidationRule = { email: true };
      
      expect(validateField('invalid-email', rule)).toBe('Please enter a valid email address');
      expect(validateField('test@', rule)).toBe('Please enter a valid email address');
      expect(validateField('test@example.com', rule)).toBeNull();
    });

    it('validates phone format', () => {
      const rule: ValidationRule = { phone: true };
      
      expect(validateField('123', rule)).toBe('Please enter a valid UK phone number');
      expect(validateField('+44 20 1234 5678', rule)).toBeNull();
      expect(validateField('020 1234 5678', rule)).toBeNull();
    });

    it('validates numeric ranges', () => {
      const rule: ValidationRule = { min: 10, max: 100 };
      
      expect(validateField(5, rule)).toBe('Must be at least 10');
      expect(validateField(150, rule)).toBe('Must be no more than 100');
      expect(validateField(50, rule)).toBeNull();
    });
  });

  describe('validateStep', () => {
    const validStep1Data: Partial<WizardFormData> = {
      companyName: 'Test Company',
      primaryContact: {
        contactName: 'John Doe',
        contactTitle: 'Property Manager',
        contactEmail: 'test@example.com',
        isPrimaryContact: true
      }
    };

    const validStep2Data: Partial<WizardFormData> = {
      sectors: ['retail'],
      useClassIds: ['E(a)']
    };

    it('validates step 1 correctly', () => {
      const errors = validateStep(1, validStep1Data);
      expect(Object.keys(errors)).toHaveLength(0);
    });

    it('validates step 2 correctly', () => {
      const errors = validateStep(2, validStep2Data);
      expect(Object.keys(errors)).toHaveLength(0);
    });

    it('returns errors for invalid step 1 data', () => {
      const invalidData = { 
        companyName: '', 
        primaryContact: {
          contactName: '',
          contactTitle: '',
          contactEmail: 'invalid',
          isPrimaryContact: true
        }
      };
      const errors = validateStep(1, invalidData);
      
      expect(errors.companyName).toBeDefined();
      expect(errors['primaryContact.contactEmail']).toBeDefined();
    });

    it('validates site size cross-field validation', () => {
      const dataWithInvalidRange = {
        ...validStep2Data,
        siteSizeMin: 1000,
        siteSizeMax: 500
      };
      
      const errors = validateStep(2, dataWithInvalidRange);
      expect(errors.siteSizeMin).toBe('Minimum size cannot be greater than maximum size');
    });
  });

  describe('isStepValid', () => {
    it('returns true for valid step data', () => {
      const validData = {
        companyName: 'Test Company',
        primaryContact: {
          contactName: 'John Doe',
          contactTitle: 'Property Manager',
          contactEmail: 'test@example.com',
          isPrimaryContact: true
        }
      };
      
      expect(isStepValid(1, validData)).toBe(true);
    });

    it('returns false for invalid step data', () => {
      const invalidData = {
        companyName: '',
        primaryContact: {
          contactName: '',
          contactTitle: '',
          contactEmail: 'invalid',
          isPrimaryContact: true
        }
      };
      
      expect(isStepValid(1, invalidData)).toBe(false);
    });
  });
});

describe('Local Storage Functions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('saveToLocalStorage', () => {
    it('saves data to localStorage', () => {
      const data = { companyName: 'Test' };
      saveToLocalStorage(data);
      
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'listing-wizard-data',
        JSON.stringify(data)
      );
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'listing-wizard-timestamp',
        expect.any(String)
      );
    });

    it('handles localStorage errors gracefully', () => {
      localStorageMock.setItem.mockImplementation(() => {
        throw new Error('Storage quota exceeded');
      });
      
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      saveToLocalStorage({ companyName: 'Test' });
      
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('loadFromLocalStorage', () => {
    it('loads data from localStorage', () => {
      const testData = { companyName: 'Test' };
      localStorageMock.getItem.mockImplementation((key) => {
        if (key === 'listing-wizard-data') return JSON.stringify(testData);
        if (key === 'listing-wizard-timestamp') return new Date().toISOString();
        return null;
      });
      
      const result = loadFromLocalStorage();
      expect(result).toEqual(testData);
    });

    it('returns null when no data exists', () => {
      localStorageMock.getItem.mockReturnValue(null);
      
      const result = loadFromLocalStorage();
      expect(result).toBeNull();
    });

    it('clears old data (>24 hours)', () => {
      const oldDate = new Date();
      oldDate.setHours(oldDate.getHours() - 25);
      
      localStorageMock.getItem.mockImplementation((key) => {
        if (key === 'listing-wizard-data') return JSON.stringify({ test: 'data' });
        if (key === 'listing-wizard-timestamp') return oldDate.toISOString();
        return null;
      });
      
      const result = loadFromLocalStorage();
      expect(result).toBeNull();
      expect(localStorageMock.removeItem).toHaveBeenCalled();
    });
  });

  describe('clearLocalStorage', () => {
    it('removes data from localStorage', () => {
      clearLocalStorage();
      
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('listing-wizard-data');
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('listing-wizard-timestamp');
    });
  });
});

describe('Navigation Functions', () => {
  describe('canNavigateToStep', () => {
    it('allows navigation to step 1', () => {
      expect(canNavigateToStep(1, 2, { 1: false, 2: false })).toBe(true);
    });

    it('allows navigation to step 2 when step 1 is valid', () => {
      expect(canNavigateToStep(2, 1, { 1: true, 2: false })).toBe(true);
    });

    it('prevents navigation to step 2 when step 1 is invalid', () => {
      expect(canNavigateToStep(2, 1, { 1: false, 2: false })).toBe(false);
    });
  });

  describe('getNextStep', () => {
    it('returns step 2 from step 1', () => {
      expect(getNextStep(1)).toBe(2);
    });

    it('returns step 3 from step 2', () => {
      expect(getNextStep(2)).toBe(3);
    });

    it('returns null from step 6', () => {
      expect(getNextStep(6)).toBeNull();
    });
  });

  describe('getPreviousStep', () => {
    it('returns step 1 from step 2', () => {
      expect(getPreviousStep(2)).toBe(1);
    });

    it('returns step 5 from step 6', () => {
      expect(getPreviousStep(6)).toBe(5);
    });

    it('returns null from step 1', () => {
      expect(getPreviousStep(1)).toBeNull();
    });
  });
});

describe('Form Data Functions', () => {
  describe('mergeFormData', () => {
    it('merges form data correctly', () => {
      const current = { 
        companyName: 'Test', 
        primaryContact: {
          contactName: 'John Doe',
          contactTitle: 'Property Manager',
          contactEmail: 'old@example.com',
          isPrimaryContact: true
        }
      };
      const updates = { 
        primaryContact: {
          contactName: 'John Doe',
          contactTitle: 'Property Manager',
          contactEmail: 'new@example.com',
          isPrimaryContact: true
        },
        sectors: ['retail']
      };
      
      const result = mergeFormData(current, updates);
      
      expect(result).toEqual({
        companyName: 'Test',
        primaryContact: {
          contactName: 'John Doe',
          contactTitle: 'Property Manager',
          contactEmail: 'new@example.com',
          isPrimaryContact: true
        },
        sectors: ['retail']
      });
    });
  });

  describe('getStepData', () => {
    const fullData: Partial<WizardFormData> = {
      companyName: 'Test Company',
      primaryContact: {
        contactName: 'John Doe',
        contactTitle: 'Property Manager',
        contactEmail: 'test@example.com',
        isPrimaryContact: true
      },
      sectors: ['retail'],
      useClassIds: ['E(a)']
    };

    it('returns step 1 data', () => {
      const step1Data = getStepData(1, fullData);
      expect(step1Data).toEqual({
        companyName: 'Test Company',
        primaryContact: undefined,
        logoFile: undefined,
        logoPreview: undefined,
        logoUrl: undefined,
        brochureFiles: undefined
      });
    });

    it('returns step 2 data', () => {
      const step2Data = getStepData(2, fullData);
      expect(step2Data).toEqual({
        sectors: ['retail'],
        useClassIds: ['E(a)'],
        siteSizeMin: undefined,
        siteSizeMax: undefined
      });
    });
  });

  describe('isFormComplete', () => {
    it('returns true for complete form', () => {
      const completeData: Partial<WizardFormData> = {
        companyName: 'Test Company',
        primaryContact: {
          contactName: 'John Doe',
          contactTitle: 'Property Manager',
          contactEmail: 'test@example.com',
          isPrimaryContact: true
        },
        sectors: ['retail'],
        useClassIds: ['E(a)'],
        locations: [{ id: '1', name: 'London' }]
      };
      
      expect(isFormComplete(completeData)).toBe(true);
    });

    it('returns false for incomplete form', () => {
      const incompleteData: Partial<WizardFormData> = {
        companyName: 'Test Company'
      };
      
      expect(isFormComplete(incompleteData)).toBe(false);
    });
  });
});

describe('Formatting Functions', () => {
  describe('formatSiteSize', () => {
    it('formats size range correctly', () => {
      expect(formatSiteSize(1000, 5000)).toBe('1,000 - 5,000 sq ft');
    });

    it('formats minimum only', () => {
      expect(formatSiteSize(1000, undefined)).toBe('1,000+ sq ft');
    });

    it('formats maximum only', () => {
      expect(formatSiteSize(undefined, 5000)).toBe('Up to 5,000 sq ft');
    });

    it('handles equal min and max', () => {
      expect(formatSiteSize(2000, 2000)).toBe('2,000 sq ft');
    });

    it('handles no sizes', () => {
      expect(formatSiteSize(undefined, undefined)).toBe('Not specified');
    });
  });

  describe('formatSector', () => {
    it('formats sector labels correctly', () => {
      expect(formatSector('retail')).toBe('Retail');
      expect(formatSector('office')).toBe('Office');
      expect(formatSector('industrial')).toBe('Industrial');
      expect(formatSector('leisure')).toBe('Leisure');
      expect(formatSector('mixed')).toBe('Mixed Use');
    });

    it('returns original value for unknown sectors', () => {
      expect(formatSector('unknown')).toBe('unknown');
    });
  });
});
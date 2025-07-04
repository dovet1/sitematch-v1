// =====================================================
// Enhanced Form Validation - QA Enhancement
// Robust validation utilities with better error handling
// =====================================================

import { z } from 'zod';

// Enhanced phone validation that supports multiple formats
const phoneRegex = {
  uk: /^(\+44|0)([1-9]\d{8,9})$/,
  international: /^\+[1-9]\d{6,14}$/,
  general: /^[\+]?[1-9][\d\s\-\(\)]{6,18}\d$/
};

// Enhanced email validation
const emailSchema = z.string()
  .email('Please enter a valid email address')
  .min(5, 'Email must be at least 5 characters')
  .max(254, 'Email must be less than 254 characters') // RFC 5321 limit
  .refine((email) => {
    // Additional checks for common typos
    const domain = email.split('@')[1];
    if (!domain) return false;
    
    // Check for consecutive dots
    if (domain.includes('..')) return false;
    
    // Check for valid TLD
    const tld = domain.split('.').pop();
    return tld && tld.length >= 2;
  }, 'Please check your email format');

// Enhanced phone validation with multiple format support
const phoneSchema = z.string()
  .optional()
  .refine((phone) => {
    if (!phone || phone.trim() === '') return true; // Optional field
    
    const cleanPhone = phone.replace(/\s/g, '');
    
    // Try UK format first, then international, then general
    return phoneRegex.uk.test(cleanPhone) || 
           phoneRegex.international.test(cleanPhone) || 
           phoneRegex.general.test(cleanPhone);
  }, 'Please enter a valid phone number (UK or international format)');

// Site size validation with decimal support
const siteSizeSchema = z.number()
  .optional()
  .refine((size) => {
    if (size === undefined || size === null) return true;
    return size > 0 && size <= 10000000; // Max 10M sq ft
  }, 'Site size must be between 1 and 10,000,000 square feet');

// Company name validation with better rules
const companyNameSchema = z.string()
  .min(2, 'Company name must be at least 2 characters')
  .max(100, 'Company name must be less than 100 characters')
  .refine((name) => {
    // Check for meaningful content (not just spaces/special chars)
    const meaningfulChars = name.replace(/[\s\-\.\,]/g, '');
    return meaningfulChars.length >= 2;
  }, 'Company name must contain at least 2 meaningful characters')
  .refine((name) => {
    // Check for potential spam patterns
    const repeatedChars = /(.)\1{4,}/.test(name); // 5 or more repeated chars
    return !repeatedChars;
  }, 'Company name appears to be invalid');

// Enhanced listing title validation
const titleSchema = z.string()
  .min(5, 'Title must be at least 5 characters')
  .max(200, 'Title must be less than 200 characters')
  .refine((title) => {
    // Check for meaningful content
    const words = title.trim().split(/\s+/);
    return words.length >= 2 && words.every(word => word.length > 0);
  }, 'Title must contain at least 2 meaningful words');

// Use class validation with proper format checking
const useClassSchema = z.string()
  .min(1, 'Use class is required')
  .max(50, 'Use class must be less than 50 characters')
  .refine((useClass) => {
    // Basic UK use class format validation
    const ukUseClassPattern = /^[A-Z]\([a-z]?\)$|^[A-Z]\d*$|^Sui Generis$/i;
    return ukUseClassPattern.test(useClass.trim());
  }, 'Please enter a valid UK use class (e.g., E(a), B1, Sui Generis)');

// Sector validation
const sectorSchema = z.enum(['retail', 'office', 'industrial', 'leisure', 'mixed'], {
  errorMap: () => ({ message: 'Please select a valid sector' })
});

// Main form schemas
export const companyInfoSchema = z.object({
  companyName: companyNameSchema,
  contactEmail: emailSchema,
  contactPhone: phoneSchema
});

export const requirementDetailsSchema = z.object({
  title: titleSchema,
  description: z.string()
    .max(1000, 'Description must be less than 1000 characters')
    .optional(),
  sector: sectorSchema,
  useClass: useClassSchema,
  siteSizeMin: siteSizeSchema,
  siteSizeMax: siteSizeSchema
}).refine((data) => {
  // Cross-field validation for site sizes
  if (data.siteSizeMin && data.siteSizeMax) {
    return data.siteSizeMin <= data.siteSizeMax;
  }
  return true;
}, {
  message: 'Minimum size cannot be greater than maximum size',
  path: ['siteSizeMin']
}).refine((data) => {
  // Ensure reasonable size range
  if (data.siteSizeMin && data.siteSizeMax) {
    const ratio = data.siteSizeMax / data.siteSizeMin;
    return ratio <= 1000; // Max should not be more than 1000x min
  }
  return true;
}, {
  message: 'Size range appears to be unrealistic',
  path: ['siteSizeMax']
});

// Combined schema - simplified for TypeScript compatibility
export const fullWizardSchema = z.object({
  companyName: companyNameSchema,
  contactEmail: emailSchema,
  contactPhone: phoneSchema,
  title: titleSchema,
  description: z.string().max(1000).optional(),
  sector: sectorSchema,
  useClass: useClassSchema,
  siteSizeMin: siteSizeSchema,
  siteSizeMax: siteSizeSchema
}).refine((data) => {
  // Cross-field validation for site sizes
  if (data.siteSizeMin && data.siteSizeMax) {
    return data.siteSizeMin <= data.siteSizeMax;
  }
  return true;
}, {
  message: 'Minimum size cannot be greater than maximum size',
  path: ['siteSizeMin']
});

// Validation function with detailed error reporting
export function validateFormData(data: unknown, schema: z.ZodSchema<any>) {
  try {
    const result = schema.safeParse(data);
    
    if (result.success) {
      return { success: true, data: result.data, errors: {} };
    }
    
    // Transform Zod errors to field-specific errors
    const errors: Record<string, string> = {};
    result.error.errors.forEach((error) => {
      const path = error.path.join('.');
      errors[path] = error.message;
    });
    
    return { success: false, errors, data: null };
  } catch (error) {
    return { 
      success: false, 
      errors: { _form: 'Validation failed due to unexpected error' }, 
      data: null 
    };
  }
}

// Utility functions for common validations
export const validationUtils = {
  isValidEmail: (email: string): boolean => {
    return emailSchema.safeParse(email).success;
  },
  
  isValidPhone: (phone: string): boolean => {
    return phoneSchema.safeParse(phone).success;
  },
  
  isValidUseClass: (useClass: string): boolean => {
    return useClassSchema.safeParse(useClass).success;
  },
  
  formatPhoneNumber: (phone: string): string => {
    // Basic UK phone number formatting
    const cleaned = phone.replace(/\D/g, '');
    
    if (cleaned.startsWith('44')) {
      return `+44 ${cleaned.slice(2)}`;
    } else if (cleaned.startsWith('0')) {
      return `+44 ${cleaned.slice(1)}`;
    }
    
    return phone;
  },
  
  sanitizeInput: (input: string): string => {
    return input.trim()
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/[^\w\s\-\.\,\(\)]/g, ''); // Remove special chars but keep common punctuation
  }
};

// Real-time validation debouncer
export function createDebouncedValidator(
  validator: (value: unknown) => { success: boolean; errors: Record<string, string> },
  delay = 300
) {
  let timeoutId: NodeJS.Timeout;
  
  return (value: unknown): Promise<{ success: boolean; errors: Record<string, string> }> => {
    return new Promise((resolve) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        resolve(validator(value));
      }, delay);
    });
  };
}
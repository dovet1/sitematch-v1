// =====================================================
// Listings Validation Utilities - Story 3.0
// Pure validation functions without external dependencies
// =====================================================

import type {
  CreateListingRequest,
  ValidationError,
  ListingStatus
} from '@/types/listings';

// =====================================================
// VALIDATION FUNCTIONS
// =====================================================

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

export function validateListingData(data: Partial<CreateListingRequest>): ValidationResult {
  const errors: ValidationError[] = [];

  // Title validation
  if (data.title !== undefined) {
    if (!data.title || data.title.trim().length === 0) {
      errors.push({
        code: 'REQUIRED_FIELD',
        message: 'Title is required',
        field: 'title',
        value: data.title,
        constraint: 'required'
      });
    } else if (data.title.length < 5) {
      errors.push({
        code: 'MIN_LENGTH',
        message: 'Title must be at least 5 characters',
        field: 'title',
        value: data.title,
        constraint: 'minLength'
      });
    } else if (data.title.length > 200) {
      errors.push({
        code: 'MAX_LENGTH',
        message: 'Title must be less than 200 characters',
        field: 'title',
        value: data.title,
        constraint: 'maxLength'
      });
    }
  }

  // Description validation
  if (data.description && data.description.length > 2000) {
    errors.push({
      code: 'MAX_LENGTH',
      message: 'Description must be less than 2000 characters',
      field: 'description',
      value: data.description,
      constraint: 'maxLength'
    });
  }

  // Sector ID validation
  if (data.sector_id !== undefined) {
    if (!data.sector_id) {
      errors.push({
        code: 'REQUIRED_FIELD',
        message: 'Sector is required',
        field: 'sector_id',
        value: data.sector_id,
        constraint: 'required'
      });
    } else if (!isValidUUID(data.sector_id)) {
      errors.push({
        code: 'INVALID_FORMAT',
        message: 'Invalid sector ID format',
        field: 'sector_id',
        value: data.sector_id,
        constraint: 'uuid'
      });
    }
  }

  // Use class ID validation
  if (data.use_class_id !== undefined) {
    if (!data.use_class_id) {
      errors.push({
        code: 'REQUIRED_FIELD',
        message: 'Use class is required',
        field: 'use_class_id',
        value: data.use_class_id,
        constraint: 'required'
      });
    } else if (!isValidUUID(data.use_class_id)) {
      errors.push({
        code: 'INVALID_FORMAT',
        message: 'Invalid use class ID format',
        field: 'use_class_id',
        value: data.use_class_id,
        constraint: 'uuid'
      });
    }
  }

  // Site size validation
  if (data.site_size_min !== undefined && data.site_size_min !== null) {
    if (data.site_size_min < 0) {
      errors.push({
        code: 'MIN_VALUE',
        message: 'Minimum site size cannot be negative',
        field: 'site_size_min',
        value: data.site_size_min,
        constraint: 'min'
      });
    } else if (data.site_size_min > 10000000) {
      errors.push({
        code: 'MAX_VALUE',
        message: 'Minimum site size is too large',
        field: 'site_size_min',
        value: data.site_size_min,
        constraint: 'max'
      });
    }
  }

  if (data.site_size_max !== undefined && data.site_size_max !== null) {
    if (data.site_size_max < 0) {
      errors.push({
        code: 'MIN_VALUE',
        message: 'Maximum site size cannot be negative',
        field: 'site_size_max',
        value: data.site_size_max,
        constraint: 'min'
      });
    } else if (data.site_size_max > 10000000) {
      errors.push({
        code: 'MAX_VALUE',
        message: 'Maximum site size is too large',
        field: 'site_size_max',
        value: data.site_size_max,
        constraint: 'max'
      });
    }
  }

  // Contact name validation
  if (data.contact_name !== undefined) {
    if (!data.contact_name || data.contact_name.trim().length === 0) {
      errors.push({
        code: 'REQUIRED_FIELD',
        message: 'Contact name is required',
        field: 'contact_name',
        value: data.contact_name,
        constraint: 'required'
      });
    } else if (data.contact_name.length < 2) {
      errors.push({
        code: 'MIN_LENGTH',
        message: 'Contact name must be at least 2 characters',
        field: 'contact_name',
        value: data.contact_name,
        constraint: 'minLength'
      });
    } else if (data.contact_name.length > 100) {
      errors.push({
        code: 'MAX_LENGTH',
        message: 'Contact name must be less than 100 characters',
        field: 'contact_name',
        value: data.contact_name,
        constraint: 'maxLength'
      });
    }
  }

  // Contact title validation
  if (data.contact_title !== undefined) {
    if (!data.contact_title || data.contact_title.trim().length === 0) {
      errors.push({
        code: 'REQUIRED_FIELD',
        message: 'Contact title is required',
        field: 'contact_title',
        value: data.contact_title,
        constraint: 'required'
      });
    } else if (data.contact_title.length < 2) {
      errors.push({
        code: 'MIN_LENGTH',
        message: 'Contact title must be at least 2 characters',
        field: 'contact_title',
        value: data.contact_title,
        constraint: 'minLength'
      });
    } else if (data.contact_title.length > 100) {
      errors.push({
        code: 'MAX_LENGTH',
        message: 'Contact title must be less than 100 characters',
        field: 'contact_title',
        value: data.contact_title,
        constraint: 'maxLength'
      });
    }
  }

  // Contact email validation
  if (data.contact_email !== undefined) {
    if (!data.contact_email || data.contact_email.trim().length === 0) {
      errors.push({
        code: 'REQUIRED_FIELD',
        message: 'Contact email is required',
        field: 'contact_email',
        value: data.contact_email,
        constraint: 'required'
      });
    } else if (!isValidEmail(data.contact_email)) {
      errors.push({
        code: 'INVALID_FORMAT',
        message: 'Contact email format is invalid',
        field: 'contact_email',
        value: data.contact_email,
        constraint: 'email'
      });
    }
  }

  // Contact phone validation (optional)
  if (data.contact_phone && data.contact_phone.trim().length > 0) {
    if (!isValidPhone(data.contact_phone)) {
      errors.push({
        code: 'INVALID_FORMAT',
        message: 'Contact phone format is invalid',
        field: 'contact_phone',
        value: data.contact_phone,
        constraint: 'phone'
      });
    }
  }

  // Cross-field validation
  if (
    data.site_size_min !== undefined && data.site_size_min !== null &&
    data.site_size_max !== undefined && data.site_size_max !== null &&
    data.site_size_min > data.site_size_max
  ) {
    errors.push({
      code: 'INVALID_RANGE',
      message: 'Minimum site size cannot be greater than maximum site size',
      field: 'site_size_min',
      value: data.site_size_min,
      constraint: 'range'
    });
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

// =====================================================
// UTILITY FUNCTIONS
// =====================================================

export function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

export function isValidEmail(email: string): boolean {
  const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
  return emailRegex.test(email);
}

export function isValidPhone(phone: string): boolean {
  // Clean the phone number by removing spaces, dashes, and parentheses
  const cleanPhone = phone.replace(/[\s\-\(\)]/g, '');
  
  // UK mobile numbers (07xxx xxxxxx) or international format (+447xxx xxxxxx)
  const ukMobileRegex = /^(\+44|0)?7\d{9}$/;
  
  // International phone number format (E.164) - more flexible
  const internationalRegex = /^\+?[1-9]\d{7,14}$/;
  
  // UK landline numbers (01xxx, 02xxx) 
  const ukLandlineRegex = /^(\+44|0)?[12]\d{8,10}$/;
  
  return ukMobileRegex.test(cleanPhone) || 
         ukLandlineRegex.test(cleanPhone) || 
         internationalRegex.test(cleanPhone);
}

export function formatSiteSize(sizeMin: number | null, sizeMax: number | null): string {
  if (!sizeMin && !sizeMax) return 'Size not specified';
  if (sizeMin && !sizeMax) return `${sizeMin.toLocaleString()}+ sq ft`;
  if (!sizeMin && sizeMax) return `Up to ${sizeMax.toLocaleString()} sq ft`;
  if (sizeMin && sizeMax && sizeMin === sizeMax) return `${sizeMin.toLocaleString()} sq ft`;
  if (sizeMin && sizeMax) return `${sizeMin.toLocaleString()} - ${sizeMax.toLocaleString()} sq ft`;
  return 'Size not specified';
}

export function getStatusColor(status: ListingStatus): string {
  switch (status) {
    case 'draft': return 'gray';
    case 'pending': return 'yellow';
    case 'approved': return 'green';
    case 'rejected': return 'red';
    default: return 'gray';
  }
}

export function getStatusLabel(status: ListingStatus): string {
  switch (status) {
    case 'draft': return 'Draft';
    case 'pending': return 'Pending Review';
    case 'approved': return 'Approved';
    case 'rejected': return 'Rejected';
    default: return status;
  }
}
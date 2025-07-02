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
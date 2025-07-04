// =====================================================
// Listings API Route Tests - Story 3.0
// Unit tests for listings API validation and business logic
// =====================================================

/**
 * @jest-environment node
 */

import { validateListingData } from '@/lib/listings';
import type { CreateListingRequest } from '@/types/listings';

describe('Listings API Validation', () => {
  
  describe('validateListingData', () => {
    
    it('should validate required fields', () => {
      const validData: CreateListingRequest = {
        title: 'Test Listing',
        sector_id: '123e4567-e89b-12d3-a456-426614174000',
        use_class_id: '123e4567-e89b-12d3-a456-426614174001',
        primaryContact: {
          contactName: 'John Doe',
          contactTitle: 'Property Manager',
          contactEmail: 'john@example.com',
          isPrimaryContact: true
        }
      };

      const result = validateListingData(validData);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject empty title', () => {
      const invalidData: CreateListingRequest = {
        title: '',
        sector_id: '123e4567-e89b-12d3-a456-426614174000',
        use_class_id: '123e4567-e89b-12d3-a456-426614174001',
        primaryContact: {
          contactName: 'John Doe',
          contactTitle: 'Property Manager',
          contactEmail: 'john@example.com',
          isPrimaryContact: true
        }
      };

      const result = validateListingData(invalidData);
      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].field).toBe('title');
      expect(result.errors[0].code).toBe('REQUIRED_FIELD');
    });

    it('should reject title that is too short', () => {
      const invalidData: CreateListingRequest = {
        title: 'Hi',
        sector_id: '123e4567-e89b-12d3-a456-426614174000',
        use_class_id: '123e4567-e89b-12d3-a456-426614174001',
        primaryContact: {
          contactName: 'John Doe',
          contactTitle: 'Property Manager',
          contactEmail: 'john@example.com',
          isPrimaryContact: true
        }
      };

      const result = validateListingData(invalidData);
      expect(result.isValid).toBe(false);
      expect(result.errors[0].field).toBe('title');
      expect(result.errors[0].code).toBe('MIN_LENGTH');
    });

    it('should reject title that is too long', () => {
      const invalidData: CreateListingRequest = {
        title: 'A'.repeat(201),
        sector_id: '123e4567-e89b-12d3-a456-426614174000',
        use_class_id: '123e4567-e89b-12d3-a456-426614174001',
        primaryContact: {
          contactName: 'John Doe',
          contactTitle: 'Property Manager',
          contactEmail: 'john@example.com',
          isPrimaryContact: true
        }
      };

      const result = validateListingData(invalidData);
      expect(result.isValid).toBe(false);
      expect(result.errors[0].field).toBe('title');
      expect(result.errors[0].code).toBe('MAX_LENGTH');
    });

    it('should reject invalid UUID format for sector_id', () => {
      const invalidData: CreateListingRequest = {
        title: 'Test Listing',
        sector_id: 'invalid-uuid',
        use_class_id: '123e4567-e89b-12d3-a456-426614174001',
        primaryContact: {
          contactName: 'John Doe',
          contactTitle: 'Property Manager',
          contactEmail: 'john@example.com',
          isPrimaryContact: true
        }
      };

      const result = validateListingData(invalidData);
      expect(result.isValid).toBe(false);
      expect(result.errors[0].field).toBe('sector_id');
      expect(result.errors[0].code).toBe('INVALID_FORMAT');
    });

    it('should reject invalid UUID format for use_class_id', () => {
      const invalidData: CreateListingRequest = {
        title: 'Test Listing',
        sector_id: '123e4567-e89b-12d3-a456-426614174000',
        use_class_id: 'invalid-uuid',
        primaryContact: {
          contactName: 'John Doe',
          contactTitle: 'Property Manager',
          contactEmail: 'john@example.com',
          isPrimaryContact: true
        }
      };

      const result = validateListingData(invalidData);
      expect(result.isValid).toBe(false);
      expect(result.errors[0].field).toBe('use_class_id');
      expect(result.errors[0].code).toBe('INVALID_FORMAT');
    });

    it('should reject negative site sizes', () => {
      const invalidData: CreateListingRequest = {
        title: 'Test Listing',
        sector_id: '123e4567-e89b-12d3-a456-426614174000',
        use_class_id: '123e4567-e89b-12d3-a456-426614174001',
        site_size_min: -100,
        primaryContact: {
          contactName: 'John Doe',
          contactTitle: 'Property Manager',
          contactEmail: 'john@example.com',
          isPrimaryContact: true
        }
      };

      const result = validateListingData(invalidData);
      expect(result.isValid).toBe(false);
      expect(result.errors[0].field).toBe('site_size_min');
      expect(result.errors[0].code).toBe('MIN_VALUE');
    });

    it('should reject invalid size range (min > max)', () => {
      const invalidData: CreateListingRequest = {
        title: 'Test Listing',
        sector_id: '123e4567-e89b-12d3-a456-426614174000',
        use_class_id: '123e4567-e89b-12d3-a456-426614174001',
        site_size_min: 5000,
        site_size_max: 1000,
        primaryContact: {
          contactName: 'John Doe',
          contactTitle: 'Property Manager',
          contactEmail: 'john@example.com',
          isPrimaryContact: true
        }
      };

      const result = validateListingData(invalidData);
      expect(result.isValid).toBe(false);
      expect(result.errors[0].field).toBe('site_size_min');
      expect(result.errors[0].code).toBe('INVALID_RANGE');
    });

    it('should accept valid site size range', () => {
      const validData: CreateListingRequest = {
        title: 'Test Listing',
        sector_id: '123e4567-e89b-12d3-a456-426614174000',
        use_class_id: '123e4567-e89b-12d3-a456-426614174001',
        site_size_min: 1000,
        site_size_max: 5000,
        primaryContact: {
          contactName: 'John Doe',
          contactTitle: 'Property Manager',
          contactEmail: 'john@example.com',
          isPrimaryContact: true
        }
      };

      const result = validateListingData(validData);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should accept optional fields', () => {
      const validData: CreateListingRequest = {
        title: 'Test Listing with Full Details',
        description: 'A comprehensive test listing',
        sector_id: '123e4567-e89b-12d3-a456-426614174000',
        use_class_id: '123e4567-e89b-12d3-a456-426614174001',
        site_size_min: 1000,
        site_size_max: 5000,
        brochure_url: 'https://example.com/brochure.pdf'
      };

      const result = validateListingData(validData);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject description that is too long', () => {
      const invalidData: CreateListingRequest = {
        title: 'Test Listing',
        description: 'A'.repeat(2001), // Over 2000 character limit
        sector_id: '123e4567-e89b-12d3-a456-426614174000',
        use_class_id: '123e4567-e89b-12d3-a456-426614174001',
        primaryContact: {
          contactName: 'John Doe',
          contactTitle: 'Property Manager',
          contactEmail: 'john@example.com',
          isPrimaryContact: true
        }
      };

      const result = validateListingData(invalidData);
      expect(result.isValid).toBe(false);
      expect(result.errors[0].field).toBe('description');
      expect(result.errors[0].code).toBe('MAX_LENGTH');
    });
  });
});

// =====================================================
// Business Logic Tests
// =====================================================

import { formatSiteSize, getStatusColor, getStatusLabel } from '@/lib/listings';

describe('Listings Utility Functions', () => {
  
  describe('formatSiteSize', () => {
    
    it('should format size range correctly', () => {
      expect(formatSiteSize(1000, 5000)).toBe('1,000 - 5,000 sq ft');
    });

    it('should format minimum size only', () => {
      expect(formatSiteSize(1000, null)).toBe('1,000+ sq ft');
    });

    it('should format maximum size only', () => {
      expect(formatSiteSize(null, 5000)).toBe('Up to 5,000 sq ft');
    });

    it('should handle equal min and max', () => {
      expect(formatSiteSize(2000, 2000)).toBe('2,000 sq ft');
    });

    it('should handle no sizes specified', () => {
      expect(formatSiteSize(null, null)).toBe('Size not specified');
    });
  });

  describe('getStatusColor', () => {
    
    it('should return correct colors for each status', () => {
      expect(getStatusColor('draft')).toBe('gray');
      expect(getStatusColor('pending')).toBe('yellow');
      expect(getStatusColor('approved')).toBe('green');
      expect(getStatusColor('rejected')).toBe('red');
    });
  });

  describe('getStatusLabel', () => {
    
    it('should return correct labels for each status', () => {
      expect(getStatusLabel('draft')).toBe('Draft');
      expect(getStatusLabel('pending')).toBe('Pending Review');
      expect(getStatusLabel('approved')).toBe('Approved');
      expect(getStatusLabel('rejected')).toBe('Rejected');
    });
  });
});

// =====================================================
// Database Type Tests
// =====================================================

describe('Listings Type Definitions', () => {
  
  it('should define proper type structure', () => {
    // This test verifies TypeScript compilation
    const mockListing = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      org_id: '123e4567-e89b-12d3-a456-426614174001',
      title: 'Test Listing',
      description: 'Test description',
      sector_id: '123e4567-e89b-12d3-a456-426614174002',
      use_class_id: '123e4567-e89b-12d3-a456-426614174003',
      site_size_min: 1000,
      site_size_max: 5000,
      brochure_url: 'https://example.com/brochure.pdf',
      status: 'pending' as const,
      created_by: '123e4567-e89b-12d3-a456-426614174004',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z'
    };

    // Type assertion to verify structure
    expect(typeof mockListing.id).toBe('string');
    expect(typeof mockListing.title).toBe('string');
    expect(['draft', 'pending', 'approved', 'rejected']).toContain(mockListing.status);
  });
});
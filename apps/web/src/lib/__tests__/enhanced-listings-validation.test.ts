// =====================================================
// Enhanced Listings Validation Tests - Story 3.0
// Unit tests for PRD-aligned validation functions
// =====================================================

import { 
  validateListingData, 
  isValidEmail, 
  isValidPhone, 
  isValidUUID 
} from '../listings-validation';
import type { CreateListingRequest } from '@/types/listings';

describe('Enhanced Listings Validation', () => {
  
  // =====================================================
  // EMAIL VALIDATION TESTS
  // =====================================================
  
  describe('isValidEmail', () => {
    it('should validate correct email formats', () => {
      expect(isValidEmail('test@example.com')).toBe(true);
      expect(isValidEmail('user.name+tag@domain.co.uk')).toBe(true);
      expect(isValidEmail('user@sub.domain.com')).toBe(true);
    });

    it('should reject invalid email formats', () => {
      expect(isValidEmail('invalid-email')).toBe(false);
      expect(isValidEmail('test@')).toBe(false);
      expect(isValidEmail('@domain.com')).toBe(false);
      expect(isValidEmail('test..test@domain.com')).toBe(false);
    });
  });

  // =====================================================
  // PHONE VALIDATION TESTS
  // =====================================================

  describe('isValidPhone', () => {
    it('should validate correct phone formats', () => {
      expect(isValidPhone('+44123456789')).toBe(true);
      expect(isValidPhone('+1234567890')).toBe(true);
      expect(isValidPhone('447123456789')).toBe(true);
      expect(isValidPhone('+44 123 456 789')).toBe(true);
      expect(isValidPhone('+44-123-456-789')).toBe(true);
      expect(isValidPhone('+44 (123) 456-789')).toBe(true);
    });

    it('should reject invalid phone formats', () => {
      expect(isValidPhone('123')).toBe(false);
      expect(isValidPhone('+123456789012345678')).toBe(false); // Too long
      expect(isValidPhone('abc123456789')).toBe(false);
      expect(isValidPhone('+0123456789')).toBe(false); // Cannot start with 0
    });
  });

  // =====================================================
  // UUID VALIDATION TESTS
  // =====================================================

  describe('isValidUUID', () => {
    it('should validate correct UUID formats', () => {
      expect(isValidUUID('123e4567-e89b-12d3-a456-426614174000')).toBe(true);
      expect(isValidUUID('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
    });

    it('should reject invalid UUID formats', () => {
      expect(isValidUUID('invalid-uuid')).toBe(false);
      expect(isValidUUID('123e4567-e89b-12d3-a456')).toBe(false);
      expect(isValidUUID('')).toBe(false);
    });
  });

  // =====================================================
  // LISTING DATA VALIDATION TESTS
  // =====================================================

  describe('validateListingData', () => {
    const validListingData: CreateListingRequest = {
      title: 'Test Retail Space',
      description: 'A great retail location',
      sector_id: '123e4567-e89b-12d3-a456-426614174000',
      use_class_id: '550e8400-e29b-41d4-a716-446655440000',
      site_size_min: 1000,
      site_size_max: 2000,
      contact_name: 'John Doe',
      contact_title: 'Property Manager',
      contact_email: 'john.doe@example.com',
      contact_phone: '+44123456789'
    };

    it('should validate complete valid listing data', () => {
      const result = validateListingData(validListingData);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    // =====================================================
    // CONTACT FIELDS VALIDATION
    // =====================================================

    describe('Contact Name Validation', () => {
      it('should reject empty contact name', () => {
        const result = validateListingData({
          ...validListingData,
          contact_name: ''
        });
        expect(result.isValid).toBe(false);
        expect(result.errors.some(e => e.field === 'contact_name' && e.code === 'REQUIRED_FIELD')).toBe(true);
      });

      it('should reject contact name that is too short', () => {
        const result = validateListingData({
          ...validListingData,
          contact_name: 'A'
        });
        expect(result.isValid).toBe(false);
        expect(result.errors.some(e => e.field === 'contact_name' && e.code === 'MIN_LENGTH')).toBe(true);
      });

      it('should reject contact name that is too long', () => {
        const result = validateListingData({
          ...validListingData,
          contact_name: 'A'.repeat(101)
        });
        expect(result.isValid).toBe(false);
        expect(result.errors.some(e => e.field === 'contact_name' && e.code === 'MAX_LENGTH')).toBe(true);
      });
    });

    describe('Contact Title Validation', () => {
      it('should reject empty contact title', () => {
        const result = validateListingData({
          ...validListingData,
          contact_title: ''
        });
        expect(result.isValid).toBe(false);
        expect(result.errors.some(e => e.field === 'contact_title' && e.code === 'REQUIRED_FIELD')).toBe(true);
      });

      it('should reject contact title that is too short', () => {
        const result = validateListingData({
          ...validListingData,
          contact_title: 'A'
        });
        expect(result.isValid).toBe(false);
        expect(result.errors.some(e => e.field === 'contact_title' && e.code === 'MIN_LENGTH')).toBe(true);
      });

      it('should reject contact title that is too long', () => {
        const result = validateListingData({
          ...validListingData,
          contact_title: 'A'.repeat(101)
        });
        expect(result.isValid).toBe(false);
        expect(result.errors.some(e => e.field === 'contact_title' && e.code === 'MAX_LENGTH')).toBe(true);
      });
    });

    describe('Contact Email Validation', () => {
      it('should reject empty contact email', () => {
        const result = validateListingData({
          ...validListingData,
          contact_email: ''
        });
        expect(result.isValid).toBe(false);
        expect(result.errors.some(e => e.field === 'contact_email' && e.code === 'REQUIRED_FIELD')).toBe(true);
      });

      it('should reject invalid contact email format', () => {
        const result = validateListingData({
          ...validListingData,
          contact_email: 'invalid-email'
        });
        expect(result.isValid).toBe(false);
        expect(result.errors.some(e => e.field === 'contact_email' && e.code === 'INVALID_FORMAT')).toBe(true);
      });
    });

    describe('Contact Phone Validation', () => {
      it('should allow empty contact phone (optional field)', () => {
        const result = validateListingData({
          ...validListingData,
          contact_phone: ''
        });
        expect(result.isValid).toBe(true);
      });

      it('should allow undefined contact phone', () => {
        const { contact_phone, ...dataWithoutPhone } = validListingData;
        const result = validateListingData(dataWithoutPhone);
        expect(result.isValid).toBe(true);
      });

      it('should reject invalid contact phone format', () => {
        const result = validateListingData({
          ...validListingData,
          contact_phone: 'invalid-phone'
        });
        expect(result.isValid).toBe(false);
        expect(result.errors.some(e => e.field === 'contact_phone' && e.code === 'INVALID_FORMAT')).toBe(true);
      });
    });

    // =====================================================
    // EXISTING VALIDATION TESTS
    // =====================================================

    describe('Title Validation', () => {
      it('should reject empty title', () => {
        const result = validateListingData({
          ...validListingData,
          title: ''
        });
        expect(result.isValid).toBe(false);
        expect(result.errors.some(e => e.field === 'title' && e.code === 'REQUIRED_FIELD')).toBe(true);
      });

      it('should reject title that is too short', () => {
        const result = validateListingData({
          ...validListingData,
          title: 'ABC'
        });
        expect(result.isValid).toBe(false);
        expect(result.errors.some(e => e.field === 'title' && e.code === 'MIN_LENGTH')).toBe(true);
      });

      it('should reject title that is too long', () => {
        const result = validateListingData({
          ...validListingData,
          title: 'A'.repeat(201)
        });
        expect(result.isValid).toBe(false);
        expect(result.errors.some(e => e.field === 'title' && e.code === 'MAX_LENGTH')).toBe(true);
      });
    });

    describe('Site Size Validation', () => {
      it('should reject negative site sizes', () => {
        const result = validateListingData({
          ...validListingData,
          site_size_min: -100
        });
        expect(result.isValid).toBe(false);
        expect(result.errors.some(e => e.field === 'site_size_min' && e.code === 'MIN_VALUE')).toBe(true);
      });

      it('should reject min size greater than max size', () => {
        const result = validateListingData({
          ...validListingData,
          site_size_min: 2000,
          site_size_max: 1000
        });
        expect(result.isValid).toBe(false);
        expect(result.errors.some(e => e.field === 'site_size_min' && e.code === 'INVALID_RANGE')).toBe(true);
      });
    });

    describe('UUID Validation', () => {
      it('should reject invalid sector_id format', () => {
        const result = validateListingData({
          ...validListingData,
          sector_id: 'invalid-uuid'
        });
        expect(result.isValid).toBe(false);
        expect(result.errors.some(e => e.field === 'sector_id' && e.code === 'INVALID_FORMAT')).toBe(true);
      });

      it('should reject invalid use_class_id format', () => {
        const result = validateListingData({
          ...validListingData,
          use_class_id: 'invalid-uuid'
        });
        expect(result.isValid).toBe(false);
        expect(result.errors.some(e => e.field === 'use_class_id' && e.code === 'INVALID_FORMAT')).toBe(true);
      });
    });

    // =====================================================
    // PARTIAL VALIDATION TESTS
    // =====================================================

    describe('Partial Data Validation', () => {
      it('should validate partial data for updates', () => {
        const partialData = {
          title: 'Updated Title',
          contact_name: 'Jane Smith'
        };
        const result = validateListingData(partialData);
        expect(result.isValid).toBe(true);
      });

      it('should still enforce validation rules on provided fields', () => {
        const partialData = {
          title: 'AB', // Too short
          contact_email: 'invalid-email'
        };
        const result = validateListingData(partialData);
        expect(result.isValid).toBe(false);
        expect(result.errors).toHaveLength(2);
      });
    });
  });
});
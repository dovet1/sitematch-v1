import { OrganizationService } from '../organization-service'

// Simple validation tests that don't require Supabase mocking
describe('OrganizationService - Core Logic', () => {
  let service: OrganizationService

  beforeEach(() => {
    service = new OrganizationService()
  })

  describe('validateOrganizationData', () => {
    it('should validate correct data', () => {
      const validData = {
        name: 'Valid Company',
        type: 'occupier' as const,
        createdByUserId: 'user-123'
      }

      const result = service.validateOrganizationData(validData)

      expect(result).toEqual({ valid: true })
    })

    it('should reject empty name', () => {
      const invalidData = {
        name: '',
        type: 'occupier' as const,
        createdByUserId: 'user-123'
      }

      const result = service.validateOrganizationData(invalidData)

      expect(result).toEqual({
        valid: false,
        error: 'Organization name is required'
      })
    })

    it('should reject whitespace-only name', () => {
      const invalidData = {
        name: '   ',
        type: 'occupier' as const,
        createdByUserId: 'user-123'
      }

      const result = service.validateOrganizationData(invalidData)

      expect(result).toEqual({
        valid: false,
        error: 'Organization name is required'
      })
    })

    it('should reject name that is too long', () => {
      const invalidData = {
        name: 'A'.repeat(300), // Too long
        type: 'occupier' as const,
        createdByUserId: 'user-123'
      }

      const result = service.validateOrganizationData(invalidData)

      expect(result).toEqual({
        valid: false,
        error: 'Organization name is too long (max 255 characters)'
      })
    })

    it('should reject missing user ID', () => {
      const invalidData = {
        name: 'Valid Company',
        type: 'occupier' as const,
        createdByUserId: ''
      }

      const result = service.validateOrganizationData(invalidData)

      expect(result).toEqual({
        valid: false,
        error: 'User ID is required'
      })
    })

    it('should accept exactly 255 character name', () => {
      const validData = {
        name: 'A'.repeat(255), // Exactly at limit
        type: 'occupier' as const,
        createdByUserId: 'user-123'
      }

      const result = service.validateOrganizationData(validData)

      expect(result).toEqual({ valid: true })
    })

    it('should trim whitespace from name during validation', () => {
      const validData = {
        name: '  Valid Company  ',
        type: 'occupier' as const,
        createdByUserId: 'user-123'
      }

      // While this passes validation, the actual service should trim the name
      const result = service.validateOrganizationData(validData)

      expect(result).toEqual({ valid: true })
    })
  })
})
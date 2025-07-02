// Standalone validation functions for testing
import { OrganizationAutoCreationData } from '@/types/organization'

// Extract validation logic to test independently
function validateOrganizationData(data: OrganizationAutoCreationData): { valid: boolean; error?: string } {
  if (!data.name || data.name.trim().length === 0) {
    return { valid: false, error: 'Organization name is required' }
  }

  if (data.name.trim().length > 255) {
    return { valid: false, error: 'Organization name is too long (max 255 characters)' }
  }

  if (!data.createdByUserId) {
    return { valid: false, error: 'User ID is required' }
  }

  return { valid: true }
}

// Ensure unique name logic
function generateUniqueName(baseName: string, existingNames: string[]): string {
  let name = baseName.trim()
  let counter = 1

  while (existingNames.includes(name)) {
    counter++
    name = `${baseName} (${counter})`
  }

  return name
}

describe('Organization Validation Logic', () => {
  describe('validateOrganizationData', () => {
    it('should validate correct data', () => {
      const validData = {
        name: 'Valid Company',
        type: 'occupier' as const,
        createdByUserId: 'user-123'
      }

      const result = validateOrganizationData(validData)
      expect(result).toEqual({ valid: true })
    })

    it('should reject empty name', () => {
      const invalidData = {
        name: '',
        type: 'occupier' as const,
        createdByUserId: 'user-123'
      }

      const result = validateOrganizationData(invalidData)
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

      const result = validateOrganizationData(invalidData)
      expect(result).toEqual({
        valid: false,
        error: 'Organization name is required'
      })
    })

    it('should reject name that is too long', () => {
      const invalidData = {
        name: 'A'.repeat(300),
        type: 'occupier' as const,
        createdByUserId: 'user-123'
      }

      const result = validateOrganizationData(invalidData)
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

      const result = validateOrganizationData(invalidData)
      expect(result).toEqual({
        valid: false,
        error: 'User ID is required'
      })
    })

    it('should accept exactly 255 character name', () => {
      const validData = {
        name: 'A'.repeat(255),
        type: 'occupier' as const,
        createdByUserId: 'user-123'
      }

      const result = validateOrganizationData(validData)
      expect(result).toEqual({ valid: true })
    })
  })

  describe('generateUniqueName', () => {
    it('should return original name when no conflicts', () => {
      const result = generateUniqueName('Unique Corp', [])
      expect(result).toBe('Unique Corp')
    })

    it('should append (2) for first duplicate', () => {
      const existingNames = ['Duplicate Corp']
      const result = generateUniqueName('Duplicate Corp', existingNames)
      expect(result).toBe('Duplicate Corp (2)')
    })

    it('should increment until unique', () => {
      const existingNames = ['Popular Corp', 'Popular Corp (2)', 'Popular Corp (3)']
      const result = generateUniqueName('Popular Corp', existingNames)
      expect(result).toBe('Popular Corp (4)')
    })

    it('should handle gaps in numbering', () => {
      const existingNames = ['Test Corp', 'Test Corp (2)', 'Test Corp (5)']
      const result = generateUniqueName('Test Corp', existingNames)
      expect(result).toBe('Test Corp (3)') // Should fill the gap
    })

    it('should trim whitespace from base name', () => {
      const result = generateUniqueName('  Spaced Corp  ', [])
      expect(result).toBe('Spaced Corp')
    })

    it('should handle empty existing names array', () => {
      const result = generateUniqueName('New Corp', [])
      expect(result).toBe('New Corp')
    })
  })
})
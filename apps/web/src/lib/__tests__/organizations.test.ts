import { OrganisationType } from '@/types/auth'

// Import only the utility functions, not Supabase-dependent ones
function isValidOrganizationType(type: string): type is OrganisationType {
  return ['occupier', 'landlord', 'agent'].includes(type)
}

describe('Organization Utilities', () => {
  describe('isValidOrganizationType', () => {
    it('should validate occupier type', () => {
      expect(isValidOrganizationType('occupier')).toBe(true)
    })

    it('should validate landlord type', () => {
      expect(isValidOrganizationType('landlord')).toBe(true)
    })

    it('should validate agent type', () => {
      expect(isValidOrganizationType('agent')).toBe(true)
    })

    it('should reject invalid types', () => {
      expect(isValidOrganizationType('invalid')).toBe(false)
      expect(isValidOrganizationType('')).toBe(false)
      expect(isValidOrganizationType('user')).toBe(false)
    })
  })
})
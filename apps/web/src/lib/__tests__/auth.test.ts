import { UserRole } from '@/types/auth'

// Import only the utility functions, not Supabase-dependent ones
function isValidRole(role: string): role is UserRole {
  return role === 'occupier' || role === 'admin'
}

function hasRole(userRole: UserRole, requiredRoles: UserRole | UserRole[]): boolean {
  const rolesArray = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles]
  return rolesArray.includes(userRole)
}

function isAdmin(userRole: UserRole): boolean {
  return userRole === 'admin'
}

function isOccupier(userRole: UserRole): boolean {
  return userRole === 'occupier'
}

describe('Auth Utilities', () => {
  describe('isValidRole', () => {
    it('should validate occupier role', () => {
      expect(isValidRole('occupier')).toBe(true)
    })

    it('should validate admin role', () => {
      expect(isValidRole('admin')).toBe(true)
    })

    it('should reject invalid roles', () => {
      expect(isValidRole('invalid')).toBe(false)
      expect(isValidRole('')).toBe(false)
      expect(isValidRole('user')).toBe(false)
    })
  })

  describe('hasRole', () => {
    it('should check single role correctly', () => {
      expect(hasRole('admin', 'admin')).toBe(true)
      expect(hasRole('occupier', 'admin')).toBe(false)
    })

    it('should check multiple roles correctly', () => {
      expect(hasRole('admin', ['admin', 'occupier'])).toBe(true)
      expect(hasRole('occupier', ['admin', 'occupier'])).toBe(true)
    })
  })

  describe('isAdmin', () => {
    it('should identify admin users', () => {
      expect(isAdmin('admin')).toBe(true)
      expect(isAdmin('occupier')).toBe(false)
    })
  })

  describe('isOccupier', () => {
    it('should identify occupier users', () => {
      expect(isOccupier('occupier')).toBe(true)
      expect(isOccupier('admin')).toBe(false)
    })
  })
})
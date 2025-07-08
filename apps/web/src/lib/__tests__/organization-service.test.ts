import { OrganizationService } from '../organization-service'

// Mock Supabase clients with complete chain
const createMockSupabaseChain = () => {
  const mockChain = {
    from: jest.fn(() => mockChain),
    select: jest.fn(() => mockChain),
    insert: jest.fn(() => mockChain),
    update: jest.fn(() => mockChain),
    delete: jest.fn(() => mockChain),
    eq: jest.fn(() => mockChain),
    single: jest.fn(),
    maybeSingle: jest.fn()
  }
  return mockChain
}

jest.mock('../supabase', () => ({
  createClient: jest.fn(() => createMockSupabaseChain()),
  createAdminClient: jest.fn(() => createMockSupabaseChain())
}))

// Audit service removed

describe('OrganizationService', () => {
  let service: OrganizationService
  let mockSupabaseClient: any
  let mockAdminClient: any

  beforeEach(() => {
    jest.clearAllMocks()
    
    // Get fresh mock instances
    const { createClient, createAdminClient } = require('../supabase')
    mockSupabaseClient = createClient()
    mockAdminClient = createAdminClient()
    
    service = new OrganizationService()
  })

  describe('getUserOrganizationInfo', () => {
    it('should return organization info when user has org', async () => {
      const mockUser = {
        org_id: 'org-123',
        organisations: { name: 'Test Org' }
      }

      mockSupabaseClient.single.mockResolvedValue({
        data: mockUser,
        error: null
      })

      const result = await service.getUserOrganizationInfo('user-123')

      expect(result).toEqual({
        hasOrganization: true,
        organizationId: 'org-123',
        organizationName: 'Test Org'
      })
    })

    it('should return no organization when user has no org', async () => {
      const mockUser = {
        org_id: null,
        organisations: null
      }

      mockSupabaseClient.single.mockResolvedValue({
        data: mockUser,
        error: null
      })

      const result = await service.getUserOrganizationInfo('user-123')

      expect(result).toEqual({
        hasOrganization: false
      })
    })

    it('should handle database errors gracefully', async () => {
      mockSupabaseClient.single.mockResolvedValue({
        data: null,
        error: { message: 'Database error' }
      })

      const result = await service.getUserOrganizationInfo('user-123')

      expect(result).toEqual({
        hasOrganization: false
      })
    })
  })

  describe('ensureUniqueOrganizationName', () => {
    it('should return original name when no duplicates exist', async () => {
      mockSupabaseClient.maybeSingle.mockResolvedValue({
        data: null,
        error: null
      })

      const result = await service.ensureUniqueOrganizationName('Unique Corp')

      expect(result).toBe('Unique Corp')
    })

    it('should append number when duplicate exists', async () => {
      // First call returns duplicate, second call returns null (unique)
      mockSupabaseClient.maybeSingle
        .mockResolvedValueOnce({ data: { id: 'existing' }, error: null })
        .mockResolvedValueOnce({ data: null, error: null })

      const result = await service.ensureUniqueOrganizationName('Duplicate Corp')

      expect(result).toBe('Duplicate Corp (2)')
    })

    it('should increment number until unique name found', async () => {
      // Mock multiple duplicates
      mockSupabaseClient.maybeSingle
        .mockResolvedValueOnce({ data: { id: 'existing-1' }, error: null }) // Original exists
        .mockResolvedValueOnce({ data: { id: 'existing-2' }, error: null }) // (2) exists  
        .mockResolvedValueOnce({ data: { id: 'existing-3' }, error: null }) // (3) exists
        .mockResolvedValueOnce({ data: null, error: null }) // (4) is unique

      const result = await service.ensureUniqueOrganizationName('Popular Corp')

      expect(result).toBe('Popular Corp (4)')
    })
  })

  describe('createOrganizationFromCompanyInfo', () => {
    const validOrgData = {
      name: 'Test Company',
      type: 'occupier' as const,
      createdByUserId: 'user-123'
    }

    it('should create organization successfully', async () => {
      const mockOrg = {
        id: 'org-456',
        name: 'Test Company',
        type: 'occupier'
      }

      // Mock unique name check
      mockSupabaseClient.from().select().eq().maybeSingle.mockResolvedValue({
        data: null,
        error: null
      })

      // Mock organization creation
      mockAdminClient.from().insert().select().single.mockResolvedValue({
        data: mockOrg,
        error: null
      })

      // Mock user assignment
      mockAdminClient.from().update().eq.mockResolvedValue({
        error: null
      })

      const result = await service.createOrganizationFromCompanyInfo(validOrgData)

      expect(result).toEqual({
        success: true,
        organizationId: 'org-456',
        organizationName: 'Test Company'
      })

      // Audit logging removed
    })

    it('should handle organization creation database error', async () => {
      // Mock unique name check
      mockSupabaseClient.from().select().eq().maybeSingle.mockResolvedValue({
        data: null,
        error: null
      })

      // Mock organization creation failure
      mockAdminClient.from().insert().select().single.mockResolvedValue({
        data: null,
        error: { message: 'Database constraint violation' }
      })

      const result = await service.createOrganizationFromCompanyInfo(validOrgData)

      expect(result).toEqual({
        success: false,
        error: 'Failed to create organization',
        errorCode: 'DATABASE_ERROR'
      })
    })

    it('should rollback organization on user assignment failure', async () => {
      const mockOrg = {
        id: 'org-456',
        name: 'Test Company',
        type: 'occupier'
      }

      // Mock unique name check
      mockSupabaseClient.from().select().eq().maybeSingle.mockResolvedValue({
        data: null,
        error: null
      })

      // Mock organization creation success
      mockAdminClient.from().insert().select().single.mockResolvedValue({
        data: mockOrg,
        error: null
      })

      // Mock user assignment failure
      mockAdminClient.from().update().eq.mockResolvedValue({
        error: { message: 'User assignment failed' }
      })

      // Mock rollback delete
      const mockDelete = jest.fn().mockResolvedValue({ error: null })
      mockAdminClient.from().delete.mockReturnValue({
        eq: mockDelete
      })

      const result = await service.createOrganizationFromCompanyInfo(validOrgData)

      expect(result).toEqual({
        success: false,
        error: 'Failed to assign user to organization',
        errorCode: 'USER_ASSIGNMENT_ERROR'
      })

      // Verify rollback was called
      expect(mockDelete).toHaveBeenCalledWith('org-456')
    })

    it('should handle duplicate name resolution', async () => {
      const mockOrg = {
        id: 'org-456',
        name: 'Test Company (2)',
        type: 'occupier'
      }

      // Mock duplicate name exists, then unique
      mockSupabaseClient.from().select().eq().maybeSingle
        .mockResolvedValueOnce({ data: { id: 'existing' }, error: null })
        .mockResolvedValueOnce({ data: null, error: null })

      // Mock organization creation
      mockAdminClient.from().insert().select().single.mockResolvedValue({
        data: mockOrg,
        error: null
      })

      // Mock user assignment
      mockAdminClient.from().update().eq.mockResolvedValue({
        error: null
      })

      const result = await service.createOrganizationFromCompanyInfo(validOrgData)

      expect(result).toEqual({
        success: true,
        organizationId: 'org-456',
        organizationName: 'Test Company (2)'
      })

      // Audit logging removed
    })
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
  })

  describe('assignUserToOrganization', () => {
    it('should assign user successfully', async () => {
      mockAdminClient.from().update().eq.mockResolvedValue({
        error: null
      })

      const result = await service.assignUserToOrganization('user-123', 'org-456')

      expect(result).toEqual({ success: true })
    })

    it('should handle assignment database error', async () => {
      mockAdminClient.from().update().eq.mockResolvedValue({
        error: { message: 'Database error' }
      })

      const result = await service.assignUserToOrganization('user-123', 'org-456')

      expect(result).toEqual({
        success: false,
        error: 'Failed to assign user to organization'
      })
    })

    it('should handle unexpected errors', async () => {
      mockAdminClient.from().update().eq.mockRejectedValue(new Error('Network error'))

      const result = await service.assignUserToOrganization('user-123', 'org-456')

      expect(result).toEqual({
        success: false,
        error: 'Unexpected error during user assignment'
      })
    })
  })
})
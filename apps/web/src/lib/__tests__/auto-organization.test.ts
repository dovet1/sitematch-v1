import { 
  createListingWithAutoOrganization, 
  getOrCreateOrganizationForUser 
} from '../auto-organization'
import { organizationService } from '../organization-service'

// Mock organization service
jest.mock('../organization-service', () => ({
  organizationService: {
    getUserOrganizationInfo: jest.fn(),
    createOrganizationFromCompanyInfo: jest.fn()
  }
}))

// Mock Supabase
jest.mock('../supabase', () => ({
  createClient: jest.fn(() => ({})),
  createAdminClient: jest.fn(() => ({}))
}))

describe('Auto-Organization Integration', () => {
  const mockOrganizationService = organizationService as jest.Mocked<typeof organizationService>

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('createListingWithAutoOrganization', () => {
    const listingData = {
      companyName: 'Test Company',
      companyDescription: 'A test company',
      title: 'Test Listing',
      requirements: 'Test requirements'
    }

    it('should use existing organization when user has one', async () => {
      mockOrganizationService.getUserOrganizationInfo.mockResolvedValue({
        hasOrganization: true,
        organizationId: 'org-123',
        organizationName: 'Existing Org'
      })

      const result = await createListingWithAutoOrganization(listingData, 'user-123')

      expect(result.success).toBe(true)
      expect(result.organizationId).toBe('org-123')
      expect(result.organizationCreated).toBe(false)
      expect(mockOrganizationService.createOrganizationFromCompanyInfo).not.toHaveBeenCalled()
    })

    it('should create new organization when user has none', async () => {
      mockOrganizationService.getUserOrganizationInfo.mockResolvedValue({
        hasOrganization: false
      })

      mockOrganizationService.createOrganizationFromCompanyInfo.mockResolvedValue({
        success: true,
        organizationId: 'org-456',
        organizationName: 'Test Company'
      })

      const result = await createListingWithAutoOrganization(listingData, 'user-123')

      expect(result.success).toBe(true)
      expect(result.organizationId).toBe('org-456')
      expect(result.organizationCreated).toBe(true)
      
      expect(mockOrganizationService.createOrganizationFromCompanyInfo).toHaveBeenCalledWith({
        name: 'Test Company',
        description: 'A test company',
        type: 'occupier',
        createdByUserId: 'user-123'
      })
    })

    it('should fail when organization creation fails', async () => {
      mockOrganizationService.getUserOrganizationInfo.mockResolvedValue({
        hasOrganization: false
      })

      mockOrganizationService.createOrganizationFromCompanyInfo.mockResolvedValue({
        success: false,
        error: 'Database error',
        errorCode: 'DATABASE_ERROR'
      })

      const result = await createListingWithAutoOrganization(listingData, 'user-123')

      expect(result.success).toBe(false)
      expect(result.error).toContain('Organization creation failed')
    })

    it('should handle unexpected errors gracefully', async () => {
      mockOrganizationService.getUserOrganizationInfo.mockRejectedValue(
        new Error('Network error')
      )

      const result = await createListingWithAutoOrganization(listingData, 'user-123')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Unexpected error during listing creation with auto-organization')
    })
  })

  describe('getOrCreateOrganizationForUser', () => {
    it('should return existing organization', async () => {
      mockOrganizationService.getUserOrganizationInfo.mockResolvedValue({
        hasOrganization: true,
        organizationId: 'org-123',
        organizationName: 'Existing Org'
      })

      const result = await getOrCreateOrganizationForUser('user-123', 'Test Company')

      expect(result).toEqual({
        organizationId: 'org-123',
        organizationCreated: false
      })

      expect(mockOrganizationService.createOrganizationFromCompanyInfo).not.toHaveBeenCalled()
    })

    it('should create new organization when none exists', async () => {
      mockOrganizationService.getUserOrganizationInfo.mockResolvedValue({
        hasOrganization: false
      })

      mockOrganizationService.createOrganizationFromCompanyInfo.mockResolvedValue({
        success: true,
        organizationId: 'org-456',
        organizationName: 'Test Company'
      })

      const result = await getOrCreateOrganizationForUser(
        'user-123', 
        'Test Company', 
        'Company description'
      )

      expect(result).toEqual({
        organizationId: 'org-456',
        organizationCreated: true
      })

      expect(mockOrganizationService.createOrganizationFromCompanyInfo).toHaveBeenCalledWith({
        name: 'Test Company',
        description: 'Company description',
        type: 'occupier',
        createdByUserId: 'user-123'
      })
    })

    it('should handle organization creation failure', async () => {
      mockOrganizationService.getUserOrganizationInfo.mockResolvedValue({
        hasOrganization: false
      })

      mockOrganizationService.createOrganizationFromCompanyInfo.mockResolvedValue({
        success: false,
        error: 'Creation failed',
        errorCode: 'VALIDATION_ERROR'
      })

      const result = await getOrCreateOrganizationForUser('user-123', 'Test Company')

      expect(result).toEqual({
        organizationId: '',
        organizationCreated: false,
        error: 'Creation failed'
      })
    })

    it('should handle unexpected errors', async () => {
      mockOrganizationService.getUserOrganizationInfo.mockRejectedValue(
        new Error('Service unavailable')
      )

      const result = await getOrCreateOrganizationForUser('user-123', 'Test Company')

      expect(result).toEqual({
        organizationId: '',
        organizationCreated: false,
        error: 'Unexpected error during organization creation'
      })
    })

    it('should work without description parameter', async () => {
      mockOrganizationService.getUserOrganizationInfo.mockResolvedValue({
        hasOrganization: false
      })

      mockOrganizationService.createOrganizationFromCompanyInfo.mockResolvedValue({
        success: true,
        organizationId: 'org-456',
        organizationName: 'Test Company'
      })

      const result = await getOrCreateOrganizationForUser('user-123', 'Test Company')

      expect(result.organizationCreated).toBe(true)
      expect(mockOrganizationService.createOrganizationFromCompanyInfo).toHaveBeenCalledWith({
        name: 'Test Company',
        description: undefined,
        type: 'occupier',
        createdByUserId: 'user-123'
      })
    })
  })
})
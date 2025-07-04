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

// Mock listings service
jest.mock('../listings', () => ({
  createListing: jest.fn(),
  getSectors: jest.fn(),
  getUseClasses: jest.fn()
}))

// Mock Supabase
jest.mock('../supabase', () => ({
  createClient: jest.fn(() => ({})),
  createAdminClient: jest.fn(() => ({}))
}))

describe('Auto-Organization Integration', () => {
  const mockOrganizationService = organizationService as jest.Mocked<typeof organizationService>
  
  // Import the mocked listings service
  const mockListingsService = require('../listings')

  beforeEach(() => {
    jest.clearAllMocks()
    
    // Setup default mocks for listings service
    mockListingsService.getSectors.mockResolvedValue([
      { id: 'sector-1', name: 'retail', description: 'Retail businesses' },
      { id: 'sector-2', name: 'office', description: 'Office spaces' }
    ])
    
    mockListingsService.getUseClasses.mockResolvedValue([
      { id: 'use-class-1', code: 'E(a)', name: 'Retail', description: 'Retail use' },
      { id: 'use-class-2', code: 'E(g)(i)', name: 'Office', description: 'Office use' }
    ])
    
    mockListingsService.createListing.mockResolvedValue({
      id: 'listing-123',
      title: 'Test Listing',
      org_id: 'org-123'
    })
  })

  describe('createListingWithAutoOrganization', () => {
    const listingData = {
      // Company data
      companyName: 'Test Company',
      
      // Listing data
      title: 'Test Listing',
      description: 'Test listing description',
      sector: 'retail' as const,
      useClassId: 'use-class-1',
      siteSizeMin: 1000,
      siteSizeMax: 5000,
      contactName: 'John Doe',
      contactTitle: 'Manager',
      contactEmail: 'john@test.com',
      contactPhone: '+44123456789'
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
      expect(result.listingId).toBe('listing-123')
      expect(mockOrganizationService.createOrganizationFromCompanyInfo).not.toHaveBeenCalled()
      
      // Verify listing was created with correct data
      expect(mockListingsService.createListing).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Test Listing',
          description: 'Test listing description',
          sector_id: 'sector-1',
          use_class_id: 'use-class-1',
          contact_name: 'John Doe',
          contact_title: 'Manager',
          contact_email: 'john@test.com',
          contact_phone: '+44123456789'
        }),
        'user-123',
        'org-123'
      )
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
      expect(result.listingId).toBe('listing-123')
      
      expect(mockOrganizationService.createOrganizationFromCompanyInfo).toHaveBeenCalledWith({
        name: 'Test Company',
        type: 'occupier',
        createdByUserId: 'user-123'
      })
      
      // Verify listing was created with new organization
      expect(mockListingsService.createListing).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Test Listing',
          sector_id: 'sector-1',
          use_class_id: 'use-class-1'
        }),
        'user-123',
        'org-456'
      )
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

    it('should fail when sector mapping fails', async () => {
      mockOrganizationService.getUserOrganizationInfo.mockResolvedValue({
        hasOrganization: true,
        organizationId: 'org-123',
        organizationName: 'Existing Org'
      })

      // Return sectors that don't include the requested sector
      mockListingsService.getSectors.mockResolvedValue([
        { id: 'sector-2', name: 'office', description: 'Office spaces' }
      ])

      const result = await createListingWithAutoOrganization(listingData, 'user-123')

      expect(result.success).toBe(false)
      expect(result.error).toContain('Invalid sector: retail')
    })

    it('should fail when use class mapping fails', async () => {
      mockOrganizationService.getUserOrganizationInfo.mockResolvedValue({
        hasOrganization: true,
        organizationId: 'org-123',
        organizationName: 'Existing Org'
      })

      // Return use classes that don't include the requested use class
      mockListingsService.getUseClasses.mockResolvedValue([
        { id: 'use-class-2', code: 'E(g)(i)', name: 'Office', description: 'Office use' }
      ])

      const result = await createListingWithAutoOrganization(listingData, 'user-123')

      expect(result.success).toBe(false)
      expect(result.error).toContain('Invalid use class ID: use-class-1')
    })

    it('should handle listing creation failures', async () => {
      mockOrganizationService.getUserOrganizationInfo.mockResolvedValue({
        hasOrganization: true,
        organizationId: 'org-123',
        organizationName: 'Existing Org'
      })

      mockListingsService.createListing.mockRejectedValue(
        new Error('Database connection failed')
      )

      const result = await createListingWithAutoOrganization(listingData, 'user-123')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Database connection failed')
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
        'Test Company'
      )

      expect(result).toEqual({
        organizationId: 'org-456',
        organizationCreated: true
      })

      expect(mockOrganizationService.createOrganizationFromCompanyInfo).toHaveBeenCalledWith({
        name: 'Test Company',
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
        type: 'occupier',
        createdByUserId: 'user-123'
      })
    })
  })
})
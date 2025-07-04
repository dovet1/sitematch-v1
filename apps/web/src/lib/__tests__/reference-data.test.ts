import {
  getUseClassOptions,
  validateSectorOptions,
  mapSectorToId,
  validateUseClassId,
  clearReferenceDataCache,
  SECTOR_OPTIONS
} from '../reference-data';

// Mock listings service
jest.mock('../listings', () => ({
  getSectors: jest.fn(),
  getUseClasses: jest.fn()
}));

describe('Reference Data Service', () => {
  const mockListingsService = require('../listings');

  beforeEach(() => {
    jest.clearAllMocks();
    clearReferenceDataCache();
  });

  describe('getUseClassOptions', () => {
    it('should return formatted use class options from database', async () => {
      const mockUseClasses = [
        { id: 'uc-1', code: 'E(a)', name: 'Retail', description: 'Retail use' },
        { id: 'uc-2', code: 'B2', name: 'Industrial', description: 'Industrial use' }
      ];

      mockListingsService.getUseClasses.mockResolvedValue(mockUseClasses);

      const result = await getUseClassOptions();

      expect(result).toEqual([
        { value: 'uc-1', label: 'E(a) - Retail', description: 'Retail use' },
        { value: 'uc-2', label: 'B2 - Industrial', description: 'Industrial use' }
      ]);
    });

    it('should cache results and not call database twice', async () => {
      const mockUseClasses = [
        { id: 'uc-1', code: 'E(a)', name: 'Retail', description: 'Retail use' }
      ];

      mockListingsService.getUseClasses.mockResolvedValue(mockUseClasses);

      // First call
      await getUseClassOptions();
      // Second call
      await getUseClassOptions();

      expect(mockListingsService.getUseClasses).toHaveBeenCalledTimes(1);
    });

    it('should return fallback options when database fails', async () => {
      mockListingsService.getUseClasses.mockRejectedValue(new Error('Database error'));

      const result = await getUseClassOptions();

      expect(result).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            value: 'fallback-retail',
            label: 'E(a) - Retail',
            description: 'Display or retail sale of goods'
          })
        ])
      );
      expect(result).toHaveLength(8); // PRD specifies 8 use classes
    });

    it('should handle use classes without descriptions', async () => {
      const mockUseClasses = [
        { id: 'uc-1', code: 'E(a)', name: 'Retail', description: null }
      ];

      mockListingsService.getUseClasses.mockResolvedValue(mockUseClasses);

      const result = await getUseClassOptions();

      expect(result[0]).toEqual({
        value: 'uc-1',
        label: 'E(a) - Retail',
        description: undefined
      });
    });
  });

  describe('validateSectorOptions', () => {
    it('should return valid when all PRD sectors exist in database', async () => {
      const mockSectors = SECTOR_OPTIONS.map(option => ({
        id: `sector-${option.value}`,
        name: option.value,
        description: option.description
      }));

      mockListingsService.getSectors.mockResolvedValue(mockSectors);

      const result = await validateSectorOptions();

      expect(result.valid).toBe(true);
      expect(result.missingectors).toEqual([]);
    });

    it('should return invalid when sectors are missing from database', async () => {
      const mockSectors = [
        { id: 'sector-1', name: 'retail', description: 'Retail businesses' },
        { id: 'sector-2', name: 'office', description: 'Office spaces' }
        // Missing other PRD sectors
      ];

      mockListingsService.getSectors.mockResolvedValue(mockSectors);

      const result = await validateSectorOptions();

      expect(result.valid).toBe(false);
      expect(result.missingectors).toContain('food_beverage');
      expect(result.missingectors).toContain('healthcare');
      expect(result.missingectors).not.toContain('retail');
      expect(result.missingectors).not.toContain('office');
    });

    it('should handle database errors gracefully', async () => {
      mockListingsService.getSectors.mockRejectedValue(new Error('Database error'));

      const result = await validateSectorOptions();

      expect(result.valid).toBe(false);
      expect(result.missingectors).toEqual(SECTOR_OPTIONS.map(s => s.value));
    });
  });

  describe('mapSectorToId', () => {
    it('should return sector ID for valid sector name', async () => {
      const mockSectors = [
        { id: 'sector-123', name: 'retail', description: 'Retail businesses' },
        { id: 'sector-456', name: 'office', description: 'Office spaces' }
      ];

      mockListingsService.getSectors.mockResolvedValue(mockSectors);

      const result = await mapSectorToId('retail');

      expect(result).toBe('sector-123');
    });

    it('should return null for invalid sector name', async () => {
      const mockSectors = [
        { id: 'sector-123', name: 'retail', description: 'Retail businesses' }
      ];

      mockListingsService.getSectors.mockResolvedValue(mockSectors);

      const result = await mapSectorToId('nonexistent' as any);

      expect(result).toBeNull();
    });

    it('should handle database errors gracefully', async () => {
      mockListingsService.getSectors.mockRejectedValue(new Error('Database error'));

      const result = await mapSectorToId('retail');

      expect(result).toBeNull();
    });
  });

  describe('validateUseClassId', () => {
    it('should return true for valid use class ID', async () => {
      const mockUseClasses = [
        { id: 'uc-123', code: 'E(a)', name: 'Retail' },
        { id: 'uc-456', code: 'B2', name: 'Industrial' }
      ];

      mockListingsService.getUseClasses.mockResolvedValue(mockUseClasses);

      const result = await validateUseClassId('uc-123');

      expect(result).toBe(true);
    });

    it('should return false for invalid use class ID', async () => {
      const mockUseClasses = [
        { id: 'uc-123', code: 'E(a)', name: 'Retail' }
      ];

      mockListingsService.getUseClasses.mockResolvedValue(mockUseClasses);

      const result = await validateUseClassId('invalid-id');

      expect(result).toBe(false);
    });

    it('should handle database errors gracefully', async () => {
      mockListingsService.getUseClasses.mockRejectedValue(new Error('Database error'));

      const result = await validateUseClassId('uc-123');

      expect(result).toBe(false);
    });
  });

  describe('SECTOR_OPTIONS constant', () => {
    it('should contain all PRD-specified sectors', () => {
      const sectorValues = SECTOR_OPTIONS.map(s => s.value);
      
      expect(sectorValues).toContain('retail');
      expect(sectorValues).toContain('food_beverage');
      expect(sectorValues).toContain('leisure');
      expect(sectorValues).toContain('industrial_logistics');
      expect(sectorValues).toContain('office');
      expect(sectorValues).toContain('healthcare');
      expect(sectorValues).toContain('automotive');
      expect(sectorValues).toContain('roadside');
      expect(sectorValues).toContain('other');
      
      expect(SECTOR_OPTIONS).toHaveLength(9);
    });

    it('should have proper structure for each sector option', () => {
      SECTOR_OPTIONS.forEach(option => {
        expect(option).toHaveProperty('value');
        expect(option).toHaveProperty('label');
        expect(option).toHaveProperty('description');
        expect(typeof option.value).toBe('string');
        expect(typeof option.label).toBe('string');
        expect(typeof option.description).toBe('string');
      });
    });
  });
});
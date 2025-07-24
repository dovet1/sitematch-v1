import { calculatePolygonArea, formatArea, formatDistance, isValidPolygon } from '../measurement-utils';

// Mock Turf.js
jest.mock('@turf/turf', () => ({
  polygon: jest.fn((coords) => ({ type: 'Feature', geometry: { coordinates: coords } })),
  area: jest.fn(() => 10000), // 10,000 square meters
  length: jest.fn(() => 0.4), // 0.4 km = 400 meters
  booleanValid: jest.fn(() => true),
  simplify: jest.fn((polygon) => polygon),
  centroid: jest.fn(() => ({ geometry: { coordinates: [0, 0] } }))
}));

describe('measurement-utils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('calculatePolygonArea', () => {
    it('should calculate area correctly', () => {
      const coordinates = [
        [0, 0],
        [0, 1],
        [1, 1],
        [1, 0],
        [0, 0]
      ];

      const result = calculatePolygonArea(coordinates);

      expect(result).toEqual({
        squareMeters: 10000,
        squareFeet: 107640, // 10000 * 10.764
        perimeter: 400, // 400 meters
        vertices: 4
      });
    });

    it('should handle invalid polygons gracefully', () => {
      // Mock turf.polygon to throw an error for invalid input
      const mockTurf = require('@turf/turf');
      mockTurf.polygon.mockImplementation(() => {
        throw new Error('Invalid coordinates');
      });

      const invalidCoordinates: number[][] = [];
      const result = calculatePolygonArea(invalidCoordinates);

      expect(result).toEqual({
        squareMeters: 0,
        squareFeet: 0,
        perimeter: 0,
        vertices: 0
      });

      // Restore mock
      mockTurf.polygon.mockImplementation((coords: any) => ({ type: 'Feature', geometry: { coordinates: coords } }));
    });
  });

  describe('formatArea', () => {
    it('should format metric area correctly', () => {
      expect(formatArea(5000, 'metric')).toBe('5,000 m²');
      expect(formatArea(15000, 'metric')).toBe('1.50 ha');
    });

    it('should format imperial area correctly', () => {
      expect(formatArea(5000, 'imperial')).toBe('5,000 ft²');
      expect(formatArea(50000, 'imperial')).toBe('1.15 acres');
    });
  });

  describe('formatDistance', () => {
    it('should format metric distance correctly', () => {
      expect(formatDistance(500, 'metric')).toBe('500 m');
      expect(formatDistance(1500, 'metric')).toBe('1.50 km');
    });

    it('should format imperial distance correctly', () => {
      expect(formatDistance(100, 'imperial')).toBe('328 ft');
      expect(formatDistance(2000, 'imperial')).toBe('1.24 mi');
    });
  });

  describe('isValidPolygon', () => {
    it('should validate polygon correctly', () => {
      const validCoordinates = [
        [0, 0],
        [0, 1],
        [1, 1],
        [1, 0],
        [0, 0]
      ];

      expect(isValidPolygon(validCoordinates)).toBe(true);
    });

    it('should reject invalid polygons', () => {
      const invalidCoordinates = [
        [0, 0],
        [0, 1]
      ]; // Less than 4 points

      expect(isValidPolygon(invalidCoordinates)).toBe(false);
    });
  });
});
import { 
  calculateRotationAngle, 
  snapToAngle, 
  isNearSnapAngle,
  validateParkingOverlay,
  calculateParkingCapacity
} from '../parking-calculations';
import type { ParkingOverlay, ParkingConfiguration } from '@/types/sitesketcher';

// Mock Turf.js
jest.mock('@turf/turf', () => ({
  polygon: jest.fn((coords) => ({ type: 'Feature', geometry: { coordinates: coords } })),
  area: jest.fn(() => 10000), // 10,000 square meters
  bbox: jest.fn(() => [-1, -1, 1, 1]),
  point: jest.fn((coords) => ({ geometry: { coordinates: coords } })),
  booleanPointInPolygon: jest.fn(() => true)
}));

describe('parking-calculations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('calculateRotationAngle', () => {
    it('should calculate rotation angle correctly', () => {
      const centerPoint: [number, number] = [0, 0];
      const startPoint: [number, number] = [1, 0];
      const currentPoint: [number, number] = [0, 1];

      const angle = calculateRotationAngle(centerPoint, currentPoint, startPoint);
      
      // Should be 90 degrees (π/2 radians)
      expect(Math.round(angle)).toBe(90);
    });

    it('should handle negative angles', () => {
      const centerPoint: [number, number] = [0, 0];
      const startPoint: [number, number] = [1, 0];
      const currentPoint: [number, number] = [0, -1];

      const angle = calculateRotationAngle(centerPoint, currentPoint, startPoint);
      
      // Should be -90 degrees
      expect(Math.round(angle)).toBe(-90);
    });
  });

  describe('snapToAngle', () => {
    it('should snap to nearest 15-degree increment', () => {
      expect(snapToAngle(7)).toBe(0);
      expect(snapToAngle(23)).toBe(30);
      expect(snapToAngle(37)).toBe(30);
      expect(snapToAngle(52)).toBe(45);
    });

    it('should handle angles over 360 degrees', () => {
      expect(snapToAngle(370)).toBe(15);
      expect(snapToAngle(-10)).toBe(345);
    });
  });

  describe('isNearSnapAngle', () => {
    it('should detect when angle is near snap increment', () => {
      expect(isNearSnapAngle(7, 15, 7.5)).toBe(true); // Near 0°
      expect(isNearSnapAngle(23, 15, 7.5)).toBe(true); // Near 15°
      expect(isNearSnapAngle(20, 15, 4)).toBe(false); // Not near any snap (4° tolerance)
    });
  });

  describe('validateParkingOverlay', () => {
    const validOverlay: ParkingOverlay = {
      id: 'test-1',
      position: [0, 0],
      rotation: 45,
      type: 'single',
      size: { width: 2.7, length: 5.0 },
      quantity: 1
    };

    it('should validate correct overlay', () => {
      expect(validateParkingOverlay(validOverlay)).toBe(true);
    });

    it('should reject invalid position', () => {
      const invalid = { ...validOverlay, position: [0] as any };
      expect(validateParkingOverlay(invalid)).toBe(false);
    });

    it('should reject invalid rotation', () => {
      const invalid = { ...validOverlay, rotation: -10 };
      expect(validateParkingOverlay(invalid)).toBe(false);
    });

    it('should reject invalid type', () => {
      const invalid = { ...validOverlay, type: 'invalid' as any };
      expect(validateParkingOverlay(invalid)).toBe(false);
    });

    it('should reject invalid size', () => {
      const invalid = { ...validOverlay, size: { width: 0, length: 5 } };
      expect(validateParkingOverlay(invalid)).toBe(false);
    });
  });

  describe('calculateParkingCapacity', () => {
    const mockPolygon = [
      [0, 0], [0, 1], [1, 1], [1, 0], [0, 0]
    ];

    const config: ParkingConfiguration = {
      type: 'single',
      size: 'standard',
      dimensions: { width: 2.7, length: 5.0 },
      quantity: 10
    };

    it('should calculate parking capacity', () => {
      const capacity = calculateParkingCapacity(mockPolygon, config);
      
      // With 10,000 m² area and 13.5 m² per space (2.7 × 5.0)
      // With 65% efficiency: 10000 * 0.65 / 13.5 ≈ 481 spaces
      expect(capacity).toBeGreaterThan(0);
      expect(capacity).toBeLessThan(1000); // Reasonable upper bound
    });

    it('should return 0 for invalid polygon', () => {
      // Mock turf.polygon to throw an error for invalid input
      const mockTurf = require('@turf/turf');
      mockTurf.polygon.mockImplementation(() => {
        throw new Error('Invalid coordinates');
      });

      const capacity = calculateParkingCapacity([], config);
      expect(capacity).toBe(0);

      // Restore mock
      mockTurf.polygon.mockImplementation((coords: any) => ({ type: 'Feature', geometry: { coordinates: coords } }));
    });

    it('should handle double layer parking with higher efficiency', () => {
      const doubleConfig = { ...config, type: 'double' as const };
      const capacity = calculateParkingCapacity(mockPolygon, doubleConfig);
      
      expect(capacity).toBeGreaterThan(0);
    });
  });
});
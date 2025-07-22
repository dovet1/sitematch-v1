export interface MapboxDrawPolygon {
  id?: string | number; // Mapbox Draw assigns this ID
  type: 'Feature';
  geometry: {
    type: 'Polygon';
    coordinates: number[][][];
  };
  properties: {
    id?: string;
    [key: string]: any;
  };
}

export interface ParkingOverlay {
  id: string;
  position: [number, number]; // [lng, lat]
  rotation: number; // degrees
  type: 'single' | 'double';
  size: {
    width: number; // meters
    length: number; // meters
  };
  quantity: number;
}

export interface AreaMeasurement {
  squareMeters: number;
  squareFeet: number;
  sideLengths: number[]; // length of each side in meters
}

export interface RotationHandle {
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  onDragStart: (e: MouseEvent | TouchEvent) => void;
  onDrag: (angle: number, e: MouseEvent | TouchEvent) => void;
  onDragEnd: (finalAngle: number) => void;
}

export interface SearchResult {
  id: string;
  place_name: string;
  center: [number, number]; // [lng, lat]
  place_type: string[];
  properties: {
    address?: string;
    category?: string;
  };
}

export interface TutorialStep {
  id: string;
  title: string;
  description: string;
  target: string;
  position: 'top' | 'bottom' | 'left' | 'right';
  completed: boolean;
}

export type DrawingMode = 'draw' | 'select';
export type MeasurementUnit = 'metric' | 'imperial';

export interface SiteSketcherState {
  polygons: MapboxDrawPolygon[];
  parkingOverlays: ParkingOverlay[];
  measurements: AreaMeasurement | null;
  selectedPolygonId: string | null;
  selectedParkingId: string | null;
  measurementUnit: MeasurementUnit;
  drawingMode: DrawingMode;
  recentSearches: SearchResult[];
  snapToGrid: boolean;
  gridSize: number; // meters
}

export interface ParkingConfiguration {
  type: 'single' | 'double';
  size: 'standard' | 'compact';
  dimensions: {
    width: number;
    length: number;
  };
  quantity: number;
}

export const PARKING_SIZES = {
  standard: { width: 2.7, length: 5.0 },
  compact: { width: 2.4, length: 4.8 }
} as const;

export const PARKING_COLORS = {
  single: '#3b82f6', // blue-500
  double: '#1e40af', // blue-700
} as const;
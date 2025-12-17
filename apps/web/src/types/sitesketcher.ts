export interface MapboxDrawPolygon {
  id?: string | number; // Mapbox Draw assigns this ID
  type: 'Feature';
  geometry: {
    type: 'Polygon';
    coordinates: number[][][];
  };
  properties: {
    id?: string;
    color?: string;
    measurementUnit?: MeasurementUnit;
    showSideLengths?: boolean;
    storeShapeName?: string;      // Original store shape name (if converted from store shape)
    isFromStoreShape?: boolean;   // Flag to identify shapes created from store shapes
    storeShapeId?: string;        // Link to store shape ID for fetching detail

    // Detail geometry overlay support (loaded on-demand for performance)
    detailGeometry?: GeoJSON.FeatureCollection | GeoJSON.Feature;  // Full interior layout
    detailGeometryLoading?: boolean;  // Loading state for progressive enhancement
    detailOpacity?: number;       // 0-1, default 0.3 for semi-transparent overlay
    showDetailGeometry?: boolean; // Toggle visibility, default true

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

export type DrawingMode = 'draw' | 'select' | 'export-area';
export type MeasurementUnit = 'metric' | 'imperial';
export type ViewMode = '2D' | '3D';

export interface ExportAreaBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

export interface Cuboid3D {
  id: string;
  type: 'Feature';
  geometry: {
    type: 'Polygon';
    coordinates: number[][][];
  };
  properties: {
    height: number; // height in meters
    stories: 1 | 2 | 3;
    base_height: number;
    is3DShape: true;
    color?: string;
    [key: string]: any;
  };
}

export interface SiteSketcherState {
  polygons: MapboxDrawPolygon[];
  parkingOverlays: ParkingOverlay[];
  cuboids: Cuboid3D[];
  measurements: AreaMeasurement | null;
  selectedPolygonId: string | null;
  selectedParkingId: string | null;
  selectedCuboidId: string | null;
  measurementUnit: MeasurementUnit;
  drawingMode: DrawingMode;
  viewMode: ViewMode;
  show3DBuildings: boolean;
  recentSearches: SearchResult[];
  snapToGrid: boolean;
  gridSize: number; // meters
  showSideLengths: boolean;
  exportAreaBounds: ExportAreaBounds | null;
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

export const STORY_HEIGHTS = {
  1: 3.5,   // 1 story = 3.5 meters
  2: 7.0,   // 2 stories = 7 meters
  3: 10.5,  // 3 stories = 10.5 meters
} as const;

export interface SavedSketch {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  data: SiteSketcherState;
  thumbnail_url: string | null;
  location: {
    center: [number, number];
    zoom: number;
  } | null;
  created_at: string;
  updated_at: string;
}

// Store Shapes - Pre-defined store footprints with detailed architectural elements

// Lightweight metadata for list view (no GeoJSON - fetch on-demand for performance)
export interface StoreShapeMetadata {
  id: string;
  name: string;
  description: string | null;
  company_name: string;
  display_order: number;
  is_active: boolean;
  bbox?: {
    min_lng?: number;
    min_lat?: number;
    max_lng?: number;
    max_lat?: number;
    width_degrees?: number;
    height_degrees?: number;
  };
  metadata?: {
    scale_factor?: number;
    source_units?: string;
    insunits_code?: number;
    bbox?: {
      width?: number;
      height?: number;
      width_meters?: number;
      height_meters?: number;
    };
    conversion_method?: 'metadata' | 'heuristic' | 'manual';
    source_filename?: string;
    target_width_meters?: number;
    geojson_feature_count?: number;
    optimized_feature_count?: number;
  };
  created_at: string;
  updated_at: string;
}

// Full shape with GeoJSON (extends metadata)
export interface StoreShape extends StoreShapeMetadata {
  geojson: GeoJSON.FeatureCollection | GeoJSON.Feature;  // Support detailed FeatureCollections
}

export interface PlacedStoreShape {
  id: string;                    // Unique instance ID
  storeShapeId: string;          // Reference to store_shapes.id
  storeShapeName: string;        // Cached name for display
  geojson: GeoJSON.FeatureCollection | GeoJSON.Feature;  // Full GeoJSON with all features
  centroid: [number, number];    // Cached centroid for placement and rotation
  properties: {
    id?: string;
    isStoreShape: true;          // Flag to distinguish from regular polygons
    isLocked: boolean;           // Cannot edit vertices
    rotation: number;            // Rotation angle in degrees
    color?: string;
    [key: string]: any;
  };
}
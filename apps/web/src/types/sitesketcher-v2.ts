// SiteSketcher v2 Type Definitions

export interface Polygon {
  id: string;
  name: string; // "Plot A — Main building"
  colorIndex: number; // 0-5 (index into palette)
  points: [number, number][]; // [lng, lat] GeoJSON
  rotation: number; // degrees
  height: number; // metres (3D)
  showDistances: boolean;
  showArea: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface ParkingBlock {
  id: string;
  name: string;
  spaces: number;
  layout: 'single' | 'double';
  stallSize: 'standard' | 'larger'; // 2.4×4.8 vs 2.7×5.0
  anchor: [number, number]; // center
  rotation: number;
  createdAt: number;
  updatedAt: number;
}

export interface CadImage {
  id: string;
  fileName: string;
  url: string; // Supabase storage public URL
  storagePath: string; // CRITICAL: Storage path for cleanup (e.g., "user-id/123-uuid.png")
  metresPerPixel: number; // from calibration
  anchor: [number, number]; // center
  rotation: number;
  opacity: number; // 0-1
  imageWidthPx: number;
  imageHeightPx: number;
  calibrationPoints?: {
    a: { x: number; y: number };
    b: { x: number; y: number };
    distance: number;
  };
  createdAt: number;
  updatedAt: number;
}

export interface MeasurementPoint {
  lngLat: [number, number];
  distance?: number; // Distance to next point in meters
}

export interface MeasurementChain {
  id: string;
  points: MeasurementPoint[];
  totalDistance: number;
}

export interface MapFocusRequest {
  requestId: number;
  center: [number, number];
  bounds?: [[number, number], [number, number]];
  zoom?: number;
}

export interface PolygonInProgress {
  points: [number, number][];
  colorIndex: number;
}

// Database row shape (matches existing site_sketches table)
export interface SiteSketchRow {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  data: SketchData; // JSONB column
  thumbnail_url?: string;
  location?: { lat: number; lng: number; zoom: number };
  created_at: string;
  updated_at: string;
}

// v2 data shape (stored in data JSONB column)
export interface SketchData {
  version: 2; // v2 marker - critical for filtering
  polygons: Polygon[];
  parkingBlocks: ParkingBlock[];
  cadImages: CadImage[];
  viewport: { center: [number, number]; zoom: number; pitch: number; bearing: number };
  settings: { units: 'metric' | 'imperial'; mapStyle: string; sideLabelsOn: boolean };
}

// Full sketch type (row + parsed data)
export interface Sketch extends Omit<SiteSketchRow, 'data'> {
  data: SketchData;
}

// Tool types
export type Tool = 'select' | 'polygon' | 'parking' | 'cad' | 'measure';

// Map style types
export type MapStyle = 'satellite' | 'hybrid' | 'streets';

// Units type
export type Units = 'metric' | 'imperial';

// View mode type
export type ViewMode = '2d' | '3d';

// History state for undo/redo
export interface HistoryState {
  polygons: Polygon[];
  parkingBlocks: ParkingBlock[];
  cadImages: CadImage[];
  timestamp: number;
}

// Polygon color palette
export interface PolygonColor {
  label: string;
  stroke: string;
  fill: string;
}

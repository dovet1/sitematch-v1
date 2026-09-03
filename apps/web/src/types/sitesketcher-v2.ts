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

// SavedCad: Library item stored in saved_cads table
export interface SavedCad {
  id: string;
  userId: string;
  name: string;
  fileName: string;
  url: string;
  storagePath: string;
  metresPerPixel: number;
  imageWidthPx: number;
  imageHeightPx: number;
  calibrationPoints?: {
    a: { x: number; y: number };
    b: { x: number; y: number };
    distance: number;
  };
  // Provenance metadata — present only on admin-maintained shared-library CADs.
  brand?: string;
  format?: string;
  sourceStore?: string;
  surveyYear?: number;
  gia?: number;
  dims?: string;
  createdAt: string;
  updatedAt: string;
}

// CadInstance: Placed instance stored in sketch JSONB
export interface CadInstance {
  id: string;
  savedCadId: string;
  anchor: [number, number]; // NOT nullable - instance only exists after placement
  rotation: number;
  opacity: number;
  locked?: boolean;
  createdAt: number;
  updatedAt: number;
}

// DEPRECATED: Old CadImage type - will be removed after migration
export interface CadImage {
  id: string;
  fileName: string;
  url: string; // Supabase storage public URL
  storagePath: string; // CRITICAL: Storage path for cleanup (e.g., "user-id/123-uuid.png")
  metresPerPixel: number; // from calibration
  anchor: [number, number] | null; // center (null if not yet placed)
  rotation: number;
  opacity: number; // 0-1
  imageWidthPx: number;
  imageHeightPx: number;
  calibrationPoints?: {
    a: { x: number; y: number };
    b: { x: number; y: number };
    distance: number;
  };
  locked?: boolean; // Prevents accidental dragging
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

// --- Auto parking (see docs/design_handoff_auto_parking/INTEGRATION_PLAN.md) ---

export interface AutoParkingExclusionRef {
  id: string;
  kind: 'polygon' | 'cadInstance' | 'cadImage';
  /** How this exclusion entered the layout. Optional for layouts saved before the guided-building flow. */
  source?: 'drawn' | 'selected' | 'mandatory';
}

export type AutoParkingEntrance =
  | {
      kind: 'building';
      buildingId: string;
      /**
       * Which object `buildingId` refers to. Absent on entrances saved before
       * CAD footprints were entrance-attachable — treat a missing value as
       * 'polygon' for backward compatibility.
       */
      buildingKind?: 'polygon' | 'cadInstance' | 'cadImage';
      edgeIndex: number;
      distanceAlongEdgeM: number;
    }
  | {
      kind: 'target';
      point: [number, number];
    };

export interface AutoParkingSettingsSnapshot {
  stallSize: 'standard' | 'larger';
  aisleWidth: number;
  boundarySetback: number;
  buildingClearance: number; // solver exclusionClearance
  checkManoeuvring: boolean;
  oneWay: boolean; // omitted from SolverInput unless checkManoeuvring
  gateQueueVehicles: number | null; // omitted from SolverInput unless checkManoeuvring
  accessibleBays: { on: boolean; percent: number };
}

export interface AutoParkingMetrics {
  totalSpaces: number;
  standard: number;
  accessible: number;
  rows: number;
  footprintSqm: number;
}

export interface AutoParkingWarning {
  code: string;
  message: string;
}

// A chosen, applied auto-parking layout. Only applied layouts + their
// regeneration inputs are persisted — candidate previews are transient.
export interface AutoParkingLayout {
  id: string;
  name: string; // "Auto layout 1"
  geometrySchemaVersion: 1; // bump to migrate rendering without re-solving
  // regeneration inputs / provenance
  boundaryId: string; // source polygon id
  exclusionRefs: AutoParkingExclusionRef[];
  accessPoint: [number, number]; // snapped lng/lat
  /**
   * Accessible-bay destination. Optional for layouts saved before the guided
   * entrance step; those layouts keep their legacy vehicle-access placement
   * until the user supplies an entrance during regeneration.
   */
  entrance?: AutoParkingEntrance;
  /**
   * The boundary ring at generation time. Optional/backward-compatible
   * (absent on layouts persisted before this field existed) — used to draw
   * the faint "previous boundary" outline once the layout goes stale (see
   * docs/design_handoff_auto_parking_guided/README.md §10, state 06).
   */
  boundarySnapshot?: [number, number][];
  settingsSnapshot: AutoParkingSettingsSnapshot;
  // chosen result — LAYOUT FEATURES ONLY (stall / aisle / access-corridor /
  // access-point), lng/lat. See lib/sitesketcher-v2/auto-parking/geojson.ts.
  geometry: GeoJSON.FeatureCollection;
  metrics: AutoParkingMetrics;
  warnings: AutoParkingWarning[];
  // integrity — canonical hash of: boundary ring + CURRENT mandatory exclusion
  // set derived from it + snapped accessPoint + settingsSnapshot. Staleness is
  // ALWAYS derived by recomputing this hash and comparing — never stored.
  sourceHash: string;
  createdAt: number;
  updatedAt: number;
}

// v2 data shape (stored in data JSONB column)
export interface SketchData {
  version: 2; // v2 marker - critical for filtering
  polygons: Polygon[];
  parkingBlocks: ParkingBlock[];
  cadInstances: CadInstance[]; // CHANGED from cadImages
  cadImages?: CadImage[]; // DEPRECATED: Keep for backward compatibility during transition
  autoLayouts?: AutoParkingLayout[]; // Plus-only; optional so old sketches load without it
  viewport: { center: [number, number]; zoom: number; pitch: number; bearing: number };
  settings: {
    units: 'metric' | 'imperial';
    mapStyle: string;
    sideLabelsOn: boolean;
    parkingMethod?: 'manual' | 'auto'; // per-sketch; defaults to 'manual' when absent
  };
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
  timestamp: number;
}

// Polygon color palette
export interface PolygonColor {
  label: string;
  stroke: string;
  fill: string;
}

// Subscription tier types
export interface TierLimits {
  maxPolygons: number;
  maxParkingBlocks: number;
  maxCadImages: number;
  maxMeasurementPoints: number; // Points, not segments (21 points = 20 segments)
  canSave: boolean;
  canExport: boolean;
}

export type SubscriptionTier = 'free' | 'pro' | 'plus';

export interface LimitStatus {
  current: number;
  max: number;
  reached: boolean;
  remaining: number;
}

export interface EffectiveAccess {
  hasProAccess: boolean; // Pro OR Plus with valid status
  hasPlusAccess: boolean; // Plus with valid status
  tierLimits: TierLimits;
}

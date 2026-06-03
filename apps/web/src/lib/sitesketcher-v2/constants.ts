import { PolygonColor } from '@/types/sitesketcher-v2';

// Polygon color palette (6 colors)
export const POLYGON_COLORS: PolygonColor[] = [
  {
    label: 'Violet',
    stroke: '#7033FF',
    fill: 'rgba(112, 51, 255, 0.18)',
  },
  {
    label: 'Coral',
    stroke: '#F26B1F',
    fill: 'rgba(242, 107, 31, 0.20)',
  },
  {
    label: 'Teal',
    stroke: '#0F9488',
    fill: 'rgba(15, 148, 136, 0.20)',
  },
  {
    label: 'Amber',
    stroke: '#D97706',
    fill: 'rgba(217, 119, 6, 0.20)',
  },
  {
    label: 'Rose',
    stroke: '#E11D74',
    fill: 'rgba(225, 29, 116, 0.18)',
  },
  {
    label: 'Lime',
    stroke: '#65A30D',
    fill: 'rgba(101, 163, 13, 0.20)',
  },
];

// Parking stall dimensions (in meters)
export const PARKING_DIMENSIONS = {
  standard: {
    width: 2.4,
    length: 4.8,
  },
  larger: {
    width: 2.7,
    length: 5.0,
  },
};

// Map styles
export const MAP_STYLES = {
  satellite: 'mapbox://styles/mapbox/satellite-v9',
  hybrid: 'mapbox://styles/mapbox/satellite-streets-v12',
  streets: 'mapbox://styles/mapbox/streets-v12',
};

// Default viewport
export const DEFAULT_VIEWPORT = {
  center: [-0.1276, 51.5074] as [number, number], // London
  zoom: 12,
  pitch: 0,
  bearing: 0,
};

// Free tier limits
export const FREE_TIER_LIMITS = {
  maxPolygons: 2,
  maxParkingBlocks: 2,
  maxCadImages: 0,
  maxMeasurementPoints: 21, // 20 segments = 21 points
};

// Tier feature mapping
export const TIER_FEATURES = {
  free: {
    maxPolygons: 2,
    maxParkingBlocks: 2,
    maxCadImages: 0,
    maxMeasurementPoints: 21, // 20 segments = 21 points
    canSave: false, // Free users cannot save
    canExport: false,
  },
  pro: {
    maxPolygons: Infinity,
    maxParkingBlocks: Infinity,
    maxCadImages: 0,
    maxMeasurementPoints: Infinity,
    canSave: true,
    canExport: true,
  },
  plus: {
    maxPolygons: Infinity,
    maxParkingBlocks: Infinity,
    maxCadImages: Infinity,
    maxMeasurementPoints: Infinity,
    canSave: true,
    canExport: true,
  },
};

// Mapbox token (from env)
export const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || '';

// Auto-save debounce (ms)
export const AUTOSAVE_DEBOUNCE_MS = 1000;

// Maximum undo history size
export const MAX_HISTORY_SIZE = 50;

// CAD upload constraints
export const CAD_UPLOAD = {
  maxFileSizeMB: 20,
  allowedMimeTypes: ['image/png', 'image/jpeg', 'image/jpg'],
  allowedExtensions: ['png', 'jpg', 'jpeg'],
};

// Design tokens (CSS variables)
export const DESIGN_TOKENS = {
  // Base colors
  bg: '#FBFAF7',
  surface: '#FFFFFF',
  ink: '#171419',
  border: '#E8E4DC',

  // Brand colors
  violet: '#7033FF',
  violetTintSoft: '#F5F1FF',
  orange: '#F26B1F',

  // Shadows
  shadowModal: '0 40px 80px -20px rgba(20,10,40,0.4), 0 0 0 1px rgba(0,0,0,0.04)',
  shadowPopover: '0 20px 50px -10px rgba(20,10,40,0.35), 0 0 0 1px rgba(0,0,0,0.04)',
  shadowFloating: '0 14px 30px -10px rgba(20,10,40,0.2)',

  // Typography
  fontBody: '13.5px',
  fontMeta: '11px',
};

// Keyboard shortcuts
export const KEYBOARD_SHORTCUTS = {
  undo: ['⌘Z', 'Ctrl+Z'],
  redo: ['⌘⇧Z', 'Ctrl+Shift+Z'],
  selectTool: ['V'],
  polygonTool: ['P'],
  parkingTool: ['K'],
  cadTool: ['C'],
  measureTool: ['M'],
  delete: ['Delete', 'Backspace'],
  escape: ['Escape'],
  save: ['⌘S', 'Ctrl+S'],
};

// Snap angle (degrees)
export const SNAP_ANGLE = 90;

// Minimum distance between points (meters)
export const MIN_POINT_DISTANCE = 0.5;

// Minimum polygon area (square meters)
export const MIN_POLYGON_AREA = 1;

// Default visible height for new building polygons in 3D mode
export const DEFAULT_BUILDING_HEIGHT_METERS = 8;

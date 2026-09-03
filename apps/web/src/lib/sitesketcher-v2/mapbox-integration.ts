import mapboxgl from 'mapbox-gl';
import MapboxDraw from '@mapbox/mapbox-gl-draw';
import { ParkingBlock, Polygon, CadImage, CadInstance, SavedCad } from '@/types/sitesketcher-v2';
import { DEFAULT_BUILDING_HEIGHT_METERS, PARKING_DIMENSIONS, POLYGON_COLORS } from './constants';
import { PolygonMode } from './PolygonMode';
import { calculateCadImageCorners } from './cad-utils';

/**
 * Initialize Mapbox GL JS map
 */
export function initializeMap(
  container: HTMLDivElement,
  options: {
    center: [number, number];
    zoom: number;
    pitch?: number;
    bearing?: number;
    style: string;
    accessToken: string;
  }
): mapboxgl.Map {
  mapboxgl.accessToken = options.accessToken;

  const map = new mapboxgl.Map({
    container,
    style: options.style,
    center: options.center,
    zoom: options.zoom,
    pitch: options.pitch || 0,
    bearing: options.bearing || 0,
    antialias: true,
  });

  return map;
}

/**
 * Setup Mapbox Draw with custom styles and modes
 */
export function setupMapboxDraw(map: mapboxgl.Map): MapboxDraw {
  const draw = new MapboxDraw({
    displayControlsDefault: false,
    styles: getDrawStyles(),
    userProperties: true,
    modes: {
      ...MapboxDraw.modes,
      draw_polygon_snap: PolygonMode,
    },
  });

  map.addControl(draw as any);

  return draw;
}

/**
 * Enter polygon drawing mode with 90° snapping
 */
export function enterPolygonDrawMode(draw: MapboxDraw, map: mapboxgl.Map): void {
  draw.changeMode('draw_polygon_snap', { map });
}

/**
 * Custom Draw styles matching v2 design tokens
 */
function getDrawStyles() {
  return [
    // Polygon fill - inactive
    {
      id: 'gl-draw-polygon-fill-inactive',
      type: 'fill',
      filter: ['all', ['==', 'active', 'false'], ['==', '$type', 'Polygon'], ['!=', 'mode', 'static']],
      paint: {
        'fill-color': ['get', 'user_fillColor'],
        'fill-opacity': 0.5,
      },
    },
    // Polygon fill - active
    {
      id: 'gl-draw-polygon-fill-active',
      type: 'fill',
      filter: ['all', ['==', 'active', 'true'], ['==', '$type', 'Polygon']],
      paint: {
        'fill-color': ['get', 'user_fillColor'],
        'fill-opacity': 0.6,
      },
    },
    // Polygon stroke - inactive
    {
      id: 'gl-draw-polygon-stroke-inactive',
      type: 'line',
      filter: ['all', ['==', 'active', 'false'], ['==', '$type', 'Polygon'], ['!=', 'mode', 'static']],
      layout: {
        'line-cap': 'round',
        'line-join': 'round',
      },
      paint: {
        'line-color': ['get', 'user_strokeColor'],
        'line-width': 2,
      },
    },
    // Polygon stroke - active
    {
      id: 'gl-draw-polygon-stroke-active',
      type: 'line',
      filter: ['all', ['==', 'active', 'true'], ['==', '$type', 'Polygon']],
      layout: {
        'line-cap': 'round',
        'line-join': 'round',
      },
      paint: {
        'line-color': ['get', 'user_strokeColor'],
        'line-width': 3,
      },
    },
    // Vertex points - inactive
    {
      id: 'gl-draw-polygon-and-line-vertex-inactive',
      type: 'circle',
      filter: ['all', ['==', 'meta', 'vertex'], ['==', '$type', 'Point'], ['!=', 'mode', 'static']],
      paint: {
        'circle-radius': 7,
        'circle-color': '#fff',
        'circle-stroke-width': 2.5,
        'circle-stroke-color': '#7033FF',
      },
    },
    // Vertex points - active
    {
      id: 'gl-draw-point-active',
      type: 'circle',
      filter: ['all', ['==', '$type', 'Point'], ['==', 'active', 'true']],
      paint: {
        'circle-radius': 8,
        'circle-color': '#fff',
        'circle-stroke-width': 2.5,
        'circle-stroke-color': '#7033FF',
      },
    },
  ];
}

/**
 * Convert Zustand Polygon to Mapbox Draw Feature for editing.
 * NOTE: Draw features use UNROTATED coordinates for vertex editing.
 * Rotation is applied only in 3D extrusion layer (see polygonTo3DFeature).
 */
export function polygonToDrawFeature(polygon: Polygon): any {
  const color = POLYGON_COLORS[polygon.colorIndex] || POLYGON_COLORS[0];

  return {
    id: polygon.id,
    type: 'Feature',
    properties: {
      name: polygon.name,
      colorIndex: polygon.colorIndex,
      rotation: polygon.rotation,
      height: polygon.height,
      showDistances: polygon.showDistances,
      showArea: polygon.showArea,
      strokeColor: color.stroke,
      fillColor: color.fill,
    },
    geometry: {
      type: 'Polygon',
      coordinates: [polygon.points],
    },
  };
}

/**
 * Convert Zustand Polygon to GeoJSON Feature for 3D extrusion.
 * Note: Rotation is already baked into polygon.points by rotatePolygon action.
 */
function polygonTo3DFeature(polygon: Polygon): any {
  const color = POLYGON_COLORS[polygon.colorIndex] || POLYGON_COLORS[0];
  const height = polygon.height >= 0 ? polygon.height : DEFAULT_BUILDING_HEIGHT_METERS;

  return {
    id: polygon.id,
    type: 'Feature',
    properties: {
      name: polygon.name,
      colorIndex: polygon.colorIndex,
      height,
      fillColor: color.stroke,
    },
    geometry: {
      type: 'Polygon',
      coordinates: [polygon.points],
    },
  };
}

function metersToLngLat(
  anchor: [number, number],
  eastMeters: number,
  northMeters: number
): [number, number] {
  const latitudeRadians = (anchor[1] * Math.PI) / 180;
  const metersPerDegreeLng = 111320 * Math.cos(latitudeRadians);
  const metersPerDegreeLat = 110540;

  return [
    anchor[0] + eastMeters / metersPerDegreeLng,
    anchor[1] + northMeters / metersPerDegreeLat,
  ];
}

function rotatePoint(x: number, y: number, rotationDegrees: number): [number, number] {
  const rotationRadians = (rotationDegrees * Math.PI) / 180;
  const cos = Math.cos(rotationRadians);
  const sin = Math.sin(rotationRadians);

  return [x * cos - y * sin, x * sin + y * cos];
}

function parkingBlockDimensions(parkingBlock: ParkingBlock): { length: number; width: number } {
  const dimensions = PARKING_DIMENSIONS[parkingBlock.stallSize];

  return {
    length: dimensions.width * parkingBlock.spaces,
    width: parkingBlock.layout === 'double' ? dimensions.length * 2 : dimensions.length,
  };
}

function parkingLocalPointToLngLat(
  parkingBlock: ParkingBlock,
  x: number,
  y: number
): [number, number] {
  const [eastMeters, northMeters] = rotatePoint(x, y, parkingBlock.rotation);
  return metersToLngLat(parkingBlock.anchor, eastMeters, northMeters);
}

/**
 * Convert ParkingBlock to a GeoJSON fill feature.
 */
function parkingBlockToFeature(parkingBlock: ParkingBlock, selectedId?: string | null): any {
  const { length, width } = parkingBlockDimensions(parkingBlock);
  const halfLength = length / 2;
  const halfWidth = width / 2;
  const selected = parkingBlock.id === selectedId;
  const corners: [number, number][] = [
    parkingLocalPointToLngLat(parkingBlock, -halfLength, -halfWidth),
    parkingLocalPointToLngLat(parkingBlock, halfLength, -halfWidth),
    parkingLocalPointToLngLat(parkingBlock, halfLength, halfWidth),
    parkingLocalPointToLngLat(parkingBlock, -halfLength, halfWidth),
  ];

  return {
    id: parkingBlock.id,
    type: 'Feature',
    properties: {
      id: parkingBlock.id,
      name: parkingBlock.name,
      spaces: parkingBlock.spaces,
      selected,
    },
    geometry: {
      type: 'Polygon',
      coordinates: [[...corners, corners[0]]],
    },
  };
}

/**
 * Convert ParkingBlock bay markings to GeoJSON line features.
 */
function parkingBlockToLineFeatures(parkingBlock: ParkingBlock, selectedId?: string | null): any[] {
  const dimensions = PARKING_DIMENSIONS[parkingBlock.stallSize];
  const { length, width } = parkingBlockDimensions(parkingBlock);
  const halfLength = length / 2;
  const halfWidth = width / 2;
  const selected = parkingBlock.id === selectedId;
  const lines = [];

  for (let index = 1; index < parkingBlock.spaces; index++) {
    const x = -halfLength + dimensions.width * index;
    lines.push({
      type: 'Feature',
      properties: { id: parkingBlock.id, selected },
      geometry: {
        type: 'LineString',
        coordinates: [
          parkingLocalPointToLngLat(parkingBlock, x, -halfWidth),
          parkingLocalPointToLngLat(parkingBlock, x, halfWidth),
        ],
      },
    });
  }

  if (parkingBlock.layout === 'double') {
    lines.push({
      type: 'Feature',
      properties: { id: parkingBlock.id, selected },
      geometry: {
        type: 'LineString',
        coordinates: [
          parkingLocalPointToLngLat(parkingBlock, -halfLength, 0),
          parkingLocalPointToLngLat(parkingBlock, halfLength, 0),
        ],
      },
    });
  }

  return lines;
}

/**
 * Convert Mapbox Draw Feature to Zustand Polygon
 */
export function drawFeatureToPolygon(feature: any): Polygon {
  return {
    id: feature.id,
    name: feature.properties.name || `Plot ${String.fromCharCode(65)}`,
    colorIndex: feature.properties.colorIndex ?? feature.properties.user_colorIndex ?? 0,
    points: feature.geometry.coordinates[0],
    rotation: feature.properties.rotation || 0,
    height: feature.properties.height ?? feature.properties.user_height ?? DEFAULT_BUILDING_HEIGHT_METERS,
    showDistances: feature.properties.showDistances ?? true,
    showArea: feature.properties.showArea ?? true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

/**
 * Load sketch polygons into Mapbox Draw
 */
export function loadPolygonsIntoDraw(draw: MapboxDraw, polygons: Polygon[]): void {
  // Clear existing features
  draw.deleteAll();

  // Add polygons as Draw features
  const features = polygons.map(polygonToDrawFeature);
  if (features.length > 0) {
    draw.add({
      type: 'FeatureCollection',
      features,
    });
  }
}

/**
 * Get all polygons from Mapbox Draw
 */
export function getPolygonsFromDraw(draw: MapboxDraw): Polygon[] {
  const features = draw.getAll();
  return features.features
    .filter((f: any) => f.geometry.type === 'Polygon')
    .map(drawFeatureToPolygon);
}

/**
 * Sync Draw features to 3D layer for extrusion
 */
export function syncDrawTo3D(map: mapboxgl.Map, draw: MapboxDraw): void {
  setup3DLayer(map);

  const features = draw.getAll().features.map((f: any) => {
    const colorIndex = f.properties.colorIndex ?? f.properties.user_colorIndex ?? 0;
    const color = POLYGON_COLORS[colorIndex] || POLYGON_COLORS[0];
    const featureHeight = f.properties.height ?? f.properties.user_height ?? DEFAULT_BUILDING_HEIGHT_METERS;
    const height = featureHeight >= 0 ? featureHeight : DEFAULT_BUILDING_HEIGHT_METERS;

    return {
      ...f,
      properties: {
        ...f.properties,
        height,
        fillColor: color.stroke, // Use stroke color for 3D
      },
    };
  });

  const source = map.getSource('polygons-3d') as mapboxgl.GeoJSONSource;
  if (source) {
    source.setData({
      type: 'FeatureCollection',
      features,
    });
  }
}

/**
 * Sync Zustand polygons directly to 3D layer for extrusion
 */
export function syncPolygonsTo3D(map: mapboxgl.Map, polygons: Polygon[]): void {
  setup3DLayer(map);

  const source = map.getSource('polygons-3d') as mapboxgl.GeoJSONSource;
  if (source) {
    source.setData({
      type: 'FeatureCollection',
      features: polygons.map(polygonTo3DFeature),
    });
  }
}

/**
 * Setup parking fill and bay marking layers.
 */
function ensureParkingLayerOrder(map: mapboxgl.Map): void {
  [
    'parking-block-fill',
    'parking-selection-outline',
    'parking-block-outline',
    'parking-bay-lines',
  ].forEach((layerId) => {
    if (map.getLayer(layerId)) {
      map.moveLayer(layerId);
    }
  });
}

export function setupParkingLayer(map: mapboxgl.Map): void {
  // Don't check isStyleLoaded() - it can return false after MapboxDraw is added
  // The map 'load' event is sufficient to ensure we can add layers

  if (!map.getSource('parking-blocks')) {
    map.addSource('parking-blocks', {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: [],
      },
    });
  }

  if (!map.getSource('parking-lines')) {
    map.addSource('parking-lines', {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: [],
      },
    });
  }

  if (!map.getLayer('parking-block-fill')) {
    map.addLayer({
      id: 'parking-block-fill',
      type: 'fill',
      source: 'parking-blocks',
      layout: {
        visibility: 'visible',
      },
      paint: {
        'fill-color': '#2F3437',
        'fill-opacity': ['case', ['boolean', ['get', 'selected'], false], 0.62, 0.48],
      },
    });
  }

  if (!map.getLayer('parking-selection-outline')) {
    map.addLayer({
      id: 'parking-selection-outline',
      type: 'line',
      source: 'parking-blocks',
      layout: {
        visibility: 'visible',
        'line-cap': 'round',
        'line-join': 'round',
      },
      paint: {
        'line-color': '#7033FF',
        'line-opacity': ['case', ['boolean', ['get', 'selected'], false], 1, 0],
        'line-width': 6,
        'line-blur': 0.5,
      },
    });
  }

  if (!map.getLayer('parking-block-outline')) {
    map.addLayer({
      id: 'parking-block-outline',
      type: 'line',
      source: 'parking-blocks',
      layout: {
        visibility: 'visible',
        'line-cap': 'round',
        'line-join': 'round',
      },
      paint: {
        'line-color': '#FFFFFF',
        'line-opacity': 0.95,
        'line-width': ['case', ['boolean', ['get', 'selected'], false], 2.25, 1.75],
      },
    });
  }

  if (!map.getLayer('parking-bay-lines')) {
    map.addLayer({
      id: 'parking-bay-lines',
      type: 'line',
      source: 'parking-lines',
      layout: {
        visibility: 'visible',
        'line-cap': 'round',
        'line-join': 'round',
      },
      paint: {
        'line-color': '#FFFFFF',
        'line-opacity': ['case', ['boolean', ['get', 'selected'], false], 0.95, 0.82],
        'line-width': ['case', ['boolean', ['get', 'selected'], false], 1.4, 1.1],
      },
    });
  }

  if (map.getLayer('parking-labels')) {
    map.removeLayer('parking-labels');
  }

  ensureParkingLayerOrder(map);
}

/**
 * Sync parking blocks to map layers.
 */
export function syncParkingToMap(
  map: mapboxgl.Map,
  parkingBlocks: ParkingBlock[],
  selectedId?: string | null
): void {
  setupParkingLayer(map);

  const parkingSource = map.getSource('parking-blocks') as mapboxgl.GeoJSONSource;
  if (parkingSource) {
    parkingSource.setData({
      type: 'FeatureCollection',
      features: parkingBlocks.map((parkingBlock) => parkingBlockToFeature(parkingBlock, selectedId)),
    });
  }

  const linesSource = map.getSource('parking-lines') as mapboxgl.GeoJSONSource;
  if (linesSource) {
    linesSource.setData({
      type: 'FeatureCollection',
      features: parkingBlocks.flatMap((parkingBlock) =>
        parkingBlockToLineFeatures(parkingBlock, selectedId)
      ),
    });
  }
}

/**
 * Auto parking — access-point marker, hover-edge affordance, applied-layout
 * geometry layers, and the stale-layout boundary overlay. Mirrors the
 * parking-block layer pattern above: plain GeoJSON sources kept in sync from
 * the store, with `selected`/`stale` baked into feature properties rather
 * than computed from a Mapbox expression referencing store state.
 */
export function setupAutoParkingLayer(map: mapboxgl.Map): void {
  const beforeDrawVertices = map.getLayer('gl-draw-polygon-and-line-vertex-inactive')
    ? 'gl-draw-polygon-and-line-vertex-inactive'
    : undefined;
  if (!map.getSource('auto-parking-access-point')) {
    map.addSource('auto-parking-access-point', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    });
  }
  if (!map.getSource('auto-parking-hover-edge')) {
    map.addSource('auto-parking-hover-edge', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    });
  }
  if (!map.getSource('auto-parking-guidance')) {
    map.addSource('auto-parking-guidance', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    });
  }
  if (!map.getSource('auto-parking-layouts')) {
    map.addSource('auto-parking-layouts', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    });
  }
  if (!map.getSource('auto-parking-stale-boundary')) {
    map.addSource('auto-parking-stale-boundary', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    });
  }

  // Faint dashed outline of a stale layout's boundary AT GENERATION TIME —
  // drawn first so the current amber boundary sits on top of it.
  if (!map.getLayer('auto-parking-prev-boundary-line')) {
    map.addLayer({
      id: 'auto-parking-prev-boundary-line',
      type: 'line',
      source: 'auto-parking-stale-boundary',
      filter: ['==', ['get', 'kind'], 'previous'],
      paint: {
        'line-color': '#FFFFFF',
        'line-width': 1.5,
        'line-opacity': 0.55,
        'line-dasharray': [2, 2],
      },
    });
  }
  if (!map.getLayer('auto-parking-stale-boundary-fill')) {
    map.addLayer({
      id: 'auto-parking-stale-boundary-fill',
      type: 'fill',
      source: 'auto-parking-stale-boundary',
      filter: ['==', ['get', 'kind'], 'current'],
      paint: { 'fill-color': '#E9A23B', 'fill-opacity': 0.08 },
    });
  }
  if (!map.getLayer('auto-parking-stale-boundary-line')) {
    map.addLayer({
      id: 'auto-parking-stale-boundary-line',
      type: 'line',
      source: 'auto-parking-stale-boundary',
      filter: ['==', ['get', 'kind'], 'current'],
      paint: { 'line-color': '#E9A23B', 'line-width': 2.5 },
    });
  }
  if (!map.getLayer('auto-parking-stale-boundary-vertex')) {
    map.addLayer({
      id: 'auto-parking-stale-boundary-vertex',
      type: 'circle',
      source: 'auto-parking-stale-boundary',
      filter: ['==', ['get', 'kind'], 'current-vertex'],
      paint: {
        'circle-radius': 6.5,
        'circle-color': '#E9A23B',
        'circle-stroke-color': '#FFFFFF',
        'circle-stroke-width': 2,
      },
    });
  }

  if (!map.getLayer('auto-parking-aisle-fill')) {
    map.addLayer({
      id: 'auto-parking-aisle-fill',
      type: 'fill',
      source: 'auto-parking-layouts',
      filter: ['==', ['get', 'featureType'], 'drive-aisle'],
      paint: {
        'fill-color': '#26242A',
        'fill-opacity': [
          'case',
          ['boolean', ['get', 'stale'], false],
          0.2,
          ['boolean', ['get', 'selected'], false],
          0.5,
          0.38,
        ],
      },
    });
  }
  if (!map.getLayer('auto-parking-corridor-fill')) {
    map.addLayer({
      id: 'auto-parking-corridor-fill',
      type: 'fill',
      source: 'auto-parking-layouts',
      filter: ['==', ['get', 'featureType'], 'access-corridor'],
      paint: {
        'fill-color': '#FFFFFF',
        'fill-opacity': ['case', ['boolean', ['get', 'stale'], false], 0.15, 0.28],
      },
    });
  }
  if (!map.getLayer('auto-parking-stall-fill')) {
    map.addLayer({
      id: 'auto-parking-stall-fill',
      type: 'fill',
      source: 'auto-parking-layouts',
      filter: ['==', ['get', 'featureType'], 'parking-stall'],
      paint: {
        'fill-color': ['case', ['boolean', ['get', 'accessible'], false], '#5A23D0', '#FFFFFF'],
        'fill-opacity': [
          'case',
          ['boolean', ['get', 'stale'], false],
          0.38,
          ['boolean', ['get', 'selected'], false],
          0.85,
          0.7,
        ],
      },
    });
  }
  if (!map.getLayer('auto-parking-stall-outline')) {
    map.addLayer({
      id: 'auto-parking-stall-outline',
      type: 'line',
      source: 'auto-parking-layouts',
      filter: ['==', ['get', 'featureType'], 'parking-stall'],
      paint: {
        'line-color': '#5A23D0',
        'line-width': ['case', ['boolean', ['get', 'selected'], false], 1.6, 1.1],
        'line-opacity': ['case', ['boolean', ['get', 'stale'], false], 0.5, 0.9],
      },
    });
  }
  if (!map.getLayer('auto-parking-hover-edge-line')) {
    map.addLayer({
      id: 'auto-parking-hover-edge-line',
      type: 'line',
      source: 'auto-parking-hover-edge',
      layout: { 'line-cap': 'round' },
      paint: { 'line-color': '#C4B2F7', 'line-width': 9, 'line-opacity': 0.85 },
    });
  }
  if (!map.getLayer('auto-parking-building-fill')) {
    map.addLayer({
      id: 'auto-parking-building-fill',
      type: 'fill',
      source: 'auto-parking-guidance',
      filter: ['==', ['get', 'kind'], 'building'],
      paint: { 'fill-color': '#26242A', 'fill-opacity': 0.52 },
    }, beforeDrawVertices);
  }
  if (!map.getLayer('auto-parking-building-line-selected')) {
    map.addLayer({
      id: 'auto-parking-building-line-selected',
      type: 'line',
      source: 'auto-parking-guidance',
      filter: ['all', ['==', ['get', 'kind'], 'building'], ['!=', ['get', 'source'], 'drawn']],
      paint: {
        'line-color': '#F4F1EA',
        'line-width': 2,
        'line-dasharray': [3, 2],
      },
    }, beforeDrawVertices);
  }
  if (!map.getLayer('auto-parking-building-line-drawn')) {
    map.addLayer({
      id: 'auto-parking-building-line-drawn',
      type: 'line',
      source: 'auto-parking-guidance',
      filter: ['all', ['==', ['get', 'kind'], 'building'], ['==', ['get', 'source'], 'drawn']],
      paint: {
        'line-color': '#F4F1EA',
        'line-width': 2,
      },
    }, beforeDrawVertices);
  }
  if (!map.getLayer('auto-parking-entrance-wall')) {
    map.addLayer({
      id: 'auto-parking-entrance-wall',
      type: 'line',
      source: 'auto-parking-guidance',
      filter: ['==', ['get', 'kind'], 'entrance-wall'],
      layout: { 'line-cap': 'round' },
      paint: { 'line-color': '#2FA37A', 'line-width': 7, 'line-opacity': 0.9 },
    });
  }
  if (!map.getLayer('auto-parking-entrance-halo')) {
    map.addLayer({
      id: 'auto-parking-entrance-halo',
      type: 'circle',
      source: 'auto-parking-guidance',
      filter: ['==', ['get', 'kind'], 'entrance'],
      paint: { 'circle-radius': 13, 'circle-color': '#2FA37A', 'circle-opacity': 0.24 },
    });
  }
  if (!map.getLayer('auto-parking-entrance-dot')) {
    map.addLayer({
      id: 'auto-parking-entrance-dot',
      type: 'circle',
      source: 'auto-parking-guidance',
      filter: ['==', ['get', 'kind'], 'entrance'],
      paint: {
        'circle-radius': 8,
        'circle-color': '#2FA37A',
        'circle-stroke-color': '#FFFFFF',
        'circle-stroke-width': 2,
      },
    });
  }
  if (!map.getLayer('auto-parking-access-halo')) {
    map.addLayer({
      id: 'auto-parking-access-halo',
      type: 'circle',
      source: 'auto-parking-access-point',
      paint: {
        'circle-radius': 13,
        'circle-color': '#7C4DFF',
        'circle-opacity': 0.25,
      },
    });
  }
  if (!map.getLayer('auto-parking-access-dot')) {
    map.addLayer({
      id: 'auto-parking-access-dot',
      type: 'circle',
      source: 'auto-parking-access-point',
      paint: {
        'circle-radius': 8,
        'circle-color': '#7C4DFF',
        'circle-stroke-color': '#FFFFFF',
        'circle-stroke-width': 2,
      },
    });
  }
}

/** Updates the draft access-point marker. Pass `null` while nothing is placed yet. */
export function syncAutoParkingAccessPointToMap(map: mapboxgl.Map, point: [number, number] | null): void {
  setupAutoParkingLayer(map);
  const source = map.getSource('auto-parking-access-point') as mapboxgl.GeoJSONSource;
  if (!source) return;
  source.setData({
    type: 'FeatureCollection',
    features: point
      ? [{ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: point } }]
      : [],
  });
}

export interface AutoParkingGuidanceInput {
  buildings: Array<{ id: string; source: 'drawn' | 'selected'; ring: [number, number][] }>;
  entrancePoint: [number, number] | null;
  entranceWall: [[number, number], [number, number]] | null;
}

/** Selected building chrome and the entrance marker/wall. */
export function syncAutoParkingGuidanceToMap(map: mapboxgl.Map, input: AutoParkingGuidanceInput): void {
  setupAutoParkingLayer(map);
  const source = map.getSource('auto-parking-guidance') as mapboxgl.GeoJSONSource;
  if (!source) return;
  const features: GeoJSON.Feature[] = input.buildings.map((building) => ({
    type: 'Feature',
    properties: { kind: 'building', id: building.id, source: building.source },
    geometry: { type: 'Polygon', coordinates: [closeRing(building.ring)] },
  }));
  if (input.entranceWall) {
    features.push({
      type: 'Feature',
      properties: { kind: 'entrance-wall' },
      geometry: { type: 'LineString', coordinates: input.entranceWall },
    });
  }
  if (input.entrancePoint) {
    features.push({
      type: 'Feature',
      properties: { kind: 'entrance' },
      geometry: { type: 'Point', coordinates: input.entrancePoint },
    });
  }

  source.setData({ type: 'FeatureCollection', features });
}

/** Updates the thickened nearest-edge affordance shown while hovering the boundary during access placement. */
export function syncAutoParkingHoverEdgeToMap(
  map: mapboxgl.Map,
  edge: [[number, number], [number, number]] | null
): void {
  setupAutoParkingLayer(map);
  const source = map.getSource('auto-parking-hover-edge') as mapboxgl.GeoJSONSource;
  if (!source) return;
  source.setData({
    type: 'FeatureCollection',
    features: edge
      ? [{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: edge } }]
      : [],
  });
}

export interface AutoParkingLayoutRenderEntry {
  id: string;
  /** Persisted geometry, already clipped to the CURRENT boundary when stale (see auto-parking/clip.ts). */
  features: GeoJSON.Feature[];
  stale: boolean;
  /** Only needed when stale — draws the amber current-boundary overlay + faint previous-boundary outline. */
  currentBoundaryRing?: [number, number][];
  previousBoundaryRing?: [number, number][];
}

/**
 * Renders every applied AutoParkingLayout's persisted geometry, merged into one
 * source, plus an optional transient candidate `preview` (rendered while the
 * user is still choosing a candidate, before apply). Preview features are drawn
 * with the "selected" styling and are non-interactive — the applied-layout
 * click path only matches persisted layout ids. Stale entries additionally
 * render at reduced opacity and get an amber current-boundary + faint
 * previous-boundary overlay (state 06 of the guided flow).
 */
export function syncAutoParkingLayoutsToMap(
  map: mapboxgl.Map,
  entries: AutoParkingLayoutRenderEntry[],
  selectedAutoLayoutId?: string | null,
  preview?: GeoJSON.FeatureCollection | null
): void {
  setupAutoParkingLayer(map);
  const source = map.getSource('auto-parking-layouts') as mapboxgl.GeoJSONSource;
  const staleBoundarySource = map.getSource('auto-parking-stale-boundary') as mapboxgl.GeoJSONSource;

  if (source) {
    const features = entries.flatMap((entry) =>
      entry.features.map((f) => ({
        ...f,
        properties: { ...f.properties, selected: entry.id === selectedAutoLayoutId, stale: entry.stale },
      }))
    );
    if (preview) {
      for (const f of preview.features) {
        features.push({ ...f, properties: { ...f.properties, selected: true, stale: false } } as any);
      }
    }
    source.setData({ type: 'FeatureCollection', features: features as any });
  }

  if (staleBoundarySource) {
    const boundaryFeatures: GeoJSON.Feature[] = [];
    for (const entry of entries) {
      if (!entry.stale || !entry.currentBoundaryRing) continue;
      const ring = closeRing(entry.currentBoundaryRing);
      boundaryFeatures.push({
        type: 'Feature',
        properties: { kind: 'current', layoutId: entry.id },
        geometry: { type: 'Polygon', coordinates: [ring] },
      });
      for (const vertex of ring.slice(0, -1)) {
        boundaryFeatures.push({
          type: 'Feature',
          properties: { kind: 'current-vertex', layoutId: entry.id },
          geometry: { type: 'Point', coordinates: vertex },
        });
      }
      if (entry.previousBoundaryRing) {
        boundaryFeatures.push({
          type: 'Feature',
          properties: { kind: 'previous', layoutId: entry.id },
          geometry: { type: 'Polygon', coordinates: [closeRing(entry.previousBoundaryRing)] },
        });
      }
    }
    staleBoundarySource.setData({ type: 'FeatureCollection', features: boundaryFeatures });
  }
}

function closeRing(ring: [number, number][]): [number, number][] {
  if (ring.length === 0) return ring;
  const [firstLng, firstLat] = ring[0];
  const [lastLng, lastLat] = ring[ring.length - 1];
  if (firstLng === lastLng && firstLat === lastLat) return ring;
  return [...ring, ring[0]];
}

/**
 * Setup 3D extrusion layer
 */
export function setup3DLayer(map: mapboxgl.Map): void {
  if (!map.isStyleLoaded()) return;

  if (!map.getSource('composite')) {
    map.addSource('composite', {
      type: 'vector',
      url: 'mapbox://mapbox.mapbox-streets-v8',
    });
  }

  if (!map.getLayer('mapbox-3d-buildings')) {
    const labelLayerId = map.getStyle().layers?.find(
      (layer: any) => layer.type === 'symbol' && layer.layout?.['text-field']
    )?.id;

    map.addLayer(
      {
        id: 'mapbox-3d-buildings',
        source: 'composite',
        'source-layer': 'building',
        filter: ['==', 'extrude', 'true'],
        type: 'fill-extrusion',
        minzoom: 15,
        layout: {
          visibility: 'none',
        },
        paint: {
          'fill-extrusion-color': '#aaa',
          'fill-extrusion-height': [
            'interpolate',
            ['linear'],
            ['zoom'],
            15,
            0,
            15.05,
            ['get', 'height'],
          ],
          'fill-extrusion-base': [
            'interpolate',
            ['linear'],
            ['zoom'],
            15,
            0,
            15.05,
            ['get', 'min_height'],
          ],
          'fill-extrusion-opacity': 0.55,
        },
      },
      labelLayerId
    );
  }

  if (!map.getSource('polygons-3d')) {
    map.addSource('polygons-3d', {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: [],
      },
    });
  }

  if (!map.getLayer('polygon-3d-extrusion')) {
    map.addLayer({
      id: 'polygon-3d-extrusion',
      type: 'fill-extrusion',
      source: 'polygons-3d',
      layout: {
        visibility: 'none', // Hidden by default, shown in 3D mode
      },
      paint: {
        'fill-extrusion-color': ['get', 'fillColor'],
        'fill-extrusion-height': ['get', 'height'],
        'fill-extrusion-base': 0,
        'fill-extrusion-opacity': 0.8,
      },
    });
  }
}

/**
 * Toggle 3D layer visibility
 */
export function toggle3DLayer(map: mapboxgl.Map, visible: boolean): void {
  setup3DLayer(map);

  const visibility = visible ? 'visible' : 'none';

  if (map.getLayer('mapbox-3d-buildings')) {
    map.setLayoutProperty('mapbox-3d-buildings', 'visibility', visibility);
  }

  if (map.getLayer('polygon-3d-extrusion')) {
    map.setLayoutProperty('polygon-3d-extrusion', 'visibility', visibility);
  }
}

/**
 * Animate map to viewport
 */
export function flyToViewport(
  map: mapboxgl.Map,
  viewport: { center: [number, number]; zoom: number; pitch?: number; bearing?: number }
): void {
  map.flyTo({
    center: viewport.center,
    zoom: viewport.zoom,
    pitch: viewport.pitch || 0,
    bearing: viewport.bearing || 0,
    duration: 1500,
  });
}

/**
 * Add CAD image to map as raster layer
 * Supports both legacy CadImage and new CadInstance + SavedCad model
 */
export function addCadImageToMap(
  map: mapboxgl.Map,
  cadImageOrInstance: CadImage | CadInstance,
  savedCad?: SavedCad
): void {
  // Handle legacy CadImage
  if ('fileName' in cadImageOrInstance) {
    const cadImage = cadImageOrInstance as CadImage;
    if (cadImage.anchor === null) {
      return;
    }
    const corners = calculateCadImageCorners(cadImage);
    const id = cadImage.id;
    const url = cadImage.url;
    const opacity = cadImage.opacity;

    addCadToMap(map, id, url, corners, opacity);
    return;
  }

  // Handle new CadInstance + SavedCad model
  const instance = cadImageOrInstance as CadInstance;
  if (!savedCad) {
    console.warn(`Cannot render CadInstance ${instance.id}: SavedCad not found`);
    return;
  }

  const corners = calculateCadImageCorners(instance, savedCad);
  addCadToMap(map, instance.id, savedCad.url, corners, instance.opacity);
}

/**
 * Internal helper to add CAD to map
 */
function addCadToMap(
  map: mapboxgl.Map,
  id: string,
  url: string,
  corners: [[number, number], [number, number], [number, number], [number, number]],
  opacity: number
): void {
  // Add source
  map.addSource(`cad-image-${id}`, {
    type: 'image',
    url,
    coordinates: corners,
  });

  // CRITICAL: Guard layer insertion - firstPolygonLayer may not exist after setStyle
  const firstPolygonLayer = 'gl-draw-polygon-fill-inactive';
  const beforeLayer = map.getLayer(firstPolygonLayer) ? firstPolygonLayer : undefined;

  map.addLayer({
    id: `cad-layer-${id}`,
    source: `cad-image-${id}`,
    type: 'raster',
    paint: {
      'raster-opacity': opacity,
      'raster-fade-duration': 0, // Instant opacity changes
    },
  }, beforeLayer); // Insert before polygons if layer exists, otherwise add to top
}

/**
 * Update CAD image coordinates and opacity on map
 * Supports both legacy CadImage and new CadInstance + SavedCad model
 */
export function updateCadImageOnMap(
  map: mapboxgl.Map,
  cadImageOrInstance: CadImage | CadInstance,
  savedCad?: SavedCad
): void {
  // Handle legacy CadImage
  if ('fileName' in cadImageOrInstance) {
    const cadImage = cadImageOrInstance as CadImage;
    if (cadImage.anchor === null) {
      return;
    }
    const corners = calculateCadImageCorners(cadImage);
    updateCadOnMap(map, cadImage.id, cadImage.url, corners, cadImage.opacity);
    return;
  }

  // Handle new CadInstance + SavedCad model
  const instance = cadImageOrInstance as CadInstance;
  if (!savedCad) {
    console.warn(`Cannot update CadInstance ${instance.id}: SavedCad not found`);
    return;
  }

  const corners = calculateCadImageCorners(instance, savedCad);
  updateCadOnMap(map, instance.id, savedCad.url, corners, instance.opacity);
}

/**
 * Internal helper to update CAD on map
 */
function updateCadOnMap(
  map: mapboxgl.Map,
  id: string,
  url: string,
  corners: [[number, number], [number, number], [number, number], [number, number]],
  opacity: number
): void {
  // Update source coordinates
  const source = map.getSource(`cad-image-${id}`) as mapboxgl.ImageSource;
  if (source) {
    source.updateImage({ url, coordinates: corners });
  }

  // Update opacity
  if (map.getLayer(`cad-layer-${id}`)) {
    map.setPaintProperty(
      `cad-layer-${id}`,
      'raster-opacity',
      opacity
    );
  }
}

/**
 * Remove CAD image from map
 */
export function removeCadImageFromMap(
  map: mapboxgl.Map,
  cadImageId: string
): void {
  if (map.getLayer(`cad-layer-${cadImageId}`)) {
    map.removeLayer(`cad-layer-${cadImageId}`);
  }
  if (map.getSource(`cad-image-${cadImageId}`)) {
    map.removeSource(`cad-image-${cadImageId}`);
  }
}

/**
 * Force refresh CAD image source for cache-busting
 * Used after image reprocessing to ensure new image is loaded
 */
export function refreshCadImageSource(
  map: mapboxgl.Map,
  cadImageOrInstance: CadImage | CadInstance,
  savedCad?: SavedCad
): void {
  const id = cadImageOrInstance.id;

  // Remove existing layers/sources
  removeCadImageFromMap(map, id);

  // Re-add with updated image (cache-busted by new URL)
  addCadImageToMap(map, cadImageOrInstance, savedCad);
}

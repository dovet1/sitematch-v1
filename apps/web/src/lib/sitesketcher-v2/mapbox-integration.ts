import mapboxgl from 'mapbox-gl';
import MapboxDraw from '@mapbox/mapbox-gl-draw';
import { ParkingBlock, Polygon } from '@/types/sitesketcher-v2';
import { DEFAULT_BUILDING_HEIGHT_METERS, PARKING_DIMENSIONS, POLYGON_COLORS } from './constants';
import { PolygonMode } from './PolygonMode';

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
  const height = polygon.height > 0 ? polygon.height : DEFAULT_BUILDING_HEIGHT_METERS;

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
      label: 'P',
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
    const height = featureHeight > 0 ? featureHeight : DEFAULT_BUILDING_HEIGHT_METERS;

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
    'parking-labels',
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

  if (!map.getLayer('parking-labels')) {
    map.addLayer({
      id: 'parking-labels',
      type: 'symbol',
      source: 'parking-blocks',
      layout: {
        visibility: 'visible',
        'text-field': ['get', 'label'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 14, 10, 18, 16],
        'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
        'text-allow-overlap': true,
        'text-ignore-placement': true,
      },
      paint: {
        'text-color': '#FFFFFF',
        'text-opacity': ['interpolate', ['linear'], ['zoom'], 14, 0, 15.5, 0.85],
        'text-halo-color': '#2563EB',
        'text-halo-width': 2,
      },
    });
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

import mapboxgl from 'mapbox-gl';
import MapboxDraw from '@mapbox/mapbox-gl-draw';
import { Polygon } from '@/types/sitesketcher-v2';
import { POLYGON_COLORS } from './constants';
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
        'circle-radius': 4,
        'circle-color': '#fff',
        'circle-stroke-width': 2,
        'circle-stroke-color': '#7033FF',
      },
    },
    // Vertex points - active
    {
      id: 'gl-draw-point-active',
      type: 'circle',
      filter: ['all', ['==', '$type', 'Point'], ['==', 'active', 'true']],
      paint: {
        'circle-radius': 6,
        'circle-color': '#fff',
        'circle-stroke-width': 2,
        'circle-stroke-color': '#7033FF',
      },
    },
  ];
}

/**
 * Convert Zustand Polygon to Mapbox Draw Feature
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
 * Convert Mapbox Draw Feature to Zustand Polygon
 */
export function drawFeatureToPolygon(feature: any): Polygon {
  return {
    id: feature.id,
    name: feature.properties.name || `Plot ${String.fromCharCode(65)}`,
    colorIndex: feature.properties.colorIndex ?? feature.properties.user_colorIndex ?? 0,
    points: feature.geometry.coordinates[0],
    rotation: feature.properties.rotation || 0,
    height: feature.properties.height || 0,
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
  const features = draw.getAll().features.map((f: any) => {
    const color = POLYGON_COLORS[f.properties.colorIndex || 0];
    return {
      ...f,
      properties: {
        ...f.properties,
        height: f.properties.height || 0,
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
 * Setup 3D extrusion layer
 */
export function setup3DLayer(map: mapboxgl.Map): void {
  // Add source
  map.addSource('polygons-3d', {
    type: 'geojson',
    data: {
      type: 'FeatureCollection',
      features: [],
    },
  });

  // Add 3D extrusion layer
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

/**
 * Toggle 3D layer visibility
 */
export function toggle3DLayer(map: mapboxgl.Map, visible: boolean): void {
  map.setLayoutProperty(
    'polygon-3d-extrusion',
    'visibility',
    visible ? 'visible' : 'none'
  );
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

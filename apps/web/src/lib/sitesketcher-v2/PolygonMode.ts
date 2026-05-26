import MapboxDraw from '@mapbox/mapbox-gl-draw';
import { snapTo90Degrees } from './polygon-utils';
import mapboxgl from 'mapbox-gl';

/**
 * Custom Mapbox Draw mode for drawing polygons with 90° snapping.
 * Extends the built-in draw_polygon mode.
 */
export const PolygonMode: any = {
  ...MapboxDraw.modes.draw_polygon,

  onSetup(opts: any) {
    const drawPolygonMode = MapboxDraw.modes.draw_polygon as any;
    const state = drawPolygonMode.onSetup.call(this, opts);
    state.map = opts.map; // Store map reference for projection
    return state;
  },

  clickAnywhere(state: any, e: any) {
    // Hold Shift to snap new edges to 90 degrees. Normal clicks should land
    // exactly where the user clicked.
    if (e.originalEvent?.shiftKey && state.polygon.coordinates[0].length > 1) {
      const lastPoint = state.polygon.coordinates[0][state.polygon.coordinates[0].length - 2];
      const currentPoint = [e.lngLat.lng, e.lngLat.lat];

      // Snap to 90°
      const snapped = snapTo90Degrees(
        state.map,
        lastPoint as [number, number],
        currentPoint as [number, number]
      );

      // Override the click coordinates
      e.lngLat = {
        lng: snapped[0],
        lat: snapped[1],
      };
    }

    // Call original clickAnywhere
    const drawPolygonMode = MapboxDraw.modes.draw_polygon as any;
    return drawPolygonMode.clickAnywhere.call(this, state, e);
  },

  onMouseMove(state: any, e: any) {
    // Hold Shift to preview snapped edges; otherwise follow the pointer exactly.
    if (e.originalEvent?.shiftKey && state.polygon.coordinates[0].length > 1) {
      const lastPoint = state.polygon.coordinates[0][state.polygon.coordinates[0].length - 2];
      const currentPoint = [e.lngLat.lng, e.lngLat.lat];

      // Snap to 90°
      const snapped = snapTo90Degrees(
        state.map,
        lastPoint as [number, number],
        currentPoint as [number, number]
      );

      // Update the moving point
      state.polygon.updateCoordinate(`0.${state.polygon.coordinates[0].length - 1}`, snapped[0], snapped[1]);
    }

    // Call original onMouseMove
    const drawPolygonMode = MapboxDraw.modes.draw_polygon as any;
    return drawPolygonMode.onMouseMove.call(this, state, e);
  },
};

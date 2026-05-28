import MapboxDraw from '@mapbox/mapbox-gl-draw';
import { getDisplayCursorPosition } from './polygon-utils';
import { polygonPreviewStore } from './polygon-preview-store';
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
    polygonPreviewStore.clear(); // Clear any previous preview state
    return state;
  },

  clickAnywhere(state: any, e: any) {
    // Get current last confirmed point (or null if first point)
    const lastConfirmedPoint =
      state.polygon.coordinates[0].length >= 2
        ? state.polygon.coordinates[0][state.polygon.coordinates[0].length - 2]
        : null;

    // Compute snapped position using shared helper
    const displayCursor = getDisplayCursorPosition(
      state.map,
      [e.lngLat.lng, e.lngLat.lat],
      lastConfirmedPoint,
      e.originalEvent?.shiftKey || false
    );

    // Override event to ensure actual vertex placement matches preview
    e.lngLat = {
      lng: displayCursor[0],
      lat: displayCursor[1],
    };

    // Call original clickAnywhere
    const drawPolygonMode = MapboxDraw.modes.draw_polygon as any;
    const result = drawPolygonMode.clickAnywhere.call(this, state, e);

    // Update preview store with new last confirmed point
    const confirmedPoint =
      state.polygon.coordinates[0].length >= 2
        ? state.polygon.coordinates[0][state.polygon.coordinates[0].length - 2]
        : null;
    polygonPreviewStore.setState({
      lastPlacedPoint: confirmedPoint,
      currentCursorPosition: null, // Clear cursor to prevent stale preview
    });

    return result;
  },

  onMouseMove(state: any, e: any) {
    // Get last confirmed point (guarded)
    const lastConfirmedPoint =
      state.polygon.coordinates[0].length >= 2
        ? state.polygon.coordinates[0][state.polygon.coordinates[0].length - 2]
        : null;

    // Get shift state
    const isShiftHeld = e.originalEvent?.shiftKey || false;

    // Compute snapped position using shared helper
    const displayCursor = getDisplayCursorPosition(
      state.map,
      [e.lngLat.lng, e.lngLat.lat],
      lastConfirmedPoint,
      isShiftHeld
    );

    // Update the moving coordinate if there are points
    if (state.polygon.coordinates[0].length > 0) {
      state.polygon.updateCoordinate(
        `0.${state.polygon.coordinates[0].length - 1}`,
        displayCursor[0],
        displayCursor[1]
      );
    }

    // Override event to ensure Draw's handler sees snapped position
    e.lngLat = {
      lng: displayCursor[0],
      lat: displayCursor[1],
    };

    // Call original onMouseMove
    const drawPolygonMode = MapboxDraw.modes.draw_polygon as any;
    const result = drawPolygonMode.onMouseMove.call(this, state, e);

    // Update preview store with cursor position
    polygonPreviewStore.setState({
      currentCursorPosition: displayCursor,
      isSnapping: isShiftHeld,
    });

    return result;
  },

  onStop(state: any) {
    // Clear preview store when exiting drawing mode
    polygonPreviewStore.clear();

    // Call and return original Draw handler
    const drawPolygonMode = MapboxDraw.modes.draw_polygon as any;
    return drawPolygonMode.onStop?.call(this, state);
  },
};

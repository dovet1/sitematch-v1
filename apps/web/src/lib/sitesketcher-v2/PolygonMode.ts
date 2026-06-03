import MapboxDraw from '@mapbox/mapbox-gl-draw';
import { getDisplayCursorPosition } from './polygon-utils';
import { polygonPreviewStore } from './polygon-preview-store';
import mapboxgl from 'mapbox-gl';

/**
 * Helper function to update cursor snapping state.
 * Centralizes snapping logic for both keyboard and mouse events.
 *
 * @param state - The Mapbox Draw mode state
 * @param isShiftHeld - Whether the shift key is currently held
 * @param rawCursor - Optional raw cursor position [lng, lat] for atomic updates
 * @returns The display cursor position, or null if no raw cursor available
 */
function updateCursorSnapping(
  state: any,
  isShiftHeld: boolean,
  rawCursor?: [number, number]
): [number, number] | null {
  // Get raw cursor position (from param or store)
  const rawCursorPosition = rawCursor || polygonPreviewStore.getState().rawCursorPosition;

  // Early cleanup if no raw cursor position
  if (!rawCursorPosition) {
    polygonPreviewStore.setState({
      snappedCursorPosition: null,
      isSnapping: false,
    });
    if (state.map && state.map.getCanvas) {
      state.map.getCanvas().style.setProperty('cursor', 'crosshair', 'important');
    }
    return null;
  }

  // Get last confirmed point and previous edge start with defensive copying
  const coords = state.polygon.coordinates[0];
  const lastConfirmedPoint = coords.length >= 2
    ? [coords[coords.length - 2][0], coords[coords.length - 2][1]] as [number, number]
    : null;
  const previousEdgeStart = coords.length >= 3
    ? [coords[coords.length - 3][0], coords[coords.length - 3][1]] as [number, number]
    : null;

  // Compute display cursor (snapped or raw based on shift state)
  const displayCursor = getDisplayCursorPosition(
    state.map,
    rawCursorPosition,
    lastConfirmedPoint,
    isShiftHeld,
    previousEdgeStart
  );

  // Update Draw's moving coordinate
  if (state.polygon.coordinates[0].length > 0) {
    state.polygon.updateCoordinate(
      `0.${state.polygon.coordinates[0].length - 1}`,
      displayCursor[0],
      displayCursor[1]
    );
  }

  // Build state update object
  const stateUpdate: any = {
    currentCursorPosition: displayCursor,
    snappedCursorPosition: isShiftHeld && lastConfirmedPoint ? displayCursor : null,
    isSnapping: isShiftHeld,
  };

  // Include raw cursor if provided (for atomic updates from mouse move)
  if (rawCursor) {
    stateUpdate.rawCursorPosition = rawCursorPosition;
  }

  // Update preview store atomically
  polygonPreviewStore.setState(stateUpdate);

  // Set cursor style
  if (state.map && state.map.getCanvas) {
    const canvas = state.map.getCanvas();
    if (isShiftHeld && lastConfirmedPoint) {
      canvas.style.setProperty('cursor', 'none', 'important');
    } else {
      canvas.style.setProperty('cursor', 'crosshair', 'important');
    }
  }

  return displayCursor;
}

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
    // Get current last confirmed point and previous edge start with defensive copying
    const coords = state.polygon.coordinates[0];
    const lastConfirmedPoint = coords.length >= 2
      ? [coords[coords.length - 2][0], coords[coords.length - 2][1]] as [number, number]
      : null;
    const previousEdgeStart = coords.length >= 3
      ? [coords[coords.length - 3][0], coords[coords.length - 3][1]] as [number, number]
      : null;

    // Compute snapped position using shared helper
    const displayCursor = getDisplayCursorPosition(
      state.map,
      [e.lngLat.lng, e.lngLat.lat],
      lastConfirmedPoint,
      e.originalEvent?.shiftKey || false,
      previousEdgeStart
    );

    // Override event to ensure actual vertex placement matches preview
    e.lngLat = {
      lng: displayCursor[0],
      lat: displayCursor[1],
    };

    // Call original clickAnywhere
    const drawPolygonMode = MapboxDraw.modes.draw_polygon as any;
    const result = drawPolygonMode.clickAnywhere.call(this, state, e);

    // Update preview store with new last confirmed point and clear all cursor fields
    const confirmedPoint = coords.length >= 2
      ? [coords[coords.length - 2][0], coords[coords.length - 2][1]] as [number, number]
      : null;
    polygonPreviewStore.setState({
      lastPlacedPoint: confirmedPoint,
      currentCursorPosition: null,
      rawCursorPosition: null,
      snappedCursorPosition: null,
      isSnapping: false,
    });

    // Restore cursor style to avoid DOM/state mismatch
    if (state.map && state.map.getCanvas) {
      state.map.getCanvas().style.setProperty('cursor', 'crosshair', 'important');
    }

    return result;
  },

  onMouseMove(state: any, e: any) {
    // Get raw cursor position
    const rawCursor: [number, number] = [e.lngLat.lng, e.lngLat.lat];

    // Get shift state
    const isShiftHeld = e.originalEvent?.shiftKey || false;

    // Update cursor snapping (performs atomic store update)
    const displayCursor = updateCursorSnapping(state, isShiftHeld, rawCursor);

    // Override event to ensure Draw's handler sees snapped position
    if (displayCursor) {
      e.lngLat = {
        lng: displayCursor[0],
        lat: displayCursor[1],
      };
    }

    // Call original onMouseMove
    const drawPolygonMode = MapboxDraw.modes.draw_polygon as any;
    const result = drawPolygonMode.onMouseMove.call(this, state, e);

    return result;
  },

  onKeyUp(state: any, e: any) {
    if (e.keyCode === 16) {
      // Shift key released
      updateCursorSnapping(state, false);
    }
    // Call original handler if it exists
    const drawPolygonMode = MapboxDraw.modes.draw_polygon as any;
    return drawPolygonMode.onKeyUp?.call(this, state, e);
  },

  onKeyDown(state: any, e: any) {
    if (e.keyCode === 16) {
      // Shift key pressed
      updateCursorSnapping(state, true);
    }
    // Call original handler if it exists
    const drawPolygonMode = MapboxDraw.modes.draw_polygon as any;
    return drawPolygonMode.onKeyDown?.call(this, state, e);
  },

  onStop(state: any) {
    // Restore cursor style
    if (state.map && state.map.getCanvas) {
      state.map.getCanvas().style.removeProperty('cursor');
    }

    // Clear preview store when exiting drawing mode
    polygonPreviewStore.clear();

    // Call and return original Draw handler
    const drawPolygonMode = MapboxDraw.modes.draw_polygon as any;
    return drawPolygonMode.onStop?.call(this, state);
  },
};

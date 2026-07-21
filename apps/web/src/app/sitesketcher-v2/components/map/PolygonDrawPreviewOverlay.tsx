'use client';

import { useEffect, useState, useRef, useCallback, useSyncExternalStore } from 'react';
import { useSketchStore } from '@/lib/sitesketcher-v2/state-manager';
import { polygonPreviewStore } from '@/lib/sitesketcher-v2/polygon-preview-store';
import {
  calculateEdgeDistance,
  formatPolygonLineDistance,
  calculateEdgeAngle,
} from '@/lib/sitesketcher-v2/polygon-utils';

interface PreviewLabel {
  x: number; // Screen x coordinate (pixels)
  y: number; // Screen y coordinate (pixels)
  text: string; // Formatted distance text
  rotation: number; // Rotation angle in degrees
}

interface PreviewLine {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export function PolygonDrawPreviewOverlay() {
  const [label, setLabel] = useState<PreviewLabel | null>(null);
  const [line, setLine] = useState<PreviewLine | null>(null);
  const [cursorPosition, setCursorPosition] = useState<{ x: number; y: number } | null>(null);
  const updateTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  // Subscribe to preview store using useSyncExternalStore
  // Third parameter is for SSR compatibility
  const previewState = useSyncExternalStore(
    polygonPreviewStore.subscribe,
    polygonPreviewStore.getState,
    polygonPreviewStore.getState
  );

  // Use selectors to avoid unnecessary rerenders
  const mapInstance = useSketchStore((state) => state.mapInstance);
  const units = useSketchStore((state) => state.units);

  // Calculate and update visual positions
  const updateVisuals = useCallback(() => {
    if (!mapInstance || !previewState) {
      setLabel(null);
      setLine(null);
      setCursorPosition(null);
      return;
    }

    const { lastPlacedPoint, currentCursorPosition, snappedCursorPosition } = previewState;

    // Update custom cursor position if snapping is active
    if (snappedCursorPosition) {
      const cursorScreen = mapInstance.project(snappedCursorPosition);
      setCursorPosition({ x: cursorScreen.x, y: cursorScreen.y });
    } else {
      setCursorPosition(null);
    }

    // Need both points to show preview line
    if (!lastPlacedPoint || !currentCursorPosition) {
      setLabel(null);
      setLine(null);
      return;
    }

    // Project both points to screen coordinates
    const p1Screen = mapInstance.project(lastPlacedPoint);
    const p2Screen = mapInstance.project(currentCursorPosition);

    // Update line
    setLine({
      x1: p1Screen.x,
      y1: p1Screen.y,
      x2: p2Screen.x,
      y2: p2Screen.y,
    });

    // Calculate distance and label position
    const distance = calculateEdgeDistance(lastPlacedPoint, currentCursorPosition);
    const midpoint: [number, number] = [
      (lastPlacedPoint[0] + currentCursorPosition[0]) / 2,
      (lastPlacedPoint[1] + currentCursorPosition[1]) / 2,
    ];
    const midpointScreen = mapInstance.project(midpoint);
    const angle = calculateEdgeAngle(mapInstance, lastPlacedPoint, currentCursorPosition);
    const formattedDistance = formatPolygonLineDistance(distance, units);

    setLabel({
      x: midpointScreen.x,
      y: midpointScreen.y,
      text: formattedDistance,
      rotation: angle,
    });
  }, [mapInstance, previewState, units]);

  // Subscribe to map events (move, zoom, rotate, pitch, resize)
  useEffect(() => {
    if (!mapInstance) return;

    // Debounced handler for smooth movement
    const handleMapMove = () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
      updateTimeoutRef.current = setTimeout(updateVisuals, 16); // ~60fps
    };

    // Immediate handler for crisp final positioning
    const handleMapMoveEnd = () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
      updateVisuals();
    };

    // Register all map event listeners
    mapInstance.on('move', handleMapMove);
    mapInstance.on('moveend', handleMapMoveEnd);
    mapInstance.on('zoom', handleMapMove);
    mapInstance.on('zoomend', handleMapMoveEnd);
    mapInstance.on('rotate', handleMapMove);
    mapInstance.on('rotateend', handleMapMoveEnd);
    mapInstance.on('pitch', handleMapMove);
    mapInstance.on('pitchend', handleMapMoveEnd);
    mapInstance.on('resize', handleMapMoveEnd);

    // Initial calculation
    updateVisuals();

    // Cleanup
    return () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
      mapInstance.off('move', handleMapMove);
      mapInstance.off('moveend', handleMapMoveEnd);
      mapInstance.off('zoom', handleMapMove);
      mapInstance.off('zoomend', handleMapMoveEnd);
      mapInstance.off('rotate', handleMapMove);
      mapInstance.off('rotateend', handleMapMoveEnd);
      mapInstance.off('pitch', handleMapMove);
      mapInstance.off('pitchend', handleMapMoveEnd);
      mapInstance.off('resize', handleMapMoveEnd);
    };
  }, [mapInstance, updateVisuals]);

  // Update visuals when preview state changes
  useEffect(() => {
    updateVisuals();
  }, [updateVisuals]);

  // Don't render if no preview data and no snapped cursor
  if (!label && !line && !cursorPosition) {
    return null;
  }

  return (
    <svg
      className="absolute inset-0 h-full w-full pointer-events-none"
      width="100%"
      height="100%"
      style={{ zIndex: 10 }}
    >
      {/* Preview line */}
      {line && (
        <line
          className="polygon-preview-line"
          x1={line.x1}
          y1={line.y1}
          x2={line.x2}
          y2={line.y2}
        />
      )}

      {/* Distance label */}
      {label && (
        <text
          className="polygon-preview-label"
          x={label.x}
          y={label.y}
          transform={`rotate(${label.rotation}, ${label.x}, ${label.y})`}
          textAnchor="middle"
          dominantBaseline="middle"
        >
          {label.text}
        </text>
      )}

      {/* Custom cursor indicator when snapping */}
      {cursorPosition && (
        <g className="polygon-snap-cursor">
          {/* Crosshair lines */}
          <line
            x1={cursorPosition.x - 10}
            y1={cursorPosition.y}
            x2={cursorPosition.x + 10}
            y2={cursorPosition.y}
            className="snap-cursor-crosshair"
          />
          <line
            x1={cursorPosition.x}
            y1={cursorPosition.y - 10}
            x2={cursorPosition.x}
            y2={cursorPosition.y + 10}
            className="snap-cursor-crosshair"
          />
          {/* Center dot */}
          <circle
            cx={cursorPosition.x}
            cy={cursorPosition.y}
            r={3}
            className="snap-cursor-dot"
          />
        </g>
      )}
    </svg>
  );
}

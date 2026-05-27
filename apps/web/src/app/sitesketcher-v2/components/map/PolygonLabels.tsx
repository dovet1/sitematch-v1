'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useSketchStore } from '@/lib/sitesketcher-v2/state-manager';
import {
  isPolygonClosed,
  calculateMidpoint,
  calculateEdgeAngle,
  calculateEdgeDistance,
  formatDistance,
} from '@/lib/sitesketcher-v2/polygon-utils';

interface LabelPosition {
  x: number; // Screen x coordinate (pixels)
  y: number; // Screen y coordinate (pixels)
  text: string; // Formatted text ("12.5m")
  rotation: number; // Rotation angle in degrees
  polygonId: string; // For React key generation
}

export function PolygonLabels() {
  const [labels, setLabels] = useState<LabelPosition[]>([]);
  const { mapInstance, polygons, units } = useSketchStore();
  const updateTimeoutRef = useRef<NodeJS.Timeout>();

  // Calculate and update label positions
  const updateLabels = useCallback(() => {
    if (!mapInstance || !polygons.length) {
      setLabels([]);
      return;
    }

    const newLabels: LabelPosition[] = [];

    polygons.forEach((polygon) => {
      // Skip if edge distances are off
      if (!polygon.showDistances) return;

      // Normalize polygon ring using tolerant closure check
      // Handles closed GeoJSON rings where first point is duplicated at end
      const normalizedPoints = isPolygonClosed(polygon.points)
        ? polygon.points.slice(0, -1)
        : polygon.points;

      // Validate after normalization (malformed closed rings can drop below 3)
      if (normalizedPoints.length < 3) return;

      // Edge distance labels
      for (let i = 0; i < normalizedPoints.length; i++) {
        const point1 = normalizedPoints[i];
        const point2 = normalizedPoints[(i + 1) % normalizedPoints.length];

        const midpoint = calculateMidpoint(point1, point2);
        const screenPos = mapInstance.project(midpoint);
        const angle = calculateEdgeAngle(mapInstance, point1, point2);
        const distance = calculateEdgeDistance(point1, point2);
        const text = formatDistance(distance, units);

        newLabels.push({
          x: screenPos.x,
          y: screenPos.y,
          text,
          rotation: angle,
          polygonId: polygon.id,
        });
      }
    });

    setLabels(newLabels);
  }, [mapInstance, polygons, units]);

  // Subscribe to map events (move, zoom, rotate, pitch, resize)
  // CRITICAL: Include updateLabels in deps to prevent stale closure
  useEffect(() => {
    if (!mapInstance) return;

    // Debounced handler for smooth movement
    const handleMapMove = () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
      updateTimeoutRef.current = setTimeout(updateLabels, 16); // ~60fps
    };

    // Immediate handler for crisp final positioning
    const handleMapMoveEnd = () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
      updateLabels();
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
    mapInstance.on('resize', handleMapMoveEnd); // Critical for panel open/close

    // Initial calculation
    updateLabels();

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
  }, [mapInstance, updateLabels]); // Re-register with fresh closure when updateLabels changes

  return (
    <svg
      className="absolute inset-0 h-full w-full pointer-events-none"
      width="100%"
      height="100%"
      style={{ zIndex: 10 }} // Ensure labels render above 3D vignette
    >
      {labels.map((label, idx) => (
        <text
          key={`${label.polygonId}-${idx}`}
          className="edge-distance-label"
          x={label.x}
          y={label.y}
          transform={`rotate(${label.rotation}, ${label.x}, ${label.y})`}
          textAnchor="middle"
          dominantBaseline="middle"
        >
          {label.text}
        </text>
      ))}
    </svg>
  );
}

'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useSketchStore } from '@/lib/sitesketcher-v2/state-manager';
import {
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
  segmentIndex: number; // For React key generation
}

interface PointPosition {
  x: number; // Screen x coordinate (pixels)
  y: number; // Screen y coordinate (pixels)
}

export function MeasurementOverlay() {
  const [labels, setLabels] = useState<LabelPosition[]>([]);
  const [points, setPoints] = useState<PointPosition[]>([]);
  const { mapInstance, measurementInProgress, units } = useSketchStore();
  const updateTimeoutRef = useRef<NodeJS.Timeout>();

  // Calculate and update visual positions
  const updateVisuals = useCallback(() => {
    if (!mapInstance || !measurementInProgress || measurementInProgress.points.length === 0) {
      setLabels([]);
      setPoints([]);
      return;
    }

    const newPoints: PointPosition[] = [];
    const newLabels: LabelPosition[] = [];

    // Convert all measurement points to screen coordinates
    measurementInProgress.points.forEach((point) => {
      const screenPos = mapInstance.project(point.lngLat);
      newPoints.push({
        x: screenPos.x,
        y: screenPos.y,
      });
    });

    // Create labels for each segment (between consecutive points)
    for (let i = 0; i < measurementInProgress.points.length - 1; i++) {
      const point1 = measurementInProgress.points[i].lngLat;
      const point2 = measurementInProgress.points[i + 1].lngLat;

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
        segmentIndex: i,
      });
    }

    setPoints(newPoints);
    setLabels(newLabels);
  }, [mapInstance, measurementInProgress, units]);

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
    mapInstance.on('resize', handleMapMoveEnd); // Critical for panel open/close

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

  // Don't render anything if no measurement in progress
  if (!measurementInProgress || measurementInProgress.points.length === 0) {
    return null;
  }

  return (
    <svg
      className="absolute inset-0 h-full w-full pointer-events-none"
      width="100%"
      height="100%"
      style={{ zIndex: 10 }} // Ensure overlay renders above 3D vignette
    >
      {/* Dashed lines connecting points */}
      {points.length > 1 && (
        <polyline
          className="measurement-line"
          points={points.map((p) => `${p.x},${p.y}`).join(' ')}
        />
      )}

      {/* Circular markers at each point */}
      {points.map((point, idx) => (
        <circle
          key={`point-${idx}`}
          className="measurement-point"
          cx={point.x}
          cy={point.y}
          r={6}
        />
      ))}

      {/* Distance labels on each segment */}
      {labels.map((label) => (
        <text
          key={`label-${label.segmentIndex}`}
          className="measurement-label"
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

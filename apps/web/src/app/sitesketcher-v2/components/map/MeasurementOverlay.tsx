'use client';

import { useEffect, useState, useRef, useCallback, useSyncExternalStore } from 'react';
import { useSketchStore } from '@/lib/sitesketcher-v2/state-manager';
import { measurementPreviewStore } from '@/lib/sitesketcher-v2/measurement-preview-store';
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

interface PreviewLine {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

interface PreviewPoint {
  x: number;
  y: number;
}

export function MeasurementOverlay() {
  const [labels, setLabels] = useState<LabelPosition[]>([]);
  const [points, setPoints] = useState<PointPosition[]>([]);
  const [frozenLabels, setFrozenLabels] = useState<LabelPosition[]>([]);
  const [frozenPoints, setFrozenPoints] = useState<PointPosition[]>([]);
  const [previewLine, setPreviewLine] = useState<PreviewLine | null>(null);
  const [previewLabel, setPreviewLabel] = useState<LabelPosition | null>(null);
  const [previewPoint, setPreviewPoint] = useState<PreviewPoint | null>(null);
  const { mapInstance, measurementInProgress, frozenMeasurement, units } = useSketchStore();
  const updateTimeoutRef = useRef<NodeJS.Timeout>();

  // Subscribe to preview store for real-time cursor tracking
  const previewState = useSyncExternalStore(
    measurementPreviewStore.subscribe,
    measurementPreviewStore.getState,
    measurementPreviewStore.getState // SSR compatibility
  );

  // Calculate and update visual positions
  const updateVisuals = useCallback(() => {
    if (!mapInstance) return;

    // Handle frozen measurement
    if (frozenMeasurement && frozenMeasurement.points.length > 0) {
      const newFrozenPoints: PointPosition[] = [];
      const newFrozenLabels: LabelPosition[] = [];

      // Convert all frozen measurement points to screen coordinates
      frozenMeasurement.points.forEach((point) => {
        const screenPos = mapInstance.project(point.lngLat);
        newFrozenPoints.push({
          x: screenPos.x,
          y: screenPos.y,
        });
      });

      // Create labels for each segment in frozen measurement
      for (let i = 0; i < frozenMeasurement.points.length - 1; i++) {
        const point1 = frozenMeasurement.points[i].lngLat;
        const point2 = frozenMeasurement.points[i + 1].lngLat;

        const midpoint = calculateMidpoint(point1, point2);
        const screenPos = mapInstance.project(midpoint);
        const angle = calculateEdgeAngle(mapInstance, point1, point2);
        const distance = calculateEdgeDistance(point1, point2);
        const text = formatDistance(distance, units);

        newFrozenLabels.push({
          x: screenPos.x,
          y: screenPos.y,
          text,
          rotation: angle,
          segmentIndex: i,
        });
      }

      setFrozenPoints(newFrozenPoints);
      setFrozenLabels(newFrozenLabels);
    } else {
      setFrozenPoints([]);
      setFrozenLabels([]);
    }

    // Handle in-progress measurement
    if (!measurementInProgress || measurementInProgress.points.length === 0) {
      setLabels([]);
      setPoints([]);
      setPreviewLine(null);
      setPreviewLabel(null);
      setPreviewPoint(null);
    } else {
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

      // Calculate preview segment if cursor is active
      if (previewState && previewState.lastMeasurementPoint && previewState.currentCursorPosition) {
        const p1Screen = mapInstance.project(previewState.lastMeasurementPoint);
        const p2Screen = mapInstance.project(previewState.currentCursorPosition);

        setPreviewLine({
          x1: p1Screen.x,
          y1: p1Screen.y,
          x2: p2Screen.x,
          y2: p2Screen.y,
        });

        setPreviewPoint({ x: p2Screen.x, y: p2Screen.y });

        const distance = calculateEdgeDistance(
          previewState.lastMeasurementPoint,
          previewState.currentCursorPosition
        );
        const midpoint: [number, number] = [
          (previewState.lastMeasurementPoint[0] + previewState.currentCursorPosition[0]) / 2,
          (previewState.lastMeasurementPoint[1] + previewState.currentCursorPosition[1]) / 2,
        ];
        const midpointScreen = mapInstance.project(midpoint);
        const angle = calculateEdgeAngle(
          mapInstance,
          previewState.lastMeasurementPoint,
          previewState.currentCursorPosition
        );

        setPreviewLabel({
          x: midpointScreen.x,
          y: midpointScreen.y,
          text: formatDistance(distance, units),
          rotation: angle,
          segmentIndex: -1, // Use -1 for preview to distinguish from confirmed segments
        });
      } else {
        setPreviewLine(null);
        setPreviewLabel(null);
        setPreviewPoint(null);
      }

      setPoints(newPoints);
      setLabels(newLabels);
    }
  }, [mapInstance, measurementInProgress, frozenMeasurement, units, previewState]);

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

  // Don't render if no measurement (in-progress or frozen)
  const hasInProgressMeasurement = measurementInProgress && measurementInProgress.points.length > 0;
  const hasFrozenMeasurement = frozenMeasurement && frozenMeasurement.points.length > 0;

  if (!hasInProgressMeasurement && !hasFrozenMeasurement) {
    return null;
  }

  return (
    <svg
      className="absolute inset-0 h-full w-full pointer-events-none"
      width="100%"
      height="100%"
      style={{ zIndex: 10 }} // Ensure overlay renders above 3D vignette
    >
      {/* Frozen measurement (if exists) */}
      {hasFrozenMeasurement && (
        <>
          {/* Dashed lines connecting frozen points */}
          {frozenPoints.length > 1 && (
            <polyline
              className="measurement-line"
              points={frozenPoints.map((p) => `${p.x},${p.y}`).join(' ')}
            />
          )}

          {/* Circular markers at each frozen point */}
          {frozenPoints.map((point, idx) => (
            <circle
              key={`frozen-point-${idx}`}
              className="measurement-point"
              cx={point.x}
              cy={point.y}
              r={6}
            />
          ))}

          {/* Distance labels on each frozen segment */}
          {frozenLabels.map((label) => (
            <text
              key={`frozen-label-${label.segmentIndex}`}
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
        </>
      )}

      {/* In-progress measurement (if exists) */}
      {hasInProgressMeasurement && (
        <>
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

          {/* Preview line and label */}
          {previewLine && (
            <>
              <line
                className="measurement-preview-line"
                x1={previewLine.x1}
                y1={previewLine.y1}
                x2={previewLine.x2}
                y2={previewLine.y2}
              />
              {previewPoint && (
                <circle
                  className="measurement-preview-point"
                  cx={previewPoint.x}
                  cy={previewPoint.y}
                  r={6}
                />
              )}
              {previewLabel && (
                <text
                  className="measurement-preview-label"
                  x={previewLabel.x}
                  y={previewLabel.y}
                  transform={`rotate(${previewLabel.rotation}, ${previewLabel.x}, ${previewLabel.y})`}
                  textAnchor="middle"
                  dominantBaseline="middle"
                >
                  {previewLabel.text}
                </text>
              )}
            </>
          )}
        </>
      )}
    </svg>
  );
}

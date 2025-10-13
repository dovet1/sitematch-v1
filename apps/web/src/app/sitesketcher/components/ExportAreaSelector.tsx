'use client';

import { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import { ExportAreaBounds } from '@/types/sitesketcher';

interface ExportAreaSelectorProps {
  map: mapboxgl.Map | null;
  isActive: boolean;
  onAreaSelected: (bounds: ExportAreaBounds) => void;
  onCancel: () => void;
}

export function ExportAreaSelector({
  map,
  isActive,
  onAreaSelected,
  onCancel,
}: ExportAreaSelectorProps) {
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const rectangleRef = useRef<HTMLDivElement | null>(null);
  const startPointRef = useRef<{ x: number; y: number } | null>(null);
  const isDrawingRef = useRef(false);
  const isInitializedRef = useRef(false);

  useEffect(() => {
    console.log('ExportAreaSelector useEffect:', { map: !!map, isActive, initialized: isInitializedRef.current });

    if (!map || !isActive) {
      isInitializedRef.current = false;
      return;
    }

    // Prevent double initialization
    if (isInitializedRef.current) {
      console.log('ExportAreaSelector: Already initialized, skipping');
      return;
    }

    isInitializedRef.current = true;
    console.log('ExportAreaSelector: Creating overlay');

    // Disable map interactions while drawing
    map.dragPan.disable();
    map.scrollZoom.disable();
    map.boxZoom.disable();
    map.doubleClickZoom.disable();
    map.touchZoomRotate.disable();

    const mapContainer = map.getContainer();
    const overlay = document.createElement('div');
    overlay.style.position = 'absolute';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.cursor = 'crosshair';
    overlay.style.zIndex = '1000';
    overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.3)';
    mapContainer.appendChild(overlay);
    overlayRef.current = overlay;

    const handleMouseDown = (e: MouseEvent) => {
      const rect = overlay.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      startPointRef.current = { x, y };
      isDrawingRef.current = true;

      // Create rectangle element
      const rectangle = document.createElement('div');
      rectangle.style.position = 'absolute';
      rectangle.style.border = '3px solid #7033ff';
      rectangle.style.backgroundColor = 'rgba(112, 51, 255, 0.15)';
      rectangle.style.pointerEvents = 'none';
      rectangle.style.left = `${x}px`;
      rectangle.style.top = `${y}px`;
      rectangle.style.width = '0px';
      rectangle.style.height = '0px';
      overlay.appendChild(rectangle);
      rectangleRef.current = rectangle;
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDrawingRef.current || !startPointRef.current || !rectangleRef.current) return;

      const rect = overlay.getBoundingClientRect();
      const currentX = e.clientX - rect.left;
      const currentY = e.clientY - rect.top;

      const width = Math.abs(currentX - startPointRef.current.x);
      const height = Math.abs(currentY - startPointRef.current.y);
      const left = Math.min(currentX, startPointRef.current.x);
      const top = Math.min(currentY, startPointRef.current.y);

      rectangleRef.current.style.width = `${width}px`;
      rectangleRef.current.style.height = `${height}px`;
      rectangleRef.current.style.left = `${left}px`;
      rectangleRef.current.style.top = `${top}px`;
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (!isDrawingRef.current || !startPointRef.current || !rectangleRef.current) return;

      const rect = overlay.getBoundingClientRect();
      const currentX = e.clientX - rect.left;
      const currentY = e.clientY - rect.top;

      // Only process if there was meaningful dragging (more than 10 pixels)
      const width = Math.abs(currentX - startPointRef.current.x);
      const height = Math.abs(currentY - startPointRef.current.y);

      if (width < 10 || height < 10) {
        cleanup();
        onCancel();
        return;
      }

      // Convert pixel coordinates to lat/lng
      const point1 = map.unproject([
        startPointRef.current.x,
        startPointRef.current.y
      ]);
      const point2 = map.unproject([
        currentX,
        currentY
      ]);

      const bounds: ExportAreaBounds = {
        north: Math.max(point1.lat, point2.lat),
        south: Math.min(point1.lat, point2.lat),
        east: Math.max(point1.lng, point2.lng),
        west: Math.min(point1.lng, point2.lng),
      };

      onAreaSelected(bounds);
      cleanup();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
        cleanup();
      }
    };

    const cleanup = () => {
      console.log('ExportAreaSelector: cleanup called');
      isDrawingRef.current = false;
      startPointRef.current = null;
      isInitializedRef.current = false;

      if (rectangleRef.current) {
        rectangleRef.current.remove();
        rectangleRef.current = null;
      }
      if (overlayRef.current) {
        overlayRef.current.remove();
        overlayRef.current = null;
      }

      // Re-enable map interactions
      if (map) {
        map.dragPan.enable();
        map.scrollZoom.enable();
        map.boxZoom.enable();
        map.doubleClickZoom.enable();
        map.touchZoomRotate.enable();
      }
    };

    overlay.addEventListener('mousedown', handleMouseDown);
    overlay.addEventListener('mousemove', handleMouseMove);
    overlay.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      overlay.removeEventListener('mousedown', handleMouseDown);
      overlay.removeEventListener('mousemove', handleMouseMove);
      overlay.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('keydown', handleKeyDown);
      cleanup();
    };
  }, [map, isActive, onAreaSelected, onCancel]);

  if (!isActive) return null;

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1001] bg-white px-4 py-2 rounded-lg shadow-lg border border-gray-200">
      <p className="text-sm text-gray-700">
        <strong>Draw a rectangle</strong> on the map to select the export area. Press <kbd className="px-1 py-0.5 bg-gray-100 border border-gray-300 rounded text-xs font-mono">ESC</kbd> to cancel.
      </p>
    </div>
  );
}

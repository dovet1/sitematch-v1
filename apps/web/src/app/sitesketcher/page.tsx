'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { MapboxMap, type MapboxMapRef } from './components/MapboxMap';
import { ResponsiveControls } from './components/ResponsiveControls';
import { AlertTriangle } from 'lucide-react';
import type { 
  MapboxDrawPolygon, 
  ParkingOverlay, 
  AreaMeasurement,
  MeasurementUnit,
  SearchResult,
  SiteSketcherState
} from '@/types/sitesketcher';
import { calculatePolygonArea } from '@/lib/sitesketcher/measurement-utils';
import { getMapboxToken } from '@/lib/sitesketcher/mapbox-utils';

const STORAGE_KEY = 'sitesketcher-state';
const RECENT_SEARCHES_KEY = 'sitesketcher-recent-searches';

export default function SiteSketcherPage() {
  const [state, setState] = useState<SiteSketcherState>({
    polygons: [],
    parkingOverlays: [],
    measurements: null,
    selectedPolygonId: null,
    selectedParkingId: null,
    measurementUnit: 'metric',
    recentSearches: [],
    snapToGrid: false,
    gridSize: 10
  });

  const [mapboxError, setMapboxError] = useState<string | null>(null);
  const [searchResult, setSearchResult] = useState<SearchResult | null>(null);
  const mapRef = useRef<MapboxMapRef>(null);
  const originalMeasurementsRef = useRef<AreaMeasurement | null>(null);

  // Load state from localStorage on mount
  useEffect(() => {
    try {
      const savedState = localStorage.getItem(STORAGE_KEY);
      const savedSearches = localStorage.getItem(RECENT_SEARCHES_KEY);
      
      if (savedState) {
        const parsed = JSON.parse(savedState);
        setState(prev => ({ ...prev, ...parsed }));
      }
      
      if (savedSearches) {
        const searches = JSON.parse(savedSearches);
        setState(prev => ({ ...prev, recentSearches: searches }));
      }
    } catch (error) {
      console.warn('Failed to load saved state:', error);
    }
  }, []);

  // Validate Mapbox token on mount
  useEffect(() => {
    try {
      getMapboxToken();
      setMapboxError(null);
    } catch (error) {
      setMapboxError(error instanceof Error ? error.message : 'Mapbox configuration error');
    }
  }, []);

  // Save state to localStorage when it changes
  useEffect(() => {
    try {
      const stateToSave = {
        polygons: state.polygons,
        parkingOverlays: state.parkingOverlays,
        measurementUnit: state.measurementUnit,
        snapToGrid: state.snapToGrid,
        gridSize: state.gridSize
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
    } catch (error) {
      console.warn('Failed to save state:', error);
    }
  }, [state.polygons, state.parkingOverlays, state.measurementUnit, state.snapToGrid, state.gridSize]);

  // Recalculate measurements when polygons change
  useEffect(() => {
    if (state.polygons.length > 0) {
      const polygon = state.polygons[0]; // Use first polygon for measurements
      
      // Check if we're currently rotating
      if (mapRef.current?.isRotating()) {
        // During rotation, keep using the stored original measurements
        if (originalMeasurementsRef.current) {
          setState(prev => ({ ...prev, measurements: originalMeasurementsRef.current }));
          return;
        }
      }
      
      // Calculate new measurements from current coordinates
      const coordinates = polygon.geometry.coordinates[0];
      const measurement = calculatePolygonArea(coordinates);
      
      // Store original measurements when not rotating
      if (!mapRef.current?.isRotating()) {
        originalMeasurementsRef.current = measurement;
      }
      
      setState(prev => ({ ...prev, measurements: measurement }));
    } else {
      setState(prev => ({ ...prev, measurements: null }));
      originalMeasurementsRef.current = null;
    }
  }, [state.polygons]);

  // Remove mode handling - tool is always in draw mode

  const handlePolygonCreate = useCallback((polygon: MapboxDrawPolygon) => {
    setState(prev => ({
      ...prev,
      polygons: [polygon], // Replace existing polygon for now (single polygon support)
      selectedPolygonId: polygon.properties?.id || null
    }));
  }, []);

  const handlePolygonUpdate = useCallback((polygon: MapboxDrawPolygon) => {
    setState(prev => ({
      ...prev,
      polygons: [polygon], // Replace existing polygon
      selectedPolygonId: polygon.properties?.id || null
    }));
  }, []);

  const handlePolygonDelete = useCallback((polygonId: string) => {
    console.log('Attempting to delete polygon with ID:', polygonId);
    console.log('Current polygons:', state.polygons.map(p => ({ 
      id: p.id, 
      propertiesId: p.properties?.id, 
      polygon: p 
    })));
    
    // Delete from map first
    mapRef.current?.deletePolygon(polygonId);
    
    // Update state - check both polygon.id and polygon.properties.id
    setState(prev => ({
      ...prev,
      polygons: prev.polygons.filter(p => 
        String(p.id) !== polygonId && 
        String(p.properties?.id) !== polygonId
      ),
      selectedPolygonId: null,
      measurements: null,
      parkingOverlays: [] // Clear parking overlays when polygon is deleted
    }));
    
    // Clear original measurements reference
    originalMeasurementsRef.current = null;
  }, [state.polygons]);

  const handleParkingOverlayClick = useCallback((overlay: ParkingOverlay) => {
    setState(prev => ({
      ...prev,
      selectedParkingId: prev.selectedParkingId === overlay.id ? null : overlay.id
    }));
  }, []);

  const handleParkingOverlayUpdate = useCallback((overlay: ParkingOverlay) => {
    setState(prev => ({
      ...prev,
      parkingOverlays: prev.parkingOverlays.map(o => 
        o.id === overlay.id ? overlay : o
      )
    }));
  }, []);

  const handleAddParkingOverlay = useCallback((overlay: ParkingOverlay) => {
    setState(prev => ({
      ...prev,
      parkingOverlays: [...prev.parkingOverlays, overlay]
    }));
  }, []);

  const handleRemoveParkingOverlay = useCallback((overlayId: string) => {
    setState(prev => ({
      ...prev,
      parkingOverlays: prev.parkingOverlays.filter(o => o.id !== overlayId),
      selectedParkingId: prev.selectedParkingId === overlayId ? null : prev.selectedParkingId
    }));
  }, []);

  const handleSelectParkingOverlay = useCallback((overlayId: string | null) => {
    setState(prev => ({ ...prev, selectedParkingId: overlayId }));
  }, []);

  const handleLocationSelect = useCallback((location: SearchResult) => {
    setSearchResult(location);
  }, []);

  const handleUpdateRecentSearches = useCallback((searches: SearchResult[]) => {
    setState(prev => ({ ...prev, recentSearches: searches }));
  }, []);

  const handleUnitToggle = useCallback(() => {
    setState(prev => ({
      ...prev,
      measurementUnit: prev.measurementUnit === 'metric' ? 'imperial' : 'metric'
    }));
  }, []);

  const handleClearAll = useCallback(() => {
    if (confirm('Clear all drawings and measurements? This cannot be undone.')) {
      // Clear from map
      mapRef.current?.clearAllDrawings();
      
      // Clear from state
      setState(prev => ({
        ...prev,
        polygons: [],
        parkingOverlays: [],
        measurements: null,
        selectedPolygonId: null,
        selectedParkingId: null
      }));
      
      // Clear original measurements reference
      originalMeasurementsRef.current = null;
    }
  }, []);

  const handleSnapToGridToggle = useCallback(() => {
    setState(prev => ({ ...prev, snapToGrid: !prev.snapToGrid }));
  }, []);


  if (mapboxError) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="mt-2">
              <strong>Mapbox Configuration Error</strong>
              <p className="mt-1">{mapboxError}</p>
              <p className="mt-2 text-sm">
                Please check that your Mapbox access token is properly configured in your environment variables.
              </p>
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur-sm z-40 px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-primary">SiteSketcher</h1>
            <p className="text-sm text-muted-foreground">
              Free site assessment tool • Draw • Measure • Plan
            </p>
          </div>
          
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex">
        {/* Desktop Sidebar */}
        <div className="hidden md:block w-80 border-r bg-background overflow-y-auto">
          <div className="p-4">
            <ResponsiveControls
              measurement={state.measurements}
              measurementUnit={state.measurementUnit}
              onUnitToggle={handleUnitToggle}
              onClearAll={handleClearAll}
              polygons={state.polygons}
              onPolygonDelete={handlePolygonDelete}
              parkingOverlays={state.parkingOverlays}
              selectedOverlayId={state.selectedParkingId}
              onAddOverlay={handleAddParkingOverlay}
              onUpdateOverlay={handleParkingOverlayUpdate}
              onRemoveOverlay={handleRemoveParkingOverlay}
              onSelectOverlay={handleSelectParkingOverlay}
              onLocationSelect={handleLocationSelect}
              recentSearches={state.recentSearches}
              onUpdateRecentSearches={handleUpdateRecentSearches}
            />
          </div>
        </div>

        {/* Map Container */}
        <div className="flex-1 relative">
          <MapboxMap
            ref={mapRef}
            onPolygonCreate={handlePolygonCreate}
            onPolygonUpdate={handlePolygonUpdate}
            onPolygonDelete={handlePolygonDelete}
            parkingOverlays={state.parkingOverlays}
            onParkingOverlayClick={handleParkingOverlayClick}
            onParkingOverlayUpdate={handleParkingOverlayUpdate}
            searchResult={searchResult}
            snapToGrid={state.snapToGrid}
            gridSize={state.gridSize}
            polygons={state.polygons}
            measurements={state.measurements}
            measurementUnit={state.measurementUnit}
            className="w-full h-full"
          />
        </div>

        {/* Mobile Controls */}
        <div className="md:hidden">
          <ResponsiveControls
            measurement={state.measurements}
            measurementUnit={state.measurementUnit}
            onUnitToggle={handleUnitToggle}
            onClearAll={handleClearAll}
            polygons={state.polygons}
            onPolygonDelete={handlePolygonDelete}
            parkingOverlays={state.parkingOverlays}
            selectedOverlayId={state.selectedParkingId}
            onAddOverlay={handleAddParkingOverlay}
            onUpdateOverlay={handleParkingOverlayUpdate}
            onRemoveOverlay={handleRemoveParkingOverlay}
            onSelectOverlay={handleSelectParkingOverlay}
            onLocationSelect={handleLocationSelect}
            recentSearches={state.recentSearches}
            onUpdateRecentSearches={handleUpdateRecentSearches}
          />
        </div>
      </div>
    </div>
  );
}
'use client';

import { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { MapboxMap, type MapboxMapRef } from './components/MapboxMap';
import { ResponsiveControls } from './components/ResponsiveControls';
import { ModeIndicator } from './components/ModeIndicator';
import { MobileFAB } from './components/MobileFAB';
import { FloatingModeIndicator } from './components/FloatingModeIndicator';
import WelcomeOnboarding from './components/WelcomeOnboarding';
import { AlertTriangle, Pencil, MousePointer, ArrowLeft } from 'lucide-react';
import type { 
  MapboxDrawPolygon, 
  ParkingOverlay, 
  AreaMeasurement,
  SearchResult,
  SiteSketcherState,
  MeasurementUnit
} from '@/types/sitesketcher';
import { calculatePolygonArea } from '@/lib/sitesketcher/measurement-utils';
import { getMapboxToken } from '@/lib/sitesketcher/mapbox-utils';
import { getPolygonColor } from '@/lib/sitesketcher/colors';
import '@/styles/sitesketcher-mobile.css';
import '@/styles/sitesketcher-toggle.css';
import Link from 'next/link';
import { useAuth } from '@/contexts/auth-context';
import { useRouter, useSearchParams } from 'next/navigation';

const STORAGE_KEY = 'sitesketcher-state';
const RECENT_SEARCHES_KEY = 'sitesketcher-recent-searches';

function SiteSketcherContent() {
  const { user, loading, profile } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const showWelcome = searchParams.get('welcome') === 'true';
  
  const [state, setState] = useState<SiteSketcherState>({
    polygons: [],
    parkingOverlays: [],
    measurements: null,
    selectedPolygonId: null,
    selectedParkingId: null,
    measurementUnit: 'metric',
    drawingMode: 'draw',
    recentSearches: [],
    snapToGrid: false,
    gridSize: 10,
    showSideLengths: true
  });

  const [mapboxError, setMapboxError] = useState<string | null>(null);
  const [searchResult, setSearchResult] = useState<SearchResult | null>(null);
  const [showWelcomeModal, setShowWelcomeModal] = useState(showWelcome);
  const mapRef = useRef<MapboxMapRef>(null);
  const originalMeasurementsRef = useRef<AreaMeasurement | null>(null);

  // Authentication guard - redirect to landing if not authenticated
  useEffect(() => {
    if (!loading && !user) {
      // Add a small delay to prevent flash
      const timer = setTimeout(() => {
        router.push('/sitesketcher/landing');
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [user, loading, router]);

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
        gridSize: state.gridSize,
        drawingMode: state.drawingMode, // Save drawing mode preference
        showSideLengths: state.showSideLengths
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
    } catch (error) {
      console.warn('Failed to save state:', error);
    }
  }, [state.polygons, state.parkingOverlays, state.measurementUnit, state.snapToGrid, state.gridSize, state.drawingMode, state.showSideLengths]);

  // Recalculate measurements when polygons or selection changes
  useEffect(() => {
    if (state.polygons.length > 0 && state.selectedPolygonId) {
      // Find the selected polygon
      const polygon = state.polygons.find(p => 
        String(p.id) === state.selectedPolygonId || 
        String(p.properties?.id) === state.selectedPolygonId
      );
      
      if (!polygon) {
        setState(prev => ({ ...prev, measurements: null }));
        return;
      }
      
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
  }, [state.polygons, state.selectedPolygonId]);

  // Remove mode handling - tool is always in draw mode

  const handlePolygonCreate = useCallback((polygon: MapboxDrawPolygon) => {
    setState(prev => {
      // Add color to the polygon
      const color = getPolygonColor(prev.polygons.length);
      
      const polygonWithColor = {
        ...polygon,
        properties: {
          ...polygon.properties,
          color: color,
          user_color: color // Use both properties to ensure compatibility
        }
      };
      
      const newState = {
        ...prev,
        polygons: [...prev.polygons, polygonWithColor],
        selectedPolygonId: String(polygonWithColor.id || polygonWithColor.properties?.id || '')
      };
      
      return newState;
    });
  }, []);

  const handlePolygonUpdate = useCallback((polygon: MapboxDrawPolygon) => {    
    setState(prev => {
      return {
        ...prev,
        polygons: prev.polygons.map(p => {
          // Use a more precise matching strategy - prefer exact ID match
          const exactIdMatch = p.id && polygon.id && String(p.id) === String(polygon.id);
          const exactPropsMatch = p.properties?.id && polygon.properties?.id && 
            String(p.properties.id) === String(polygon.properties.id);
          
          // Only update if we have a clear match
          if (exactIdMatch || exactPropsMatch) {
            return polygon;
          }
          return p;
        }),
        selectedPolygonId: String(polygon.id || polygon.properties?.id || '')
      };
    });
  }, []);

  const handlePolygonDelete = useCallback((polygonId: string) => {
    console.log('Deleting polygon with ID:', polygonId);
    
    // Delete from map first
    mapRef.current?.deletePolygon(polygonId);
    
    // Update state - check both polygon.id and polygon.properties.id
    setState(prev => {
      console.log('Available polygons before deletion:', prev.polygons.map(p => ({
        id: p.id,
        propsId: p.properties?.id,
        stringId: String(p.id || ''),
        stringPropsId: String(p.properties?.id || '')
      })));
      
      const filteredPolygons = prev.polygons.filter(p => {
        const pId = String(p.id || '');
        const pPropsId = String(p.properties?.id || '');
        const shouldKeep = pId !== polygonId && pPropsId !== polygonId;
        console.log(`Polygon ${pId}/${pPropsId}: shouldKeep = ${shouldKeep}`);
        return shouldKeep;
      });
      
      console.log('Polygons after filter:', filteredPolygons.length);
      
      return {
        ...prev,
        polygons: filteredPolygons,
        selectedPolygonId: null,
        measurements: null
        // Keep parking overlays - they are independent of polygons
      };
    });
    
    // Clear original measurements reference
    originalMeasurementsRef.current = null;
  }, []);

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

  const handleClearParkingSelection = useCallback(() => {
    setState(prev => ({ ...prev, selectedParkingId: null }));
  }, []);

  const handleClearPolygonSelection = useCallback(() => {
    setState(prev => ({ ...prev, selectedPolygonId: null }));
  }, []);

  const handlePolygonSelect = useCallback((polygonId: string) => {
    setState(prev => ({ ...prev, selectedPolygonId: polygonId }));
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
      measurementUnit: (prev.measurementUnit === 'metric' ? 'imperial' : 'metric') as MeasurementUnit
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

  const handleClearAllParking = useCallback(() => {
    if (confirm('Clear all parking overlays? This cannot be undone.')) {
      setState(prev => ({
        ...prev,
        parkingOverlays: [],
        selectedParkingId: null
      }));
    }
  }, []);

  const handleModeToggle = useCallback(() => {
    setState(prev => ({
      ...prev,
      drawingMode: prev.drawingMode === 'draw' ? 'select' : 'draw'
    }));
  }, []);

  const handleToggleSideLengths = useCallback(() => {
    setState(prev => ({
      ...prev,
      showSideLengths: !prev.showSideLengths
    }));
  }, []);

  const handlePolygonUnitToggle = useCallback((polygonId: string) => {
    setState(prev => ({
      ...prev,
      polygons: prev.polygons.map(polygon => {
        const id = String(polygon.id || polygon.properties?.id || '');
        if (id === polygonId) {
          const currentUnit = polygon.properties?.measurementUnit ?? prev.measurementUnit;
          return {
            ...polygon,
            properties: {
              ...polygon.properties,
              measurementUnit: (currentUnit === 'metric' ? 'imperial' : 'metric') as MeasurementUnit
            }
          };
        }
        return polygon;
      })
    }));
  }, []);

  const handlePolygonSideLengthToggle = useCallback((polygonId: string) => {
    setState(prev => ({
      ...prev,
      polygons: prev.polygons.map(polygon => {
        const id = String(polygon.id || polygon.properties?.id || '');
        if (id === polygonId) {
          // Determine current effective value using same logic as display
          const hasIndividualSetting = polygon.properties && 'showSideLengths' in polygon.properties;
          const currentShow = hasIndividualSetting 
            ? polygon.properties.showSideLengths 
            : prev.showSideLengths;
          
          return {
            ...polygon,
            properties: {
              ...polygon.properties,
              showSideLengths: !currentShow
            }
          };
        }
        return polygon;
      })
    }));
  }, []);

  const handleWelcomeClose = useCallback(() => {
    setShowWelcomeModal(false);
    // Remove the welcome parameter from URL without triggering a reload
    const url = new URL(window.location.href);
    url.searchParams.delete('welcome');
    window.history.replaceState({}, '', url.toString());
  }, []);

  // Show loading while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading SiteSketcher...</p>
        </div>
      </div>
    );
  }

  // Don't render if not authenticated (redirect will happen)
  if (!user) {
    return null;
  }

  if (mapboxError) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="max-w-md w-full space-y-4">
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
          
          {/* Recovery actions */}
          <div className="flex flex-col sm:flex-row gap-2">
            <Button 
              variant="outline" 
              onClick={() => window.location.reload()}
              className="flex-1"
            >
              Reload Page
            </Button>
            <Button 
              variant="outline" 
              onClick={() => router.push('/sitesketcher/landing')}
              className="flex-1"
            >
              Back to Landing
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-background">
      {/* Desktop Layout */}
      <div className="hidden md:flex md:flex-col md:h-full">
        {/* Header */}
        <header className="border-b bg-background/95 backdrop-blur-sm z-40 px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link 
                href="/"
                className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-muted transition-colors"
                title="Back to SiteMatcher"
              >
                <ArrowLeft className="h-4 w-4 text-muted-foreground hover:text-foreground" />
              </Link>
              <div>
                <h1 className="text-xl font-bold text-primary">SiteSketcher</h1>
                <p className="text-sm text-muted-foreground">
                  Free site drawing tool
                </p>
              </div>
            </div>
          </div>
        </header>

        {/* Desktop Main Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Desktop Sidebar */}
          <div className="w-80 border-r bg-background flex flex-col">
            <div className="flex-1 overflow-y-auto desktop-sidebar-scroll p-4">
              <ResponsiveControls
                measurement={state.measurements}
                measurementUnit={state.measurementUnit}
                onUnitToggle={handleUnitToggle}
                onClearAll={handleClearAll}
                drawingMode={state.drawingMode}
                onModeToggle={handleModeToggle}
                polygons={state.polygons}
                onPolygonDelete={handlePolygonDelete}
                parkingOverlays={state.parkingOverlays}
                selectedOverlayId={state.selectedParkingId}
                onAddOverlay={handleAddParkingOverlay}
                onUpdateOverlay={handleParkingOverlayUpdate}
                onRemoveOverlay={handleRemoveParkingOverlay}
                onSelectOverlay={handleSelectParkingOverlay}
                onClearAllParking={handleClearAllParking}
                onLocationSelect={handleLocationSelect}
                recentSearches={state.recentSearches}
                onUpdateRecentSearches={handleUpdateRecentSearches}
                showSideLengths={state.showSideLengths}
                onToggleSideLengths={handleToggleSideLengths}
                onPolygonUnitToggle={handlePolygonUnitToggle}
                onPolygonSideLengthToggle={handlePolygonSideLengthToggle}
              />
            </div>
          </div>

          {/* Desktop Map Container */}
          <div className="flex-1 relative overflow-hidden">
            <MapboxMap
              ref={mapRef}
              onPolygonCreate={handlePolygonCreate}
              onPolygonUpdate={handlePolygonUpdate}
              onPolygonDelete={handlePolygonDelete}
              onPolygonSelect={handlePolygonSelect}
              onClearPolygonSelection={handleClearPolygonSelection}
              parkingOverlays={state.parkingOverlays}
              onParkingOverlayClick={handleParkingOverlayClick}
              onParkingOverlayUpdate={handleParkingOverlayUpdate}
              onClearParkingSelection={handleClearParkingSelection}
              searchResult={searchResult}
              snapToGrid={state.snapToGrid}
              gridSize={state.gridSize}
              polygons={state.polygons}
              selectedPolygonId={state.selectedPolygonId}
              selectedParkingId={state.selectedParkingId}
              measurements={state.measurements}
              measurementUnit={state.measurementUnit}
              drawingMode={state.drawingMode}
              showSideLengths={state.showSideLengths}
              className="w-full h-full"
            />
            
            {/* Desktop Mode Toggle Button */}
            {/* Floating Mode Indicator for Desktop */}
            <FloatingModeIndicator 
              mode={state.drawingMode}
              onToggle={handleModeToggle}
              position="bottom-right"
            />
          </div>
        </div>
      </div>

      {/* Mobile Layout - Full screen */}
      <div className="md:hidden mobile-layout">
        {/* Mobile Navigation */}
        <div className="fixed top-4 left-4 z-50 flex items-center gap-3">
          <Link 
            href="/"
            className="flex items-center justify-center w-10 h-10 bg-white/95 backdrop-blur-sm rounded-full shadow-lg border border-gray-200 hover:bg-gray-50 transition-colors"
            title="Back to SiteMatcher"
          >
            <ArrowLeft className="h-5 w-5 text-gray-700" />
          </Link>
        </div>

        {/* Full Screen Map */}
        <div className="mobile-map-container">
          <ModeIndicator mode={state.drawingMode} />
          <MobileFAB mode={state.drawingMode} onModeToggle={handleModeToggle} />
          <MapboxMap
            ref={mapRef}
            onPolygonCreate={handlePolygonCreate}
            onPolygonUpdate={handlePolygonUpdate}
            onPolygonDelete={handlePolygonDelete}
            onPolygonSelect={handlePolygonSelect}
            onClearPolygonSelection={handleClearPolygonSelection}
            parkingOverlays={state.parkingOverlays}
            onParkingOverlayClick={handleParkingOverlayClick}
            onParkingOverlayUpdate={handleParkingOverlayUpdate}
            onClearParkingSelection={handleClearParkingSelection}
            searchResult={searchResult}
            snapToGrid={state.snapToGrid}
            gridSize={state.gridSize}
            polygons={state.polygons}
            selectedPolygonId={state.selectedPolygonId}
            selectedParkingId={state.selectedParkingId}
            measurements={state.measurements}
            measurementUnit={state.measurementUnit}
            drawingMode={state.drawingMode}
            showSideLengths={state.showSideLengths}
            className="w-full h-full"
          />
        </div>

        {/* Mobile Bottom Sheet - Always visible */}
        <div className="mobile-bottom-sheet-container">
          <ResponsiveControls
            measurement={state.measurements}
            measurementUnit={state.measurementUnit}
            onUnitToggle={handleUnitToggle}
            onClearAll={handleClearAll}
            drawingMode={state.drawingMode}
            onModeToggle={handleModeToggle}
            polygons={state.polygons}
            onPolygonDelete={handlePolygonDelete}
            parkingOverlays={state.parkingOverlays}
            selectedOverlayId={state.selectedParkingId}
            onAddOverlay={handleAddParkingOverlay}
            onUpdateOverlay={handleParkingOverlayUpdate}
            onRemoveOverlay={handleRemoveParkingOverlay}
            onSelectOverlay={handleSelectParkingOverlay}
            onClearAllParking={handleClearAllParking}
            onLocationSelect={handleLocationSelect}
            recentSearches={state.recentSearches}
            onUpdateRecentSearches={handleUpdateRecentSearches}
            showSideLengths={state.showSideLengths}
            onToggleSideLengths={handleToggleSideLengths}
            onPolygonUnitToggle={handlePolygonUnitToggle}
            onPolygonSideLengthToggle={handlePolygonSideLengthToggle}
          />
        </div>
      </div>

      {/* Welcome Onboarding Modal */}
      <WelcomeOnboarding
        isOpen={showWelcomeModal}
        onClose={handleWelcomeClose}
        userProfile={profile}
      />
    </div>
  );
}

export default function SiteSketcherPage() {
  return (
    <Suspense fallback={<div className="h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
        <p className="text-muted-foreground">Loading SiteSketcher...</p>
      </div>
    </div>}>
      <SiteSketcherContent />
    </Suspense>
  );
}
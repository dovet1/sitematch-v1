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
import { CuboidStorySelector } from './components/CuboidStorySelector';
import { SaveSketchModal } from './components/SaveSketchModal';
import { SketchesList } from './components/SketchesList';
import { DocumentBar } from './components/DocumentBar';
import { UnsavedChangesDialog } from './components/UnsavedChangesDialog';
import { AlertTriangle, Pencil, MousePointer, ArrowLeft, Menu, Building2 } from 'lucide-react';
import type {
  MapboxDrawPolygon,
  ParkingOverlay,
  AreaMeasurement,
  SearchResult,
  SiteSketcherState,
  MeasurementUnit,
  SavedSketch,
  ExportAreaBounds,
  StoreShape,
  PlacedStoreShape
} from '@/types/sitesketcher';
import { calculatePolygonArea } from '@/lib/sitesketcher/measurement-utils';
import { getMapboxToken, flyToLocation } from '@/lib/sitesketcher/mapbox-utils';
import { getPolygonColor } from '@/lib/sitesketcher/colors';
import { translatePolygon, translateFeatureCollection, calculateFeatureCollectionCentroid, extractOuterBoundary } from '@/lib/sitesketcher/store-shapes-service';
import { createSketch, updateSketch } from '@/lib/sitesketcher/sketch-service';
import { exportAsJSON, exportAsCSV, exportAsPNG, exportAsPDF } from '@/lib/sitesketcher/export-utils';
import '@/styles/sitesketcher-mobile.css';
import '@/styles/sitesketcher-toggle.css';
import Link from 'next/link';
import { useAuth } from '@/contexts/auth-context';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { Toaster } from 'sonner';
import { useSubscriptionTier } from '@/hooks/useSubscriptionTier';
import { UpgradeBanner } from '@/components/UpgradeBanner';

const STORAGE_KEY = 'sitesketcher-state';
const RECENT_SEARCHES_KEY = 'sitesketcher-recent-searches';

function SiteSketcherContent() {
  const { user, loading, profile } = useAuth();
  const { isFreeTier, isPro, loading: tierLoading } = useSubscriptionTier();
  const router = useRouter();
  const searchParams = useSearchParams();
  const showWelcome = searchParams?.get('welcome') === 'true';

  // Check if we should center on a specific location from URL params (e.g., from "Create Sketch" on a site)
  const initialAddress = searchParams?.get('address');
  const initialLat = searchParams?.get('lat');
  const initialLng = searchParams?.get('lng');

  // Check if linked to a site (will auto-link on save)
  const linkedSiteId = searchParams?.get('site_id');
  const linkedSiteName = searchParams?.get('site_name');

  // Check if we should load a specific sketch from URL params
  const sketchIdToLoad = searchParams?.get('sketch');

  const [state, setState] = useState<SiteSketcherState>({
    polygons: [],
    parkingOverlays: [],
    cuboids: [],
    measurements: null,
    selectedPolygonId: null,
    selectedParkingId: null,
    selectedCuboidId: null,
    measurementUnit: 'metric',
    drawingMode: 'draw',
    viewMode: '2D',
    show3DBuildings: false,
    recentSearches: [],
    snapToGrid: false,
    gridSize: 10,
    showSideLengths: true,
    exportAreaBounds: null
  });

  const [mapboxError, setMapboxError] = useState<string | null>(null);
  const [searchResult, setSearchResult] = useState<SearchResult | null>(null);
  const [showWelcomeModal, setShowWelcomeModal] = useState(showWelcome);
  const [rectangleToPlace, setRectangleToPlace] = useState<{ width: number; length: number } | null>(null);
  const [storeShapeToPlace, setStoreShapeToPlace] = useState<StoreShape | null>(null);
  const [showCuboidSelector, setShowCuboidSelector] = useState(false);
  const [pendingCuboidPolygon, setPendingCuboidPolygon] = useState<MapboxDrawPolygon | null>(null);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showLoadModal, setShowLoadModal] = useState(false);
  const [currentSketchId, setCurrentSketchId] = useState<string | null>(null);
  const [currentSketchName, setCurrentSketchName] = useState('Untitled Sketch');
  const [savedStateSnapshot, setSavedStateSnapshot] = useState<string>('');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isSelectingExportArea, setIsSelectingExportArea] = useState(false);
  const [showMobileFileMenu, setShowMobileFileMenu] = useState(false);
  const [showUpgradeBanner, setShowUpgradeBanner] = useState(false);
  const [upgradeBannerType, setUpgradeBannerType] = useState<'polygon' | 'parking'>('polygon');
  const mapRef = useRef<MapboxMapRef>(null);
  const originalMeasurementsRef = useRef<AreaMeasurement | null>(null);
  const hasLoadedFromUrlRef = useRef(false);

  // Note: No authentication guard - allow all users to access SiteSketcher
  // Free tier users will have limited functionality (2 polygons, 2 parking, no save/load)

  // Detect unsaved changes by comparing current state with saved snapshot
  useEffect(() => {
    const currentStateStr = JSON.stringify(state);
    if (savedStateSnapshot && currentStateStr !== savedStateSnapshot) {
      setHasUnsavedChanges(true);
    } else if (!savedStateSnapshot) {
      // If there's no snapshot yet, check if state is non-empty
      const hasContent = state.polygons.length > 0 || state.parkingOverlays.length > 0 || state.cuboids.length > 0;
      setHasUnsavedChanges(hasContent);
    }
  }, [state, savedStateSnapshot]);

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

  // Load sketch from URL parameter if present
  useEffect(() => {
    if (sketchIdToLoad && !hasLoadedFromUrlRef.current) {
      hasLoadedFromUrlRef.current = true; // Mark as loaded immediately to prevent double execution

      const loadSketchFromUrl = async () => {
        try {
          const response = await fetch(`/api/sitesketcher/sketches/${sketchIdToLoad}`);
          if (!response.ok) throw new Error('Failed to load sketch');

          const { sketch } = await response.json();

          // Load the sketch data
          setState(sketch.data);
          setCurrentSketchId(sketch.id);
          setCurrentSketchName(sketch.name);

          // Update saved snapshot and clear unsaved changes
          setSavedStateSnapshot(JSON.stringify(sketch.data));
          setHasUnsavedChanges(false);

          // Navigate to sketch location if available
          if (sketch.location) {
            setTimeout(() => {
              setSearchResult({
                id: `sketch-location-${sketch.id}`,
                place_name: sketch.name,
                center: sketch.location.center,
                place_type: ['place'],
                properties: {}
              });
            }, 1000);
          }

          toast.success(`Sketch "${sketch.name}" loaded`);

          // Clean up URL parameter
          const url = new URL(window.location.href);
          url.searchParams.delete('sketch');
          window.history.replaceState({}, '', url.toString());
        } catch (error) {
          console.error('Error loading sketch from URL:', error);
          toast.error('Failed to load sketch');
          hasLoadedFromUrlRef.current = false; // Reset on error so user can retry

          // Clean up URL parameter on error
          const url = new URL(window.location.href);
          url.searchParams.delete('sketch');
          window.history.replaceState({}, '', url.toString());
        }
      };

      loadSketchFromUrl();
    }
  }, [sketchIdToLoad]);

  // Center map on initial location from URL parameters (e.g., from site address)
  useEffect(() => {
    if (initialAddress && initialLat && initialLng && mapRef.current) {
      const lat = parseFloat(initialLat);
      const lng = parseFloat(initialLng);

      if (!isNaN(lat) && !isNaN(lng)) {
        // Create a search result to trigger the map centering
        const locationResult: SearchResult = {
          id: `site-location-${Date.now()}`,
          place_name: initialAddress,
          center: [lng, lat],
          place_type: ['address'],
          properties: {}
        };

        // Set the search result which will trigger the map to fly to this location
        setTimeout(() => {
          setSearchResult(locationResult);
        }, 500); // Small delay to ensure map is fully initialized

        // Optionally remove the params from URL to keep it clean
        const url = new URL(window.location.href);
        url.searchParams.delete('address');
        url.searchParams.delete('lat');
        url.searchParams.delete('lng');
        window.history.replaceState({}, '', url.toString());
      }
    }
  }, [initialAddress, initialLat, initialLng]);

  // Save state to localStorage when it changes
  useEffect(() => {
    try {
      const stateToSave = {
        polygons: state.polygons,
        parkingOverlays: state.parkingOverlays,
        cuboids: state.cuboids,
        measurementUnit: state.measurementUnit,
        snapToGrid: state.snapToGrid,
        gridSize: state.gridSize,
        drawingMode: state.drawingMode, // Save drawing mode preference
        viewMode: state.viewMode,
        show3DBuildings: state.show3DBuildings,
        showSideLengths: state.showSideLengths
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
    } catch (error) {
      console.warn('Failed to save state:', error);
    }
  }, [state.polygons, state.parkingOverlays, state.cuboids, state.measurementUnit, state.snapToGrid, state.gridSize, state.drawingMode, state.viewMode, state.show3DBuildings, state.showSideLengths]);

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
    // Check free tier limit before adding polygon
    setState(prev => {
      if (isFreeTier && prev.polygons.length >= 2) {
        // Show upgrade banner and prevent polygon creation
        setShowUpgradeBanner(true);
        setUpgradeBannerType('polygon');
        // Delete the polygon from the map
        mapRef.current?.deletePolygon(String(polygon.id || polygon.properties?.id || ''));
        toast.error('Free tier limit reached: 2 shapes maximum');
        return prev;
      }

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
  }, [isFreeTier]);

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
            // Merge properties to preserve custom properties like height
            return {
              ...polygon,
              properties: {
                ...p.properties,
                ...polygon.properties
              }
            };
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
    setState(prev => {
      // Check free tier limit before adding parking overlay
      if (isFreeTier && prev.parkingOverlays.length >= 2) {
        setShowUpgradeBanner(true);
        setUpgradeBannerType('parking');
        toast.error('Free tier limit reached: 2 parking blocks maximum');
        return prev;
      }

      return {
        ...prev,
        parkingOverlays: [...prev.parkingOverlays, overlay]
      };
    });
  }, [isFreeTier]);

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
        cuboids: [],
        measurements: null,
        selectedPolygonId: null,
        selectedParkingId: null,
        selectedCuboidId: null
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

  const handleViewModeToggle = useCallback(() => {
    setState(prev => {
      const newMode = prev.viewMode === '2D' ? '3D' : '2D';
      // Call map ref to update camera
      mapRef.current?.setViewMode(newMode);
      return {
        ...prev,
        viewMode: newMode,
        // Automatically turn off 3D buildings when switching to 2D mode
        show3DBuildings: newMode === '2D' ? false : prev.show3DBuildings
      };
    });
  }, []);

  const handleToggle3DBuildings = useCallback(() => {
    setState(prev => ({
      ...prev,
      show3DBuildings: !prev.show3DBuildings
    }));
  }, []);

  const handleCuboidStorySelect = useCallback((stories: 1 | 2 | 3) => {
    if (!pendingCuboidPolygon) return;

    const { STORY_HEIGHTS } = require('@/types/sitesketcher');
    const { getPolygonColor } = require('@/lib/sitesketcher/colors');

    const cuboid = {
      id: String(pendingCuboidPolygon.id || pendingCuboidPolygon.properties?.id || Date.now()),
      type: 'Feature' as const,
      geometry: pendingCuboidPolygon.geometry,
      properties: {
        height: STORY_HEIGHTS[stories],
        stories,
        base_height: 0,
        is3DShape: true as const,
        color: getPolygonColor(state.cuboids.length)
      }
    };

    setState(prev => ({
      ...prev,
      cuboids: [...prev.cuboids, cuboid],
      selectedCuboidId: cuboid.id
    }));

    // Clear pending state
    setPendingCuboidPolygon(null);
  }, [pendingCuboidPolygon, state.cuboids.length]);

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

  const handlePolygonHeightChange = useCallback((polygonId: string, height: number) => {
    setState(prev => ({
      ...prev,
      polygons: prev.polygons.map(polygon => {
        const id = String(polygon.id || polygon.properties?.id || '');
        if (id === polygonId) {
          return {
            ...polygon,
            properties: {
              ...polygon.properties,
              height: height,
              base_height: 0 // Start from ground level
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

  const handleAddRectangle = useCallback((width: number, length: number) => {
    // Store rectangle dimensions for placement
    setRectangleToPlace({ width, length });
  }, []);

  // Store Shape handlers - Convert store shape to simple polygon
  const handleStoreShapeSelect = useCallback((shape: StoreShape) => {
    console.log('handleStoreShapeSelect called with:', shape.name);

    // Check free tier limit
    if (isFreeTier && state.polygons.length >= 2) {
      setShowUpgradeBanner(true);
      setUpgradeBannerType('polygon');
      toast.error('Free tier limit reached: 2 shapes maximum');
      return;
    }

    // Set the shape to be placed on map click
    setStoreShapeToPlace(shape);
    toast.info(`Click on the map to place ${shape.name}`);
  }, [isFreeTier, state.polygons.length]);

  const handleStoreShapePlaced = useCallback((clickedLocation: [number, number]) => {
    if (!storeShapeToPlace) return;

    setState(prev => {
      // Extract outer boundary from complex GeoJSON
      const boundary = extractOuterBoundary(storeShapeToPlace.geojson);

      // Translate boundary to clicked location
      // The boundary is at [0, 0], so we need to center it at the clicked location
      const translatedBoundary = translatePolygon(boundary, clickedLocation);

      // Create MapboxDrawPolygon from store shape
      const polygon: MapboxDrawPolygon = {
        id: `store-shape-${storeShapeToPlace.id}-${Date.now()}`,
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: translatedBoundary
        },
        properties: {
          id: `store-shape-${storeShapeToPlace.id}-${Date.now()}`,
          color: getPolygonColor(prev.polygons.length),
          storeShapeName: storeShapeToPlace.name,
          isFromStoreShape: true,
          measurementUnit: prev.measurementUnit || 'metric'
        }
      };

      console.log('Created polygon from store shape:', polygon);

      const newPolygons = [...prev.polygons, polygon];
      toast.success(`Placed ${storeShapeToPlace.name}`);

      return {
        ...prev,
        polygons: newPolygons,
        selectedPolygonId: String(polygon.id)
      };
    });

    // Clear the shape to place
    setStoreShapeToPlace(null);
  }, [storeShapeToPlace]);

  // Save/Load/Export handlers
  // Handle Save - updates existing or prompts for name if new
  const handleSave = useCallback(async () => {
    if (!currentSketchId || currentSketchName === 'Untitled Sketch') {
      // No existing sketch or unnamed, trigger Save As
      setShowSaveModal(true);
      return;
    }

    // Save to existing sketch
    setIsSaving(true);
    try {
      let location: { center: [number, number]; zoom: number } | undefined = undefined;
      if (mapRef.current) {
        const center = mapRef.current.getCenter();
        const zoom = mapRef.current.getZoom();
        location = {
          center: [center.lng, center.lat] as [number, number],
          zoom
        };
      }

      await updateSketch(currentSketchId, {
        name: currentSketchName,
        description: '',
        data: state,
        location
      });

      // Update saved snapshot
      setSavedStateSnapshot(JSON.stringify(state));
      setHasUnsavedChanges(false);
    } catch (error) {
      console.error('Failed to save sketch:', error);
    } finally {
      setIsSaving(false);
    }
  }, [state, currentSketchId, currentSketchName]);

  // Handle Save As - always creates new sketch or renames
  const handleSaveAs = useCallback(() => {
    setShowSaveModal(true);
  }, []);

  const handleSaveSketch = useCallback(async (name: string, description: string) => {
    setIsSaving(true);
    try {
      let location: { center: [number, number]; zoom: number } | undefined = undefined;
      if (mapRef.current) {
        const center = mapRef.current.getCenter();
        const zoom = mapRef.current.getZoom();
        location = {
          center: [center.lng, center.lat] as [number, number],
          zoom
        };
      }

      if (currentSketchId && name === currentSketchName) {
        // Updating existing sketch with same name
        await updateSketch(currentSketchId, {
          name,
          description,
          data: state,
          location
        });
      } else {
        // Creating new sketch (Save As)
        const sketch = await createSketch({
          name,
          description,
          data: state,
          location
        });
        setCurrentSketchId(sketch.id);
        setCurrentSketchName(sketch.name);

        // If linked to a site, attach the sketch to it
        if (linkedSiteId) {
          try {
            const linkResponse = await fetch(`/api/sites/${linkedSiteId}/sketches`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ sketch_id: sketch.id }),
            });

            if (linkResponse.ok) {
              toast.success(`Sketch linked to ${linkedSiteName || 'site'} successfully`);
            } else {
              toast.error('Sketch saved but failed to link to site');
            }
          } catch (linkError) {
            console.error('Failed to link sketch to site:', linkError);
            toast.error('Sketch saved but failed to link to site');
          }
        }
      }

      // Update saved snapshot
      setSavedStateSnapshot(JSON.stringify(state));
      setHasUnsavedChanges(false);
      setShowSaveModal(false);
    } catch (error) {
      console.error('Failed to save sketch:', error);
      throw error;
    } finally {
      setIsSaving(false);
    }
  }, [state, currentSketchId, currentSketchName, linkedSiteId, linkedSiteName]);

  // Handle New Sketch
  const handleNewSketch = useCallback(() => {
    if (hasUnsavedChanges) {
      setPendingAction(() => () => {
        // Reset to blank sketch
        setState({
          polygons: [],
          parkingOverlays: [],
          cuboids: [],
          measurements: null,
          selectedPolygonId: null,
          selectedParkingId: null,
          selectedCuboidId: null,
          measurementUnit: state.measurementUnit,
          drawingMode: 'draw',
          viewMode: '2D',
          show3DBuildings: false,
          recentSearches: state.recentSearches,
          snapToGrid: false,
          gridSize: 10,
          showSideLengths: true,
          exportAreaBounds: null
        });
        setCurrentSketchId(null);
        setCurrentSketchName('Untitled Sketch');
        setSavedStateSnapshot('');
        setHasUnsavedChanges(false);
      });
      setShowUnsavedDialog(true);
    } else {
      // No unsaved changes, create new immediately
      setState({
        polygons: [],
        parkingOverlays: [],
        cuboids: [],
        measurements: null,
        selectedPolygonId: null,
        selectedParkingId: null,
        selectedCuboidId: null,
        measurementUnit: state.measurementUnit,
        drawingMode: 'draw',
        viewMode: '2D',
        show3DBuildings: false,
        recentSearches: state.recentSearches,
        snapToGrid: false,
        gridSize: 10,
        showSideLengths: true,
        exportAreaBounds: null
      });
      setCurrentSketchId(null);
      setCurrentSketchName('Untitled Sketch');
      setSavedStateSnapshot('');
      setHasUnsavedChanges(false);
    }
  }, [hasUnsavedChanges, state.measurementUnit, state.recentSearches]);

  // Handle Close Sketch (same as New Sketch)
  const handleCloseSketch = handleNewSketch;

  // Handle Rename Sketch
  const handleRenameSketch = useCallback((newName: string) => {
    setCurrentSketchName(newName);
    setHasUnsavedChanges(true);
  }, []);

  const handleLoad = useCallback(() => {
    if (hasUnsavedChanges) {
      setPendingAction(() => () => {
        setShowLoadModal(true);
      });
      setShowUnsavedDialog(true);
    } else {
      setShowLoadModal(true);
    }
  }, [hasUnsavedChanges]);

  const handleLoadSketch = useCallback((sketch: SavedSketch) => {
    console.log('Loading sketch:', sketch.name);
    console.log('Sketch location:', sketch.location);

    // Load the state and polygons first
    setState(sketch.data);
    setCurrentSketchId(sketch.id);
    setCurrentSketchName(sketch.name);

    // Update saved snapshot and clear unsaved changes
    setSavedStateSnapshot(JSON.stringify(sketch.data));
    setHasUnsavedChanges(false);

    // Note: Modal is closed by SketchesList component

    // Navigate to sketch location using the same mechanism as location search
    // Use a longer delay to ensure polygons are fully loaded and won't interrupt the animation
    if (sketch.location) {
      console.log('Navigating to sketch location:', sketch.location);
      setTimeout(() => {
        console.log('Now triggering navigation after polygons loaded');
        if (sketch.location) {
          setSearchResult({
            id: `sketch-location-${sketch.id}`,
            place_name: sketch.name,
            center: sketch.location.center,
            place_type: ['place'],
            properties: {}
          });
        }
      }, 1000);
    }

    toast.success(`Sketch "${sketch.name}" loaded`);
  }, []);

  // Export handlers (no longer need separate menu state)
  const handleExportJSON = useCallback(() => {
    exportAsJSON(state, currentSketchName);
  }, [state, currentSketchName]);

  const handleExportCSV = useCallback(() => {
    exportAsCSV(state, currentSketchName);
  }, [state, currentSketchName]);

  const handleExportPNG = useCallback(async () => {
    try {
      await exportAsPNG(mapRef, currentSketchName, state.exportAreaBounds);
      if (state.exportAreaBounds) {
        toast.success('PNG exported with selected area');
      }
    } catch (error) {
      console.error('Failed to export PNG:', error);
      toast.error('Failed to export PNG');
    }
  }, [currentSketchName, state.exportAreaBounds]);

  const handleExportPDF = useCallback(async () => {
    try {
      await exportAsPDF(state, mapRef, currentSketchName, 'sketch', state.exportAreaBounds);
      if (state.exportAreaBounds) {
        toast.success('PDF exported with selected area');
      }
    } catch (error) {
      console.error('Failed to export PDF:', error);
      toast.error('Failed to export PDF');
    }
  }, [state, currentSketchName]);

  const handleSelectExportArea = useCallback(() => {
    console.log('handleSelectExportArea called');
    console.log('Map available:', !!mapRef.current?.getMap?.());
    setIsSelectingExportArea(true);
    toast.info('Draw a rectangle on the map to select export area');
  }, []);

  const handleExportAreaSelected = useCallback((bounds: ExportAreaBounds) => {
    setState(prev => ({ ...prev, exportAreaBounds: bounds }));
    setIsSelectingExportArea(false);
    toast.success('Export area selected');
  }, []);

  const handleExportAreaCancel = useCallback(() => {
    setIsSelectingExportArea(false);
    toast.info('Export area selection cancelled');
  }, []);

  // Unsaved changes dialog handlers
  const handleUnsavedDontSave = useCallback(() => {
    setShowUnsavedDialog(false);
    if (pendingAction) {
      pendingAction();
      setPendingAction(null);
    }
  }, [pendingAction]);

  const handleUnsavedCancel = useCallback(() => {
    setShowUnsavedDialog(false);
    setPendingAction(null);
  }, []);

  const handleUnsavedSave = useCallback(async () => {
    await handleSave();
    setShowUnsavedDialog(false);
    if (pendingAction) {
      pendingAction();
      setPendingAction(null);
    }
  }, [handleSave, pendingAction]);

  // Show loading while checking authentication and subscription tier
  if (loading || tierLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading SiteSketcher...</p>
        </div>
      </div>
    );
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
        {/* Premium Header */}
        <header className="relative z-40 px-8 py-4 border-b border-gray-200 bg-white/80 backdrop-blur-sm">
          {/* Subtle gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-r from-violet-50/30 via-transparent to-purple-50/30 pointer-events-none" />

          <div className="relative flex items-center justify-between gap-6">
            {/* Left: Premium Title Section */}
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => router.push('/')}
                className="h-8 w-8 rounded-lg hover:bg-violet-50 hover:text-violet-700 transition-all duration-200"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="flex items-center gap-2">
                <div className="h-8 w-1 bg-gradient-to-b from-violet-500 to-purple-600 rounded-full" />
                <h1 className="text-lg font-semibold text-gray-900 tracking-tight">
                  SiteSketcher
                </h1>
                {isFreeTier && (
                  <span className="ml-2 px-2.5 py-0.5 bg-violet-100 border-2 border-violet-300 rounded-full text-xs font-bold text-violet-700">
                    FREE
                  </span>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Site Link Banner */}
        {linkedSiteId && linkedSiteName && (
          <div className="bg-gradient-to-r from-blue-50 to-cyan-50 border-b-2 border-blue-200 px-8 py-3">
            <div className="flex items-center gap-3">
              <Building2 className="h-5 w-5 text-blue-600" />
              <div className="flex-1">
                <p className="text-sm font-bold text-blue-900">
                  Saving to site: <span className="text-blue-700">{linkedSiteName}</span>
                </p>
                <p className="text-xs text-blue-600">
                  This sketch will be automatically linked to the site when you save
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  const url = new URL(window.location.href);
                  url.searchParams.delete('site_id');
                  url.searchParams.delete('site_name');
                  window.history.replaceState({}, '', url.toString());
                  window.location.reload();
                }}
                className="text-blue-600 hover:text-blue-700 hover:bg-blue-100"
              >
                Remove Link
              </Button>
            </div>
          </div>
        )}

        {/* Document Bar */}
        <DocumentBar
          sketchName={currentSketchName}
          hasUnsavedChanges={hasUnsavedChanges}
          isSaving={isSaving}
          isFreeTier={isFreeTier}
          onRenameSketch={handleRenameSketch}
          onNewSketch={handleNewSketch}
          onOpenSketch={handleLoad}
          onSave={handleSave}
          onSaveAs={handleSaveAs}
          onCloseSketch={handleCloseSketch}
          onExportPNG={handleExportPNG}
          onExportJSON={handleExportJSON}
          onExportCSV={handleExportCSV}
          onExportPDF={handleExportPDF}
        />

        {/* Desktop Main Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Desktop Sidebar */}
          <div className="w-80 border-r bg-background flex flex-col">
            <div className="flex-1 overflow-y-auto desktop-sidebar-scroll p-4">
              <ResponsiveControls
                measurementUnit={state.measurementUnit}
                onUnitToggle={handleUnitToggle}
                onClearAll={handleClearAll}
                drawingMode={state.drawingMode}
                onModeToggle={handleModeToggle}
                viewMode={state.viewMode}
                onViewModeToggle={handleViewModeToggle}
                show3DBuildings={state.show3DBuildings}
                onToggle3DBuildings={handleToggle3DBuildings}
                isFreeTier={isFreeTier}
                onUpgradeClick={() => {
                  setUpgradeBannerType('polygon');
                  setShowUpgradeBanner(true);
                }}
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
                onPolygonHeightChange={handlePolygonHeightChange}
                onAddRectangle={handleAddRectangle}
                onStoreShapeSelect={handleStoreShapeSelect}
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
              rectangleToPlace={rectangleToPlace}
              onRectanglePlaced={() => setRectangleToPlace(null)}
              storeShapeToPlace={storeShapeToPlace}
              onStoreShapePlaced={handleStoreShapePlaced}
              viewMode={state.viewMode}
              show3DBuildings={state.show3DBuildings}
              cuboids={state.cuboids}
              selectedCuboidId={state.selectedCuboidId}
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
        <div className="fixed top-4 left-4 right-4 z-50 flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center justify-center w-10 h-10 bg-white/95 backdrop-blur-sm rounded-full shadow-lg border border-gray-200 hover:bg-gray-50 transition-colors"
            title="Back to SiteMatcher"
          >
            <ArrowLeft className="h-5 w-5 text-gray-700" />
          </Link>

          {/* Mobile File Menu Button */}
          <div className="flex items-center gap-2">
            {hasUnsavedChanges && (
              <div className="w-2 h-2 rounded-full bg-orange-500"></div>
            )}
            <button
              onClick={() => setShowMobileFileMenu(!showMobileFileMenu)}
              className="flex items-center justify-center w-10 h-10 bg-white/95 backdrop-blur-sm rounded-full shadow-lg border border-gray-200 hover:bg-gray-50 transition-colors"
              title="File Menu"
            >
              <Menu className="h-5 w-5 text-gray-700" />
            </button>
          </div>
        </div>

        {/* Mobile File Menu Dropdown */}
        {showMobileFileMenu && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-black/20 z-40"
              onClick={() => setShowMobileFileMenu(false)}
            />
            {/* Menu */}
            <div className="fixed top-16 right-4 z-50 bg-white/95 backdrop-blur-sm rounded-lg shadow-xl border border-gray-200 w-64 overflow-hidden">
              <div className="p-2">
                <div className="px-3 py-2 text-sm text-gray-500 font-medium border-b border-gray-200 mb-2">
                  {currentSketchName}
                  {hasUnsavedChanges && <span className="text-orange-500 ml-2">*</span>}
                  {isSaving && <span className="text-blue-500 ml-2">Saving...</span>}
                </div>

                <button
                  onClick={() => {
                    handleNewSketch();
                    setShowMobileFileMenu(false);
                  }}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 rounded transition-colors"
                >
                  New Sketch
                </button>

                <button
                  onClick={() => {
                    handleLoad();
                    setShowMobileFileMenu(false);
                  }}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 rounded transition-colors"
                >
                  Open Sketch
                </button>

                <button
                  onClick={() => {
                    handleSave();
                    setShowMobileFileMenu(false);
                  }}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 rounded transition-colors"
                  disabled={isSaving}
                >
                  Save
                </button>

                <button
                  onClick={() => {
                    handleSaveAs();
                    setShowMobileFileMenu(false);
                  }}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 rounded transition-colors"
                >
                  Save As...
                </button>
              </div>
            </div>
          </>
        )}

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
            rectangleToPlace={rectangleToPlace}
            onRectanglePlaced={() => setRectangleToPlace(null)}
            storeShapeToPlace={storeShapeToPlace}
            onStoreShapePlaced={handleStoreShapePlaced}
            viewMode={state.viewMode}
            show3DBuildings={state.show3DBuildings}
            cuboids={state.cuboids}
            selectedCuboidId={state.selectedCuboidId}
            className="w-full h-full"
          />
        </div>

        {/* Mobile Bottom Sheet - Always visible */}
        <div className="mobile-bottom-sheet-container">
          <ResponsiveControls
            measurementUnit={state.measurementUnit}
            onUnitToggle={handleUnitToggle}
            onClearAll={handleClearAll}
            drawingMode={state.drawingMode}
            onModeToggle={handleModeToggle}
            viewMode={state.viewMode}
            onViewModeToggle={handleViewModeToggle}
            show3DBuildings={state.show3DBuildings}
            onToggle3DBuildings={handleToggle3DBuildings}
            isFreeTier={isFreeTier}
            onUpgradeClick={() => {
              setUpgradeBannerType('polygon');
              setShowUpgradeBanner(true);
            }}
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
            onPolygonHeightChange={handlePolygonHeightChange}
            onAddRectangle={handleAddRectangle}
            onStoreShapeSelect={handleStoreShapeSelect}
          />
        </div>
      </div>

      {/* Save Sketch Modal */}
      <SaveSketchModal
        isOpen={showSaveModal}
        onClose={() => setShowSaveModal(false)}
        onSave={handleSaveSketch}
      />

      {/* Load Sketches Modal */}
      <SketchesList
        isOpen={showLoadModal}
        onClose={() => setShowLoadModal(false)}
        onLoadSketch={handleLoadSketch}
      />

      {/* Unsaved Changes Dialog */}
      <UnsavedChangesDialog
        isOpen={showUnsavedDialog}
        sketchName={currentSketchName}
        onDontSave={handleUnsavedDontSave}
        onCancel={handleUnsavedCancel}
        onSave={handleUnsavedSave}
      />

      {/* Welcome Onboarding Modal */}
      <WelcomeOnboarding
        isOpen={showWelcomeModal}
        onClose={handleWelcomeClose}
        userProfile={profile}
      />

      {/* Cuboid Story Selector Modal */}
      <CuboidStorySelector
        isOpen={showCuboidSelector}
        onClose={() => {
          setShowCuboidSelector(false);
          setPendingCuboidPolygon(null);
        }}
        onSelect={handleCuboidStorySelect}
      />

      {/* Upgrade Banner Modal */}
      {showUpgradeBanner && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setShowUpgradeBanner(false)}
        >
          <div className="max-w-2xl w-full" onClick={(e) => e.stopPropagation()}>
            <UpgradeBanner
              title={
                upgradeBannerType === 'polygon'
                  ? 'Unlock Unlimited Polygons'
                  : 'Unlock Unlimited Parking Blocks'
              }
              features={
                upgradeBannerType === 'polygon'
                  ? [
                      'Draw unlimited polygons',
                      'Draw unlimited parking blocks',
                      'Save sketches',
                      '3D visualization for all shapes',
                      'Access all requirement listings',
                      'Pro access to SiteAnalyser',
                    ]
                  : [
                      'Draw unlimited polygons',
                      'Draw unlimited parking blocks',
                      'Save sketches',
                      '3D visualization for all shapes',
                      'Access all requirement listings',
                      'Pro access to SiteAnalyser',
                    ]
              }
              context="sitesketcher"
              onDismiss={() => setShowUpgradeBanner(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default function SiteSketcherPage() {
  return (
    <>
      <Toaster position="top-center" richColors />
      <Suspense fallback={<div className="h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading SiteSketcher...</p>
        </div>
      </div>}>
        <SiteSketcherContent />
      </Suspense>
    </>
  );
}
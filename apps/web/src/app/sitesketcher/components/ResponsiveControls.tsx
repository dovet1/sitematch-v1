'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  ChevronUp, 
  ChevronDown,
  ChevronRight,
  Maximize2,
  Search,
  Trash2,
  Car,
  Plus,
  Pencil,
  MousePointer
} from 'lucide-react';
import type { AreaMeasurement, MeasurementUnit, MapboxDrawPolygon, ParkingOverlay, DrawingMode } from '@/types/sitesketcher';
import { LocationSearch } from './LocationSearch';
import { formatArea, calculatePolygonArea } from '@/lib/sitesketcher/measurement-utils';
import { MobileBottomSheet } from './MobileBottomSheet';
import { TouchOptimizedButton } from './TouchOptimizedButton';
import { cn } from '@/lib/utils';

interface ResponsiveControlsProps {
  measurement: AreaMeasurement | null;
  measurementUnit: MeasurementUnit;
  onUnitToggle: () => void;
  onClearAll: () => void;
  drawingMode: DrawingMode;
  onModeToggle: () => void;
  // Polygon props
  polygons: MapboxDrawPolygon[];
  onPolygonDelete: (polygonId: string) => void;
  // Parking props
  parkingOverlays: ParkingOverlay[];
  selectedOverlayId: string | null;
  onAddOverlay: (overlay: ParkingOverlay) => void;
  onUpdateOverlay: (overlay: ParkingOverlay) => void;
  onRemoveOverlay: (overlayId: string) => void;
  onSelectOverlay: (overlayId: string | null) => void;
  // Search props
  onLocationSelect: (location: any) => void;
  recentSearches: any[];
  onUpdateRecentSearches: (searches: any[]) => void;
  className?: string;
}

export function ResponsiveControls({
  measurement,
  measurementUnit,
  onUnitToggle,
  onClearAll,
  drawingMode,
  onModeToggle,
  polygons,
  onPolygonDelete,
  parkingOverlays,
  selectedOverlayId,
  onAddOverlay,
  onUpdateOverlay,
  onRemoveOverlay,
  onSelectOverlay,
  onLocationSelect,
  recentSearches,
  onUpdateRecentSearches,
  className = ''
}: ResponsiveControlsProps) {
  const [measurementsOpen, setMeasurementsOpen] = useState(false);
  const [parkingOpen, setParkingOpen] = useState(false);
  const [selectedPolygonId, setSelectedPolygonId] = useState<string | null>(null);
  const [showAddParking, setShowAddParking] = useState(false);
  const [mobileSheetOpen, setMobileSheetOpen] = useState(true); // Always open on mobile
  const [mobileSheetHeight, setMobileSheetHeight] = useState<'collapsed' | 'expanded'>('collapsed');

  // Reset selectedPolygonId if the selected polygon no longer exists
  useEffect(() => {
    if (selectedPolygonId) {
      const polygonExists = polygons.some(p => 
        String(p.id || p.properties?.id || '') === selectedPolygonId
      );
      if (!polygonExists) {
        setSelectedPolygonId(null);
      }
    }
  }, [polygons, selectedPolygonId]);

  const [isMobile, setIsMobile] = useState(false);
  
  // Check if mobile after mount to avoid hydration mismatch
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  if (isMobile) {
    return (
      <MobileBottomSheet
        isOpen={mobileSheetOpen}
        onToggle={() => setMobileSheetOpen(!mobileSheetOpen)}
        height={mobileSheetHeight}
        onHeightChange={setMobileSheetHeight}
        className={className}
      >
        <MobileContent />
      </MobileBottomSheet>
    );
  }

  function MobileContent() {
    return (
      <div className="space-y-4">
        <LocationSearch
          onLocationSelect={onLocationSelect}
          recentSearches={recentSearches}
          onUpdateRecentSearches={onUpdateRecentSearches}
          isMobile={true}
        />
        <DesktopSections />
      </div>
    );
  }

  function DesktopSections() {
    return (
      <div className="space-y-4">
        {/* Mode Toggle Button */}
        {isMobile ? (
          <TouchOptimizedButton
            variant="default"
            onClick={onModeToggle}
            className={cn(
              "w-full bottom-sheet-mode-toggle transition-all duration-200 border-0",
              drawingMode === 'draw' 
                ? "!bg-blue-600 hover:!bg-blue-700 !text-white !shadow-md" 
                : "!bg-green-600 hover:!bg-green-700 !text-white !shadow-md"
            )}
            minSize={52}
            visualFeedback="scale"
          >
            {drawingMode === 'draw' ? (
              <>
                <Pencil className="h-5 w-5 mr-2" />
                <span className="font-medium">Draw Mode</span>
              </>
            ) : (
              <>
                <MousePointer className="h-5 w-5 mr-2" />
                <span className="font-medium">Select Mode</span>
              </>
            )}
          </TouchOptimizedButton>
        ) : (
          <Button
            onClick={onModeToggle}
            className={cn(
              "w-full transition-all duration-200",
              drawingMode === 'draw' 
                ? "bg-blue-600 hover:bg-blue-700 text-white" 
                : "bg-green-600 hover:bg-green-700 text-white"
            )}
          >
            {drawingMode === 'draw' ? (
              <>
                <Pencil className="h-4 w-4 mr-2" />
                <span>Draw Mode</span>
              </>
            ) : (
              <>
                <MousePointer className="h-4 w-4 mr-2" />
                <span>Select Mode</span>
              </>
            )}
          </Button>
        )}

        {/* Measurements Section */}
        <Card>
          <Collapsible open={measurementsOpen} onOpenChange={setMeasurementsOpen}>
            <CollapsibleTrigger asChild>
              <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50">
                <div className="flex items-center gap-2">
                  <Maximize2 className="h-4 w-4" />
                  <span className="font-medium">Measurements</span>
                  {polygons.length > 0 && (
                    <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full">
                      {polygons.length}
                    </span>
                  )}
                </div>
                <ChevronRight className={`h-4 w-4 transition-transform ${measurementsOpen ? 'rotate-90' : ''}`} />
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="px-4 pb-4 space-y-2">
                {polygons.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Draw a polygon to see measurements
                  </p>
                ) : (
                  polygons.map((polygon, index) => {
                    // Calculate area for this specific polygon
                    const polygonMeasurement = calculatePolygonArea(polygon.geometry.coordinates[0]);
                    const currentPolygonId = String(polygon.id || polygon.properties?.id || '');
                    const isSelected = selectedPolygonId === currentPolygonId;
                    
                    return (
                      <div key={polygon.id || polygon.properties?.id || index} className="polygon-card border rounded-lg">
                        <div className="flex items-center justify-between">
                          <div 
                            className="flex-1 cursor-pointer p-3"
                            onClick={() => {
                              setSelectedPolygonId(
                                isSelected ? null : currentPolygonId
                              );
                            }}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-medium text-base">Polygon {index + 1}</span>
                              <div className="flex items-center gap-2">
                                <span className={cn(
                                  "text-muted-foreground",
                                  isMobile ? "measurement-text" : "text-sm"
                                )}>
                                  {formatArea(
                                    measurementUnit === 'metric' ? polygonMeasurement.squareMeters : polygonMeasurement.squareFeet, 
                                    measurementUnit
                                  )}
                                </span>
                              {isMobile ? (
                                <TouchOptimizedButton
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    // Try both ID sources - Mapbox Draw typically uses feature.id
                                    const polygonId = polygon.id || polygon.properties?.id;
                                    if (polygonId) {
                                      onPolygonDelete(String(polygonId));
                                    }
                                  }}
                                  className="text-destructive hover:text-destructive"
                                  minSize={44}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </TouchOptimizedButton>
                              ) : (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    // Try both ID sources - Mapbox Draw typically uses feature.id
                                    const polygonId = polygon.id || polygon.properties?.id;
                                    if (polygonId) {
                                      onPolygonDelete(String(polygonId));
                                    }
                                  }}
                                  className="text-destructive hover:text-destructive h-8 w-8 p-0"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                        
                        {isSelected && (
                          <div className="mt-3 pt-3 border-t space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-muted-foreground">Unit:</span>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={onUnitToggle}
                                className="h-6 text-xs"
                              >
                                {measurementUnit === 'metric' ? 'm²/m' : 'ft²/ft'}
                              </Button>
                            </div>
                            <div>
                              <p className="text-xs font-medium mb-1">Side Lengths:</p>
                              <div className="grid grid-cols-2 gap-1">
                                {polygonMeasurement.sideLengths.map((length, sideIndex) => (
                                  <div key={sideIndex} className="text-xs bg-muted rounded p-1 text-center">
                                    Side {sideIndex + 1}: {length}m
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>
        </Card>

        {/* Parking Section */}
        <Card>
          <Collapsible open={parkingOpen} onOpenChange={setParkingOpen}>
            <CollapsibleTrigger asChild>
              <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50">
                <div className="flex items-center gap-2">
                  <Car className="h-4 w-4" />
                  <span className="font-medium">Parking</span>
                  {parkingOverlays.length > 0 && (
                    <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full">
                      {parkingOverlays.length}
                    </span>
                  )}
                </div>
                <ChevronRight className={`h-4 w-4 transition-transform ${parkingOpen ? 'rotate-90' : ''}`} />
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="px-4 pb-4 space-y-2">
                {parkingOverlays.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-2">
                    No parking bays created
                  </p>
                ) : (
                  parkingOverlays.map((overlay, index) => (
                    <div key={overlay.id} className="flex items-center justify-between p-2 border rounded">
                      <div>
                        <span className="font-medium">Bay {index + 1}</span>
                        <span className="text-sm text-muted-foreground ml-2">
                          {/* Calculate spaces based on overlay type */}
                          {overlay.type === 'single' ? '1 space' : `${Math.floor(overlay.size.width * overlay.size.length / 12)} spaces`}
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onRemoveOverlay(overlay.id)}
                        className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))
                )}
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAddParking(!showAddParking)}
                  className="w-full"
                >
                  <Plus className="h-3 w-3 mr-2" />
                  Add Parking
                </Button>
                
                {showAddParking && (
                  <div className="mt-2 p-3 bg-muted rounded-lg">
                    <p className="text-xs text-muted-foreground">
                      Click inside a polygon to add parking bay
                    </p>
                  </div>
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>
        </Card>

        {/* Clear All Button */}
        {isMobile ? (
          <TouchOptimizedButton
            variant="outline"
            onClick={() => {
              if (confirm('Clear all drawings? This cannot be undone.')) {
                onClearAll();
              }
            }}
            className="w-full text-destructive hover:text-destructive"
            minSize={48}
            visualFeedback="color"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Clear All
          </TouchOptimizedButton>
        ) : (
          <Button
            variant="outline"
            onClick={() => {
              if (confirm('Clear all drawings? This cannot be undone.')) {
                onClearAll();
              }
            }}
            className="w-full text-destructive hover:text-destructive"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Clear All
          </Button>
        )}
      </div>
    );
  }

  // Desktop Layout
  return (
    <div className={`space-y-4 ${className}`}>
      {/* Search Bar */}
      <LocationSearch
        onLocationSelect={onLocationSelect}
        recentSearches={recentSearches}
        onUpdateRecentSearches={onUpdateRecentSearches}
      />

      <DesktopSections />
    </div>
  );
}
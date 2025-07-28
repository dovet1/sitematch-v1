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
import { ParkingOverlay as ParkingOverlayComponent } from './ParkingOverlay';
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
  // Side lengths toggle
  showSideLengths: boolean;
  onToggleSideLengths: () => void;
  // Parking props
  parkingOverlays: ParkingOverlay[];
  selectedOverlayId: string | null;
  onAddOverlay: (overlay: ParkingOverlay) => void;
  onUpdateOverlay: (overlay: ParkingOverlay) => void;
  onRemoveOverlay: (overlayId: string) => void;
  onSelectOverlay: (overlayId: string | null) => void;
  onClearAllParking: () => void;
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
  showSideLengths,
  onToggleSideLengths,
  parkingOverlays,
  selectedOverlayId,
  onAddOverlay,
  onUpdateOverlay,
  onRemoveOverlay,
  onSelectOverlay,
  onClearAllParking,
  onLocationSelect,
  recentSearches,
  onUpdateRecentSearches,
  className = ''
}: ResponsiveControlsProps) {
  const [measurementsOpen, setMeasurementsOpen] = useState(false);
  const [selectedPolygonId, setSelectedPolygonId] = useState<string | null>(null);
  const [mobileSheetOpen, setMobileSheetOpen] = useState(true); // Always open on mobile
  const [mobileSheetHeight, setMobileSheetHeight] = useState<'collapsed' | 'halfway' | 'expanded'>('collapsed');

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
              <div className={cn("px-4 pb-4", isMobile ? "space-y-2" : "space-y-3")}>
                {polygons.length === 0 ? (
                  <div className="text-center py-6 px-2">
                    <div className="mb-3">
                      <Maximize2 className="h-8 w-8 text-muted-foreground/60 mx-auto mb-2" />
                    </div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">
                      No measurements yet
                    </p>
                    <p className="text-xs text-muted-foreground/80 leading-relaxed">
                      Click and drag on the map to create your first polygon and see area calculations
                    </p>
                  </div>
                ) : (
                  polygons.map((polygon, index) => {
                    // Calculate area for this specific polygon
                    const polygonMeasurement = calculatePolygonArea(polygon.geometry.coordinates[0]);
                    const currentPolygonId = String(polygon.id || polygon.properties?.id || '');
                    const isSelected = selectedPolygonId === currentPolygonId;
                    
                    return (
                      <div key={polygon.id || polygon.properties?.id || index} className={cn(
                        "polygon-card group relative border bg-card transition-all duration-200",
                        // Mobile: simpler styling
                        isMobile 
                          ? cn(
                              "rounded-lg shadow-sm",
                              isSelected 
                                ? "ring-1 ring-primary/30 border-primary/40 bg-primary/5" 
                                : "border-border hover:bg-muted/30"
                            )
                          // Desktop: premium styling  
                          : cn(
                              "rounded-xl shadow-sm hover:shadow-md",
                              "before:absolute before:inset-0 before:rounded-xl before:bg-gradient-to-br before:from-transparent before:to-black/[0.02] before:pointer-events-none",
                              isSelected 
                                ? "ring-2 ring-primary/20 border-primary/30 bg-primary/5 shadow-md" 
                                : "border-border/60 hover:border-border hover:bg-muted/20",
                              // Add color-coordinated left border on desktop only
                              polygon.properties?.color && !isSelected && "border-l-4"
                            )
                      )}
                      style={!isMobile && polygon.properties?.color && !isSelected ? {
                        borderLeftColor: polygon.properties.color
                      } : {}}>
                        <div className="flex items-center justify-between">
                          <div 
                            className={cn(
                              "flex-1 cursor-pointer transition-colors",
                              isMobile ? "p-3" : "p-4"
                            )}
                            onClick={() => {
                              setSelectedPolygonId(
                                isSelected ? null : currentPolygonId
                              );
                            }}
                          >
                            {isMobile ? (
                              // Mobile: single row, compact
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  {polygon.properties?.color && (
                                    <div 
                                      className="w-4 h-4 rounded-full border-2 border-white shadow-sm"
                                      style={{ backgroundColor: polygon.properties.color }}
                                    />
                                  )}
                                  <div>
                                    <span className="font-semibold text-foreground text-base">
                                      Polygon {index + 1}
                                    </span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-3">
                                  <div className="text-right">
                                    <div className="font-bold tabular-nums text-foreground text-lg">
                                      {formatArea(
                                        measurementUnit === 'metric' ? polygonMeasurement.squareMeters : polygonMeasurement.squareFeet, 
                                        measurementUnit
                                      )}
                                    </div>
                                  </div>
                                  <TouchOptimizedButton
                                    variant="ghost"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const polygonId = polygon.id || polygon.properties?.id;
                                      if (polygonId) {
                                        onPolygonDelete(String(polygonId));
                                      }
                                    }}
                                    className="text-muted-foreground/60 hover:text-destructive"
                                    minSize={44}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </TouchOptimizedButton>
                                </div>
                              </div>
                            ) : (
                              // Desktop: two rows, premium styling
                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-4">
                                    {polygon.properties?.color && (
                                      <div className="relative">
                                        <div 
                                          className="w-5 h-5 rounded-full border-2 border-white shadow-md ring-1 ring-black/10"
                                          style={{ backgroundColor: polygon.properties.color }}
                                        />
                                        <div 
                                          className="absolute inset-0 w-5 h-5 rounded-full opacity-20 group-hover:opacity-30 transition-opacity"
                                          style={{ 
                                            backgroundColor: polygon.properties.color,
                                            boxShadow: `0 0 8px ${polygon.properties.color}40`
                                          }}
                                        />
                                      </div>
                                    )}
                                    <div>
                                      <span className="font-semibold text-foreground leading-tight text-sm">
                                        Polygon {index + 1}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center justify-between">
                                  <div className="relative bg-muted/40 rounded-lg px-3 py-2 border border-muted min-w-[120px]">
                                    <div className="font-bold tabular-nums text-foreground text-base">
                                      {formatArea(
                                        measurementUnit === 'metric' ? polygonMeasurement.squareMeters : polygonMeasurement.squareFeet, 
                                        measurementUnit
                                      )}
                                    </div>
                                    <div className="text-xs text-muted-foreground/60 font-medium">
                                      Total Area
                                    </div>
                                  </div>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const polygonId = polygon.id || polygon.properties?.id;
                                      if (polygonId) {
                                        onPolygonDelete(String(polygonId));
                                      }
                                    }}
                                    className="text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10 h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-all duration-200 rounded-lg"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                        
                        {isSelected && showSideLengths && (
                          <div className={cn(
                            "border-t border-muted/60 bg-muted/20 space-y-4 rounded-b-xl relative",
                            isMobile ? "mt-3 pt-4 px-3 pb-3" : "mt-4 pt-4 px-4 pb-4"
                          )}>
                            <div>
                              <p className="text-xs font-semibold mb-3 text-muted-foreground uppercase tracking-wide">Side Measurements</p>
                              <div className="grid grid-cols-2 gap-2">
                                {polygonMeasurement.sideLengths.map((length, sideIndex) => (
                                  <div key={sideIndex} className="bg-background/80 border border-muted/60 rounded-lg p-2 text-center shadow-sm">
                                    <div className="text-xs text-muted-foreground font-medium">Side {sideIndex + 1}</div>
                                    <div className="text-sm font-bold font-mono text-foreground">
                                      {measurementUnit === 'metric' ? `${length}m` : `${(length * 3.28084).toFixed(1)}ft`}
                                    </div>
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
        <ParkingOverlayComponent
          polygons={polygons}
          parkingOverlays={parkingOverlays}
          selectedOverlayId={selectedOverlayId}
          onAddOverlay={onAddOverlay}
          onUpdateOverlay={onUpdateOverlay}
          onRemoveOverlay={onRemoveOverlay}
          onSelectOverlay={onSelectOverlay}
          onClearAllParking={onClearAllParking}
          isMobile={isMobile}
        />

        {/* Settings Card */}
        <Card>
          <CardContent className="p-4 space-y-4">
            {/* Measurement Unit Toggle */}
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-sm">Measurement Unit</h3>
                <p className="text-xs text-muted-foreground">Choose between metric (m²/m) or imperial (ft²/ft)</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={onUnitToggle}
                className="h-8 text-xs font-medium bg-background hover:bg-muted border-muted"
              >
                {measurementUnit === 'metric' ? 'Metric' : 'Imperial'}
              </Button>
            </div>
            
            {/* Side Lengths Toggle */}
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-sm">Side Length Annotations</h3>
                <p className="text-xs text-muted-foreground">Show distance measurements on polygon sides</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={onToggleSideLengths}
                className={cn(
                  "h-8 text-xs font-medium transition-colors",
                  showSideLengths 
                    ? "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100" 
                    : "bg-background hover:bg-muted border-muted"
                )}
              >
                {showSideLengths ? 'ON' : 'OFF'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Clear All Button */}
        {isMobile ? (
          <TouchOptimizedButton
            variant="outline"
            onClick={onClearAll}
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
            onClick={onClearAll}
            className="w-full text-destructive hover:text-destructive"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Clear All
          </Button>
        )}
      </div>
    );
  }

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
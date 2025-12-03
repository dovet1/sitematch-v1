'use client';

import { useState, useEffect, memo, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  MousePointer,
  Settings,
  Square
} from 'lucide-react';
import { ModeToggleSwitch } from './ModeToggleSwitch';
import { ViewModeToggle } from './ViewModeToggle';
import type { AreaMeasurement, MeasurementUnit, MapboxDrawPolygon, ParkingOverlay, DrawingMode, ViewMode } from '@/types/sitesketcher';
import { LocationSearch } from './LocationSearch';
import { formatArea, calculatePolygonArea } from '@/lib/sitesketcher/measurement-utils';
import { MobileBottomSheet } from './MobileBottomSheet';
import { TouchOptimizedButton } from './TouchOptimizedButton';
import { ParkingOverlay as ParkingOverlayComponent } from './ParkingOverlay';
import { RectangleDimensionsModal } from './RectangleDimensionsModal';
import { cn } from '@/lib/utils';

// Memoized height input to prevent re-renders from parent polygon updates
const HeightInput = memo(function HeightInput({
  polygonId,
  initialHeight,
  onHeightChange
}: {
  polygonId: string;
  initialHeight: number;
  onHeightChange: (polygonId: string, height: number) => void;
}) {
  const [localValue, setLocalValue] = useState<string>(String(initialHeight));
  const inputRef = useRef<HTMLInputElement>(null);

  // Update local value when polygonId changes (different polygon selected)
  useEffect(() => {
    setLocalValue(String(initialHeight));
  }, [polygonId, initialHeight]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalValue(e.target.value);
  };

  const handleCommit = (value: string) => {
    const height = value === '' ? 0 : parseInt(value);
    const clampedHeight = Math.max(0, Math.min(500, height));
    onHeightChange(polygonId, clampedHeight);
    setLocalValue(String(clampedHeight));
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    handleCommit(e.target.value);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleCommit((e.target as HTMLInputElement).value);
      e.currentTarget.blur();
    }
  };

  return (
    <Input
      ref={inputRef}
      type="number"
      min="0"
      max="500"
      step="1"
      value={localValue}
      onChange={handleChange}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      className="flex-1 h-9"
    />
  );
});

interface ResponsiveControlsProps {
  measurementUnit: MeasurementUnit;
  onUnitToggle: () => void;
  onClearAll: () => void;
  drawingMode: DrawingMode;
  onModeToggle: () => void;
  // View mode props
  viewMode: ViewMode;
  onViewModeToggle: () => void;
  show3DBuildings: boolean;
  onToggle3DBuildings: () => void;
  // Free tier props
  isFreeTier?: boolean;
  onUpgradeClick?: () => void;
  // Polygon props
  polygons: MapboxDrawPolygon[];
  onPolygonDelete: (polygonId: string) => void;
  // Side lengths toggle
  showSideLengths: boolean;
  onToggleSideLengths: () => void;
  // Polygon-specific toggles
  onPolygonUnitToggle: (polygonId: string) => void;
  onPolygonSideLengthToggle: (polygonId: string) => void;
  onPolygonHeightChange?: (polygonId: string, height: number) => void;
  // Rectangle props
  onAddRectangle: (width: number, length: number) => void;
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
  // Save/Load/Export props
  onSave?: () => void;
  onLoad?: () => void;
  onExport?: () => void;
  className?: string;
}

export function ResponsiveControls({
  measurementUnit,
  onUnitToggle,
  onClearAll,
  drawingMode,
  onModeToggle,
  viewMode,
  onViewModeToggle,
  show3DBuildings,
  onToggle3DBuildings,
  isFreeTier = false,
  onUpgradeClick,
  polygons,
  onPolygonDelete,
  showSideLengths,
  onToggleSideLengths,
  onPolygonUnitToggle,
  onPolygonSideLengthToggle,
  onPolygonHeightChange,
  onAddRectangle,
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
  onSave,
  onLoad,
  onExport,
  className = ''
}: ResponsiveControlsProps) {
  const [measurementsOpen, setMeasurementsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [selectedPolygonId, setSelectedPolygonId] = useState<string | null>(null);
  const [mobileSheetOpen, setMobileSheetOpen] = useState(true); // Always open on mobile
  const [mobileSheetHeight, setMobileSheetHeight] = useState<'collapsed' | 'halfway' | 'expanded'>('collapsed');
  const [isRectangleModalOpen, setIsRectangleModalOpen] = useState(false);

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
        {/* Mode Toggle Switch */}
        <div className="flex justify-center overflow-visible">
          <ModeToggleSwitch
            mode={drawingMode}
            onToggle={onModeToggle}
            size={isMobile ? "large" : "default"}
            className="w-full max-w-xs"
          />
        </div>

        {/* Free Tier Usage Counter */}
        {isFreeTier && (
          <Card className="bg-violet-50 border-violet-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-bold text-violet-900">Usage Limits</span>
                <span className="text-xs font-semibold text-violet-600 bg-violet-100 px-2 py-1 rounded-full">
                  FREE TIER
                </span>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-700">Polygons:</span>
                  <span className={`text-sm font-bold ${polygons.length >= 2 ? 'text-orange-600' : 'text-violet-600'}`}>
                    {polygons.length}/2
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-700">Parking blocks:</span>
                  <span className={`text-sm font-bold ${parkingOverlays.length >= 2 ? 'text-orange-600' : 'text-violet-600'}`}>
                    {parkingOverlays.length}/2
                  </span>
                </div>
              </div>
              {(polygons.length >= 2 || parkingOverlays.length >= 2) && (
                <div className="mt-3 pt-3 border-t border-violet-200">
                  <button
                    onClick={onUpgradeClick}
                    className="text-xs text-violet-700 font-medium hover:text-violet-900 hover:underline transition-all cursor-pointer w-full text-left"
                  >
                    Upgrade for unlimited access →
                  </button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Add Rectangle Button - Only show in draw mode */}
        {drawingMode === 'draw' && (
          isMobile ? (
            <TouchOptimizedButton
              onClick={() => setIsRectangleModalOpen(true)}
              variant="outline"
              className="w-full flex items-center gap-2 justify-center hover:bg-primary hover:text-primary-foreground transition-colors"
              minSize={48}
            >
              <Square className="h-4 w-4" />
              Add Rectangle
            </TouchOptimizedButton>
          ) : (
            <Button
              onClick={() => setIsRectangleModalOpen(true)}
              variant="outline"
              className="w-full flex items-center gap-2 justify-center hover:bg-primary hover:text-primary-foreground transition-colors"
            >
              <Square className="h-4 w-4" />
              Add Rectangle
            </Button>
          )
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
                              <>
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
                                          (polygon.properties?.measurementUnit || measurementUnit) === 'metric' ? polygonMeasurement.squareMeters : polygonMeasurement.squareFeet, 
                                          polygon.properties?.measurementUnit || measurementUnit
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
                                <div className="border-t border-muted/60 mt-3 pt-3 pb-1">
                                  <div className="grid grid-cols-2 gap-2">
                                    <TouchOptimizedButton
                                      variant="outline"
                                      size="sm"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onPolygonUnitToggle(currentPolygonId);
                                      }}
                                      className="text-xs font-medium"
                                      minSize={44}
                                    >
                                      {(polygon.properties?.measurementUnit || measurementUnit) === 'metric' ? 'Metric' : 'Imperial'}
                                    </TouchOptimizedButton>
                                    <TouchOptimizedButton
                                      variant="outline"
                                      size="sm"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onPolygonSideLengthToggle(currentPolygonId);
                                      }}
                                      className={cn(
                                        "text-xs font-medium transition-colors",
                                        (() => {
                                          const hasIndividualSetting = polygon.properties && 'showSideLengths' in polygon.properties;
                                          const currentValue = hasIndividualSetting ? polygon.properties.showSideLengths : showSideLengths;
                                          return currentValue ? "bg-blue-50 text-blue-700 border-blue-200" : "";
                                        })()
                                      )}
                                      minSize={44}
                                    >
                                      Sides: {(() => {
                                        const hasIndividualSetting = polygon.properties && 'showSideLengths' in polygon.properties;
                                        return (hasIndividualSetting ? polygon.properties.showSideLengths : showSideLengths) ? 'ON' : 'OFF';
                                      })()}
                                    </TouchOptimizedButton>
                                  </div>
                                </div>
                              </>

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
                                <div className="space-y-3">
                                  <div className="flex items-center justify-between">
                                    <div className="relative bg-muted/40 rounded-lg px-3 py-2 border border-muted flex-1 mr-2">
                                      <div className="font-bold tabular-nums text-foreground text-base">
                                        {formatArea(
                                          (polygon.properties?.measurementUnit || measurementUnit) === 'metric' ? polygonMeasurement.squareMeters : polygonMeasurement.squareFeet, 
                                          polygon.properties?.measurementUnit || measurementUnit
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
                                      className="text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10 h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-all duration-200 rounded-lg flex-shrink-0"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                  <div className="grid grid-cols-2 gap-2">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onPolygonUnitToggle(currentPolygonId);
                                      }}
                                      className="h-7 text-xs font-medium bg-background hover:bg-muted border-muted"
                                    >
                                      {(polygon.properties?.measurementUnit || measurementUnit) === 'metric' ? 'Metric' : 'Imperial'}
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onPolygonSideLengthToggle(currentPolygonId);
                                      }}
                                      className={cn(
                                        "h-7 text-xs font-medium transition-colors",
                                        (() => {
                                          const hasIndividualSetting = polygon.properties && 'showSideLengths' in polygon.properties;
                                          const currentValue = hasIndividualSetting ? polygon.properties.showSideLengths : showSideLengths;
                                          return currentValue 
                                            ? "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100" 
                                            : "bg-background hover:bg-muted border-muted";
                                        })()
                                      )}
                                    >
                                      Sides: {(() => {
                                        const hasIndividualSetting = polygon.properties && 'showSideLengths' in polygon.properties;
                                        return (hasIndividualSetting ? polygon.properties.showSideLengths : showSideLengths) ? 'ON' : 'OFF';
                                      })()}
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Expandable indicator - positioned in top right */}
                            <div className={cn(
                              "absolute top-2 right-2 flex items-center gap-1.5 px-2 py-1 rounded-md",
                              "transition-all duration-200",
                              isSelected
                                ? "bg-primary/10 text-primary"
                                : "bg-muted/40 text-muted-foreground hover:bg-muted/60",
                              "group-hover:scale-105"
                            )}>
                              <span className={cn(
                                "text-xs font-medium hidden sm:inline",
                                isSelected ? "text-primary" : "text-muted-foreground"
                              )}>
                                {viewMode === '3D' && !isSelected ? 'Height' : isSelected ? 'Less' : 'More'}
                              </span>
                              <ChevronDown className={cn(
                                "h-4 w-4 transition-transform duration-300 ease-out",
                                isSelected && "rotate-180"
                              )} />
                            </div>
                          </div>
                        </div>

                        {isSelected && (
                          <div className={cn(
                            "border-t border-muted/60 bg-muted/20 space-y-4 rounded-b-xl relative",
                            isMobile ? "mt-3 pt-4 px-3 pb-3" : "mt-4 pt-4 px-4 pb-4"
                          )}>
                            {viewMode === '3D' ? (
                              // 3D Mode: Show height control
                              <div onClick={(e) => e.stopPropagation()}>
                                <p className="text-xs font-semibold mb-3 text-muted-foreground uppercase tracking-wide">Building Height</p>
                                <div className="space-y-2">
                                  <div className="flex items-center gap-2">
                                    {onPolygonHeightChange && (
                                      <HeightInput
                                        polygonId={currentPolygonId}
                                        initialHeight={polygon.properties?.height || 0}
                                        onHeightChange={onPolygonHeightChange}
                                      />
                                    )}
                                    <span className="text-sm text-muted-foreground whitespace-nowrap">meters</span>
                                  </div>
                                  <p className="text-xs text-muted-foreground">
                                    Set the extrusion height for this polygon
                                  </p>
                                </div>
                              </div>
                            ) : (
                              // 2D Mode: Show side measurements (only if enabled)
                              (() => {
                                const hasIndividualSetting = polygon.properties && 'showSideLengths' in polygon.properties;
                                const showSides = hasIndividualSetting ? polygon.properties.showSideLengths : showSideLengths;
                                return showSides ? (
                                  <div>
                                    <p className="text-xs font-semibold mb-3 text-muted-foreground uppercase tracking-wide">Side Measurements</p>
                                    <div className="grid grid-cols-2 gap-2">
                                      {polygonMeasurement.sideLengths.map((length, sideIndex) => (
                                        <div key={sideIndex} className="bg-background/80 border border-muted/60 rounded-lg p-2 text-center shadow-sm">
                                          <div className="text-xs text-muted-foreground font-medium">Side {sideIndex + 1}</div>
                                          <div className="text-sm font-bold font-mono text-foreground">
                                            {(polygon.properties?.measurementUnit || measurementUnit) === 'metric' ? `${length}m` : `${(length * 3.28084).toFixed(1)}ft`}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                ) : null;
                              })()
                            )}
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

        {/* Default Settings Card */}
        <Card>
          <Collapsible open={settingsOpen} onOpenChange={setSettingsOpen}>
            <CollapsibleTrigger asChild>
              <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50">
                <div className="flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  <span className="font-medium">Default Settings</span>
                </div>
                <ChevronRight className={`h-4 w-4 transition-transform ${settingsOpen ? 'rotate-90' : ''}`} />
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="px-4 pb-4 space-y-4">
                <p className="text-xs text-muted-foreground -mt-2">These settings apply to new polygons only</p>

                {/* View Mode Toggle */}
                <ViewModeToggle
                  viewMode={viewMode}
                  onToggle={onViewModeToggle}
                />

                {/* 3D Buildings Toggle - only show in 3D mode */}
                {viewMode === '3D' && (
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm">Show 3D Buildings</h3>
                      <p className="text-xs text-muted-foreground">Display existing buildings in 3D</p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={onToggle3DBuildings}
                      className={cn(
                        "h-8 text-xs font-medium transition-colors",
                        show3DBuildings
                          ? "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100"
                          : "bg-background hover:bg-muted border-muted"
                      )}
                    >
                      {show3DBuildings ? 'ON' : 'OFF'}
                    </Button>
                  </div>
                )}

                {/* Measurement Unit Toggle */}
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm">Measurement Unit</h3>
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
                    <h3 className="text-sm">Side Length Annotations</h3>
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
              </div>
            </CollapsibleContent>
          </Collapsible>
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
      <>
        <MobileBottomSheet
          isOpen={mobileSheetOpen}
          onToggle={() => setMobileSheetOpen(!mobileSheetOpen)}
          height={mobileSheetHeight}
          onHeightChange={setMobileSheetHeight}
          className={className}
        >
          <MobileContent />
        </MobileBottomSheet>

        {/* Rectangle Dimensions Modal */}
        <RectangleDimensionsModal
          isOpen={isRectangleModalOpen}
          onClose={() => setIsRectangleModalOpen(false)}
          onSubmit={(width, length) => {
            onAddRectangle(width, length);
            setIsRectangleModalOpen(false);
          }}
          measurementUnit={measurementUnit}
        />
      </>
    );
  }

  // Desktop Layout
  return (
    <>
      <div className={`space-y-4 ${className}`}>
        {/* Search Bar */}
        <LocationSearch
          onLocationSelect={onLocationSelect}
          recentSearches={recentSearches}
          onUpdateRecentSearches={onUpdateRecentSearches}
        />

        <DesktopSections />
      </div>

      {/* Rectangle Dimensions Modal */}
      <RectangleDimensionsModal
        isOpen={isRectangleModalOpen}
        onClose={() => setIsRectangleModalOpen(false)}
        onSubmit={(width, length) => {
          onAddRectangle(width, length);
          setIsRectangleModalOpen(false);
        }}
        measurementUnit={measurementUnit}
      />
    </>
  );
}
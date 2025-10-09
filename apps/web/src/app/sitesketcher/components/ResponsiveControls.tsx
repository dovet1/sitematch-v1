'use client';

import { useState, useEffect, useRef, memo, useCallback } from 'react';
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
  Square,
  Building2
} from 'lucide-react';
import { ModeToggleSwitch } from './ModeToggleSwitch';
import { ViewModeToggle } from './ViewModeToggle';
import type { MeasurementUnit, MapboxDrawPolygon, ParkingOverlay, DrawingMode, ViewMode } from '@/types/sitesketcher';
import { LocationSearch } from './LocationSearch';
import { formatArea, calculatePolygonArea } from '@/lib/sitesketcher/measurement-utils';
import { MobileBottomSheet } from './MobileBottomSheet';
import { TouchOptimizedButton } from './TouchOptimizedButton';
import { ParkingOverlay as ParkingOverlayComponent } from './ParkingOverlay';
import { RectangleDimensionsModal } from './RectangleDimensionsModal';
import { cn } from '@/lib/utils';

// Memoized rectangle inputs to prevent re-renders from parent
const RectangleInputs = memo(function RectangleInputs({
  measurementUnit,
  onSubmit
}: {
  measurementUnit: MeasurementUnit;
  onSubmit: (width: number, length: number) => void;
}) {
  const [rectangleWidth, setRectangleWidth] = useState<string>('10');
  const [rectangleLength, setRectangleLength] = useState<string>('20');
  const widthInputRef = useRef<HTMLInputElement>(null);
  const lengthInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = () => {
    const widthNum = parseFloat(rectangleWidth);
    const lengthNum = parseFloat(rectangleLength);

    if (isNaN(widthNum) || isNaN(lengthNum) || widthNum <= 0 || lengthNum <= 0) {
      alert('Please enter valid positive numbers for width and length');
      return;
    }

    onSubmit(widthNum, lengthNum);

    // Reset for next time
    setRectangleWidth('10');
    setRectangleLength('20');
  };

  return (
    <div key="rectangle-inputs-mobile" className="space-y-3 p-4 bg-muted/50 rounded-lg border border-border">
      <div className="text-sm font-medium text-foreground">
        Rectangle Dimensions ({measurementUnit === 'metric' ? 'metres' : 'feet'})
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label htmlFor="rectangle-width-mobile" className="text-xs text-muted-foreground">Width</label>
          <input
            ref={widthInputRef}
            id="rectangle-width-mobile"
            type="text"
            inputMode="decimal"
            value={rectangleWidth}
            onChange={(e) => {
              const value = e.target.value;
              if (value === '' || /^\d*\.?\d*$/.test(value)) {
                setRectangleWidth(value);
              }
            }}
            onBlur={(e) => {
              const num = parseFloat(e.target.value);
              if (isNaN(num) || num <= 0) {
                setRectangleWidth('10');
              }
            }}
            className="w-full px-3 py-2 text-base border border-input rounded-md bg-background"
            placeholder="Width"
            autoComplete="off"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="rectangle-length-mobile" className="text-xs text-muted-foreground">Length</label>
          <input
            ref={lengthInputRef}
            id="rectangle-length-mobile"
            type="text"
            inputMode="decimal"
            value={rectangleLength}
            onChange={(e) => {
              const value = e.target.value;
              if (value === '' || /^\d*\.?\d*$/.test(value)) {
                setRectangleLength(value);
              }
            }}
            onBlur={(e) => {
              const num = parseFloat(e.target.value);
              if (isNaN(num) || num <= 0) {
                setRectangleLength('20');
              }
            }}
            className="w-full px-3 py-2 text-base border border-input rounded-md bg-background"
            placeholder="Length"
            autoComplete="off"
          />
        </div>
      </div>

      <Button
        onClick={handleSubmit}
        className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
      >
        Place on Map
      </Button>
    </div>
  );
});

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
    const clampedHeight = Math.max(0, Math.min(100, height));
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
      max="100"
      step="1"
      value={localValue}
      onChange={handleChange}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      className="w-full"
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
  className = ''
}: ResponsiveControlsProps) {
  const [measurementsOpen, setMeasurementsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [selectedPolygonId, setSelectedPolygonId] = useState<string | null>(null);
  const [mobileSheetOpen, setMobileSheetOpen] = useState(true); // Always open on mobile
  const [mobileSheetHeight, setMobileSheetHeight] = useState<'collapsed' | 'halfway' | 'expanded'>('collapsed');
  const [isRectangleModalOpen, setIsRectangleModalOpen] = useState(false);
  const [showRectangleInputs, setShowRectangleInputs] = useState(false);

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

  const handleRectangleSubmit = (width: number, length: number) => {
    onAddRectangle(width, length);
    setShowRectangleInputs(false);
  };

  const handleRectangleButtonClick = () => {
    if (isMobile) {
      // On mobile, toggle inline inputs
      setShowRectangleInputs(!showRectangleInputs);
    } else {
      // On desktop, open modal
      setIsRectangleModalOpen(true);
    }
  };

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

        {/* View Mode Toggle - Desktop only */}
        {!isMobile && (
          <ViewModeToggle
            viewMode={viewMode}
            onToggle={onViewModeToggle}
          />
        )}

        {/* 3D Buildings Toggle - Only show when in 3D mode on desktop */}
        {!isMobile && viewMode === '3D' && (
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border border-border">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Show 3D Buildings</span>
            </div>
            <Button
              onClick={onToggle3DBuildings}
              variant={show3DBuildings ? 'default' : 'outline'}
              size="sm"
            >
              {show3DBuildings ? 'On' : 'Off'}
            </Button>
          </div>
        )}

        {/* Add Rectangle Button - Only show in draw mode */}
        {drawingMode === 'draw' && (
          <>
            <Button
              onClick={handleRectangleButtonClick}
              variant="outline"
              className="w-full flex items-center gap-2 justify-center hover:bg-primary hover:text-primary-foreground transition-colors"
            >
              <Square className="h-4 w-4" />
              {showRectangleInputs && isMobile ? 'Cancel Rectangle' : 'Add Rectangle'}
            </Button>

            {/* Inline Rectangle Inputs (Mobile Only) */}
            {showRectangleInputs && isMobile && (
              <RectangleInputs
                measurementUnit={measurementUnit}
                onSubmit={handleRectangleSubmit}
              />
            )}
          </>
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
                          </div>
                        </div>
                        
                        {isSelected && (
                          <div className={cn(
                            "border-t border-muted/60 bg-muted/20 space-y-4 rounded-b-xl relative",
                            isMobile ? "mt-3 pt-4 px-3 pb-3" : "mt-4 pt-4 px-4 pb-4"
                          )}>
                            {/* Height Control - Desktop only, 3D mode only */}
                            {!isMobile && viewMode === '3D' && onPolygonHeightChange && (
                              <div>
                                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-2">
                                  Building Height (meters)
                                </label>
                                <HeightInput
                                  polygonId={currentPolygonId}
                                  initialHeight={polygon.properties?.height ?? 3}
                                  onHeightChange={onPolygonHeightChange}
                                />
                              </div>
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

      {/* Rectangle Dimensions Modal */}
      <RectangleDimensionsModal
        isOpen={isRectangleModalOpen}
        onClose={() => setIsRectangleModalOpen(false)}
        onSubmit={onAddRectangle}
        measurementUnit={measurementUnit}
      />
    </div>
  );
}
'use client';

import { useState } from 'react';
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
  Plus
} from 'lucide-react';
import type { AreaMeasurement, MeasurementUnit, MapboxDrawPolygon, ParkingOverlay } from '@/types/sitesketcher';
import { LocationSearch } from './LocationSearch';
import { formatArea } from '@/lib/sitesketcher/measurement-utils';

interface ResponsiveControlsProps {
  measurement: AreaMeasurement | null;
  measurementUnit: MeasurementUnit;
  onUnitToggle: () => void;
  onClearAll: () => void;
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

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  if (isMobile) {
    return (
      <div className={`fixed bottom-0 left-0 right-0 z-50 ${className}`}>
        <div className="bg-background border-t shadow-2xl p-4 max-h-96 overflow-y-auto">
          <MobileContent />
        </div>
      </div>
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
                  polygons.map((polygon, index) => (
                    <div key={polygon.id || polygon.properties?.id || index} className="border rounded-lg p-3">
                      <div className="flex items-center justify-between">
                        <div 
                          className="flex-1 cursor-pointer"
                          onClick={() => {
                            const currentPolygonId = String(polygon.id || polygon.properties?.id || '');
                            setSelectedPolygonId(
                              selectedPolygonId === currentPolygonId ? null : currentPolygonId || null
                            );
                          }}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-medium">Polygon {index + 1}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-muted-foreground">
                                {measurement && formatArea(
                                  measurementUnit === 'metric' ? measurement.squareMeters : measurement.squareFeet, 
                                  measurementUnit
                                )}
                              </span>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  console.log('Delete button clicked, polygon:', polygon);
                                  console.log('polygon.id:', polygon.id);
                                  console.log('polygon.properties?.id:', polygon.properties?.id);
                                  
                                  // Try both ID sources - Mapbox Draw typically uses feature.id
                                  const polygonId = polygon.id || polygon.properties?.id;
                                  if (polygonId) {
                                    onPolygonDelete(String(polygonId));
                                  }
                                }}
                                className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      {selectedPolygonId === String(polygon.id || polygon.properties?.id || '') && measurement && (
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
                              {measurement.sideLengths.map((length, sideIndex) => (
                                <div key={sideIndex} className="text-xs bg-muted rounded p-1 text-center">
                                  Side {sideIndex + 1}: {length}m
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))
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

        {/* Clear All */}
        <Button
          variant="outline"
          onClick={onClearAll}
          className="w-full text-destructive hover:text-destructive"
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Clear All
        </Button>
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
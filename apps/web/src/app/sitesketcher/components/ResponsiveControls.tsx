'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { 
  ChevronUp, 
  ChevronDown,
  Maximize2,
  Search,
  Trash2
} from 'lucide-react';
import type { AreaMeasurement, MeasurementUnit } from '@/types/sitesketcher';
import { MeasurementDisplay } from './MeasurementDisplay';
import { ParkingOverlay } from './ParkingOverlay';
import { LocationSearch } from './LocationSearch';

interface ResponsiveControlsProps {
  measurement: AreaMeasurement | null;
  measurementUnit: MeasurementUnit;
  onUnitToggle: () => void;
  onClearAll: () => void;
  // Parking props
  polygons: any[];
  parkingOverlays: any[];
  selectedOverlayId: string | null;
  onAddOverlay: (overlay: any) => void;
  onUpdateOverlay: (overlay: any) => void;
  onRemoveOverlay: (overlayId: string) => void;
  onSelectOverlay: (overlayId: string | null) => void;
  // Search props
  onLocationSelect: (location: any) => void;
  recentSearches: any[];
  onUpdateRecentSearches: (searches: any[]) => void;
  className?: string;
}

type PanelType = 'measurements' | 'parking' | 'search';

export function ResponsiveControls({
  measurement,
  measurementUnit,
  onUnitToggle,
  onClearAll,
  polygons,
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
  const [activePanel, setActivePanel] = useState<PanelType>('measurements');
  const [isBottomSheetOpen, setIsBottomSheetOpen] = useState(false);

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  const panels = [
    { 
      id: 'measurements' as PanelType, 
      label: 'Measure', 
      icon: Maximize2,
      badge: measurement ? (measurementUnit === 'metric' ? 'm²' : 'ft²') : null
    },
    { 
      id: 'parking' as PanelType, 
      label: 'Parking', 
      icon: null,
      badge: parkingOverlays.length > 0 ? parkingOverlays.length.toString() : null
    },
    { 
      id: 'search' as PanelType, 
      label: 'Search', 
      icon: Search,
      badge: null
    }
  ];

  if (isMobile) {
    return (
      <div className={`fixed bottom-0 left-0 right-0 z-50 ${className}`}>
        {/* Bottom Sheet */}
        <div className="bg-background border-t shadow-2xl">
          {/* Panel Selector */}
          <div className="flex border-b">
            {panels.map((panel) => {
              const IconComponent = panel.icon;
              return (
                <Button
                  key={panel.id}
                  variant={activePanel === panel.id ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => {
                    setActivePanel(panel.id);
                    setIsBottomSheetOpen(true);
                  }}
                  className={`
                    flex-1 rounded-none h-12 flex flex-col items-center justify-center gap-1 relative
                    ${activePanel === panel.id ? 'bg-primary text-primary-foreground' : ''}
                  `}
                >
                  {IconComponent && <IconComponent className="h-4 w-4" />}
                  <span className="text-xs">{panel.label}</span>
                  {panel.badge && (
                    <div className="absolute -top-1 -right-1 text-xs h-5 min-w-5 rounded-full bg-red-500 text-white flex items-center justify-center px-1">
                      {panel.badge}
                    </div>
                  )}
                </Button>
              );
            })}
            
            {/* Expand/Collapse Button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsBottomSheetOpen(!isBottomSheetOpen)}
              className="w-12 h-12 rounded-none border-l"
            >
              {isBottomSheetOpen ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronUp className="h-4 w-4" />
              )}
            </Button>
          </div>

          {/* Panel Content */}
          {isBottomSheetOpen && (
            <div className="max-h-96 overflow-y-auto">
              <Card className="border-0 rounded-none">
                <CardContent className="p-4">
                  {activePanel === 'measurements' && (
                    <div className="space-y-4">
                      <MeasurementDisplay
                        measurement={measurement}
                        unit={measurementUnit}
                        onUnitToggle={onUnitToggle}
                        className="border-0"
                      />
                      <Button
                        variant="outline"
                        onClick={onClearAll}
                        className="w-full text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Clear All
                      </Button>
                    </div>
                  )}

                  {activePanel === 'parking' && (
                    <ParkingOverlay
                      polygons={polygons}
                      parkingOverlays={parkingOverlays}
                      selectedOverlayId={selectedOverlayId}
                      onAddOverlay={onAddOverlay}
                      onUpdateOverlay={onUpdateOverlay}
                      onRemoveOverlay={onRemoveOverlay}
                      onSelectOverlay={onSelectOverlay}
                      isMobile={true}
                      className="border-0"
                    />
                  )}

                  {activePanel === 'search' && (
                    <LocationSearch
                      onLocationSelect={onLocationSelect}
                      recentSearches={recentSearches}
                      onUpdateRecentSearches={onUpdateRecentSearches}
                      isMobile={true}
                      className="border-0"
                    />
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </div>
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

      {/* Measurements */}
      <MeasurementDisplay
        measurement={measurement}
        unit={measurementUnit}
        onUnitToggle={onUnitToggle}
      />

      {/* Parking Controls */}
      <ParkingOverlay
        polygons={polygons}
        parkingOverlays={parkingOverlays}
        selectedOverlayId={selectedOverlayId}
        onAddOverlay={onAddOverlay}
        onUpdateOverlay={onUpdateOverlay}
        onRemoveOverlay={onRemoveOverlay}
        onSelectOverlay={onSelectOverlay}
      />

      {/* Clear All */}
      <Card>
        <CardContent className="p-3">
          <Button
            variant="outline"
            onClick={onClearAll}
            className="w-full text-destructive hover:text-destructive"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Clear All Drawings
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
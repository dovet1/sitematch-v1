'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  Car, 
  Plus, 
  Minus, 
  Trash2,
  Settings2,
  ChevronRight
} from 'lucide-react';
import type { ParkingOverlay, ParkingConfiguration, MapboxDrawPolygon } from '@/types/sitesketcher';
import { PARKING_SIZES, PARKING_COLORS } from '@/types/sitesketcher';

interface ParkingOverlayProps {
  polygons: MapboxDrawPolygon[];
  parkingOverlays: ParkingOverlay[];
  selectedOverlayId: string | null;
  onAddOverlay: (overlay: ParkingOverlay) => void;
  onUpdateOverlay: (overlay: ParkingOverlay) => void;
  onRemoveOverlay: (overlayId: string) => void;
  onSelectOverlay: (overlayId: string | null) => void;
  onClearAllParking?: () => void;
  className?: string;
  isMobile?: boolean;
}

export function ParkingOverlay({
  polygons,
  parkingOverlays,
  selectedOverlayId,
  onAddOverlay,
  onUpdateOverlay,
  onRemoveOverlay,
  onSelectOverlay,
  onClearAllParking,
  className = '',
  isMobile = false
}: ParkingOverlayProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [config, setConfig] = useState<ParkingConfiguration>({
    type: 'single',
    size: 'standard',
    dimensions: PARKING_SIZES.standard,
    quantity: 10
  });
  
  const selectedOverlay = parkingOverlays.find(o => o.id === selectedOverlayId);
  const hasPolygons = polygons.length > 0;

  // Update dimensions when size changes
  useEffect(() => {
    setConfig(prev => ({
      ...prev,
      dimensions: PARKING_SIZES[prev.size]
    }));
  }, [config.size]);

  const handleAddParking = () => {
    if (!hasPolygons) return;
    
    console.log('Add Parking button clicked with config:', config);
    const polygon = polygons[0]; // Use first polygon for now
    const coordinates = polygon.geometry.coordinates[0];
    
    // Calculate polygon center
    const centerLng = coordinates.reduce((sum, coord) => sum + coord[0], 0) / coordinates.length;
    const centerLat = coordinates.reduce((sum, coord) => sum + coord[1], 0) / coordinates.length;
    
    const newOverlay: ParkingOverlay = {
      id: `parking-${Date.now()}`,
      position: [centerLng, centerLat],
      rotation: 0,
      type: config.type,
      size: config.dimensions,
      quantity: config.quantity
    };
    
    console.log('Created parking overlay:', newOverlay);
    onAddOverlay(newOverlay);
  };


  const handleQuantityChange = (delta: number) => {
    setConfig(prev => ({
      ...prev,
      quantity: Math.max(1, Math.min(100, prev.quantity + delta))
    }));
  };

  return (
    <Card className={className}>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50">
            <div className="flex items-center gap-2">
              <Car className="h-4 w-4" />
              <span className="font-medium">Parking Overlays</span>
              {parkingOverlays.length > 0 && (
                <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full">
                  {parkingOverlays.length}
                </span>
              )}
            </div>
            <ChevronRight className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-4 pb-4 space-y-4">
        {/* Show message only if no polygons AND no existing parking overlays */}
        {!hasPolygons && parkingOverlays.length === 0 && (
          <div className="text-center py-6 px-2">
            <div className="mb-3">
              <Car className="h-8 w-8 text-muted-foreground/60 mx-auto mb-2" />
            </div>
            <p className="text-sm font-medium text-muted-foreground mb-1">
              No parking overlays yet
            </p>
            <p className="text-xs text-muted-foreground/80 leading-relaxed">
              Draw a polygon first to add parking overlays
            </p>
          </div>
        )}

        {/* Show parking configuration only if there are polygons to add parking to */}
        {hasPolygons && (
          <>
            {/* Parking Configuration */}
            <div className="space-y-3">
              
              {/* Quantity Control */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">
                  Number of Spaces
                </Label>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleQuantityChange(-1)}
                    disabled={config.quantity <= 1}
                    className="h-8 w-8 p-0 flex-shrink-0"
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </Button>
                  <Input
                    type="number"
                    min="1"
                    max="100"
                    value={config.quantity}
                    onChange={(e) => setConfig(prev => ({ 
                      ...prev, 
                      quantity: Math.max(1, Math.min(100, parseInt(e.target.value) || 1))
                    }))}
                    className="h-8 flex-1 text-center"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleQuantityChange(1)}
                    disabled={config.quantity >= 100}
                    className="h-8 w-8 p-0 flex-shrink-0"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              {/* Type Selection */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">
                  Layout Type
                </Label>
                <RadioGroup
                  value={config.type}
                  onValueChange={(value: 'single' | 'double') => 
                    setConfig(prev => ({ ...prev, type: value }))
                  }
                  className="grid grid-cols-2 gap-3"
                >
                  <label 
                    className={`flex flex-col items-center gap-2 p-3 border rounded-lg cursor-pointer transition-all hover:bg-muted/50 ${
                      config.type === 'single' ? 'border-primary bg-primary/5' : ''
                    }`}
                  >
                    <RadioGroupItem value="single" id="single" className="sr-only" />
                    <div className="flex gap-0.5">
                      <div className="w-6 h-2 bg-gray-400 rounded-sm" />
                    </div>
                    <span className="text-sm font-medium">Single Layer</span>
                  </label>
                  <label 
                    className={`flex flex-col items-center gap-2 p-3 border rounded-lg cursor-pointer transition-all hover:bg-muted/50 ${
                      config.type === 'double' ? 'border-primary bg-primary/5' : ''
                    }`}
                  >
                    <RadioGroupItem value="double" id="double" className="sr-only" />
                    <div className="flex gap-0.5">
                      <div className="w-6 h-2 bg-gray-400 rounded-sm" />
                      <div className="w-6 h-2 bg-gray-400 rounded-sm" />
                    </div>
                    <span className="text-sm font-medium">Double Layer</span>
                  </label>
                </RadioGroup>
              </div>

              {/* Size Selection */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">
                  Space Dimensions
                </Label>
                <Select
                  value={config.size}
                  onValueChange={(value: 'standard' | 'compact') =>
                    setConfig(prev => ({ ...prev, size: value }))
                  }
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="standard" className="py-3">
                      <div className="flex items-center justify-between w-full">
                        <span className="font-medium">Standard</span>
                        <span className="text-sm text-muted-foreground ml-3">2.7m × 5.0m</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="compact" className="py-3">
                      <div className="flex items-center justify-between w-full">
                        <span className="font-medium">Compact</span>
                        <span className="text-sm text-muted-foreground ml-3">2.4m × 4.8m</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Action Buttons */}
            <Button
              onClick={handleAddParking}
              className="w-full"
              size={isMobile ? 'lg' : 'default'}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Parking Overlay
            </Button>
          </>
        )}

        {/* Show helpful message when parking exists but no polygons for adding new ones */}
        {!hasPolygons && parkingOverlays.length > 0 && (
          <div className="text-center text-muted-foreground p-3 border border-dashed rounded-lg">
            <Car className="h-6 w-6 mx-auto mb-1 opacity-50" />
            <p className="text-xs">Draw a polygon to add more parking overlays</p>
          </div>
        )}

        {/* Always show existing overlays if they exist */}
        {parkingOverlays.length > 0 && (
          <div className="space-y-2">
            <div className="max-h-32 overflow-y-auto space-y-1">
              {parkingOverlays.map((overlay) => (
                <div
                  key={overlay.id}
                  className={`
                    flex items-center justify-between p-2 rounded border
                    ${selectedOverlayId === overlay.id 
                      ? 'border-primary bg-primary/5' 
                      : 'border-border hover:bg-muted/50'}
                    cursor-pointer transition-colors
                  `}
                  onClick={() => onSelectOverlay(
                    selectedOverlayId === overlay.id ? null : overlay.id
                  )}
                >
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-sm"
                      style={{ 
                        backgroundColor: PARKING_COLORS[overlay.type],
                        opacity: 0.8 
                      }}
                    />
                    <span className="text-sm">
                      {overlay.type.charAt(0).toUpperCase() + overlay.type.slice(1)} ({overlay.quantity})
                    </span>
                  </div>
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveOverlay(overlay.id);
                    }}
                    className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
            {onClearAllParking && parkingOverlays.length > 1 && (
              <Button
                variant="outline"
                size="sm"
                onClick={onClearAllParking}
                className="w-full text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Clear All
              </Button>
            )}

            {/* Selected Overlay Details */}
            {selectedOverlay && (
              <div className="space-y-2 border-t pt-3">
                <Label className="text-sm font-medium">Selected Overlay</Label>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Type:</span>
                    <span className="ml-1 capitalize">{selectedOverlay.type}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Rotation:</span>
                    <span className="ml-1">{Math.round(selectedOverlay.rotation)}°</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Size:</span>
                    <span className="ml-1">
                      {selectedOverlay.size.width}m × {selectedOverlay.size.length}m
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Spaces:</span>
                    <span className="ml-1">{selectedOverlay.quantity}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
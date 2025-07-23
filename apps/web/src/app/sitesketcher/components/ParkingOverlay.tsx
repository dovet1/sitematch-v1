'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Car, 
  Plus, 
  Minus, 
  Trash2,
  Settings2
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
    <Card className={`${className}`}>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Car className="h-5 w-5" />
          Parking Overlays
          {parkingOverlays.length > 0 && (
            <span className="ml-auto text-sm font-normal text-muted-foreground">
              ({parkingOverlays.length})
            </span>
          )}
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Show message only if no polygons AND no existing parking overlays */}
        {!hasPolygons && parkingOverlays.length === 0 && (
          <div className="text-center text-muted-foreground p-4 border border-dashed rounded-lg">
            <Car className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Draw a polygon first to add parking overlays</p>
          </div>
        )}

        {/* Show parking configuration only if there are polygons to add parking to */}
        {hasPolygons && (
          <>
            {/* Parking Configuration */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Parking Configuration</Label>
              
              {/* Quantity Control */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">
                  Number of Spaces
                </Label>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleQuantityChange(-1)}
                    disabled={config.quantity <= 1}
                    className="h-8 w-8 p-0"
                  >
                    <Minus className="h-3 w-3" />
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
                    className="h-8 text-center flex-1"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleQuantityChange(1)}
                    disabled={config.quantity >= 100}
                    className="h-8 w-8 p-0"
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
              </div>

              {/* Type Selection */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Type</Label>
                <RadioGroup
                  value={config.type}
                  onValueChange={(value: 'single' | 'double') => 
                    setConfig(prev => ({ ...prev, type: value }))
                  }
                  className="flex space-x-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="single" id="single" />
                    <Label htmlFor="single" className="text-sm">Single Layer</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="double" id="double" />
                    <Label htmlFor="double" className="text-sm">Double Layer</Label>
                  </div>
                </RadioGroup>
              </div>

              {/* Size Selection */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Size</Label>
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
                    <SelectItem value="standard">
                      Standard (2.7m × 5.0m)
                    </SelectItem>
                    <SelectItem value="compact">
                      Compact (2.4m × 4.8m)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
              <Button
                onClick={handleAddParking}
                className="flex-1"
                size={isMobile ? 'lg' : 'default'}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Parking
              </Button>
            </div>
          </>
        )}

        {/* Show helpful message when parking exists but no polygons for adding new ones */}
        {!hasPolygons && parkingOverlays.length > 0 && (
          <div className="text-center text-muted-foreground p-3 border border-dashed rounded-lg bg-blue-50/50">
            <Car className="h-6 w-6 mx-auto mb-1 opacity-70" />
            <p className="text-xs">Draw a polygon to add more parking overlays</p>
          </div>
        )}

        {/* Always show existing overlays if they exist */}
        {parkingOverlays.length > 0 && (
          <div className="space-y-2">
            <Label className="text-sm font-medium">Manage Overlays</Label>
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
                      {overlay.type.charAt(0).toUpperCase() + overlay.type.slice(1)}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-1">
                    {/* Delete */}
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
                </div>
              ))}
            </div>
            {onClearAllParking && (
              <Button
                variant="outline"
                size="sm"
                onClick={onClearAllParking}
                className="w-full text-destructive border-destructive/20 hover:bg-destructive/10 hover:text-destructive mt-2"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Clear All Parking
              </Button>
            )}

            {/* Selected Overlay Details (Phase 2) */}
            {selectedOverlay && (
              <div className="space-y-2 border-t pt-3">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <Settings2 className="h-4 w-4" />
                  Selected Overlay Details
                </Label>
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
      </CardContent>
    </Card>
  );
}
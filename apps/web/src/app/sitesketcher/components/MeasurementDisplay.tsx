'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Maximize2 } from 'lucide-react';
import type { AreaMeasurement, MeasurementUnit } from '@/types/sitesketcher';
import { formatArea, formatDistance } from '@/lib/sitesketcher/measurement-utils';

interface MeasurementDisplayProps {
  measurement: AreaMeasurement | null;
  unit: MeasurementUnit;
  onUnitToggle: () => void;
  className?: string;
}

export function MeasurementDisplay({
  measurement,
  unit,
  onUnitToggle,
  className = ''
}: MeasurementDisplayProps) {
  if (!measurement) {
    return (
      <Card className={`${className}`}>
        <CardContent className="p-4">
          <div className="text-center text-muted-foreground">
            <Maximize2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Draw a polygon to see measurements</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const area = unit === 'metric' ? measurement.squareMeters : measurement.squareFeet;

  return (
    <Card className={`${className}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Maximize2 className="h-5 w-5" />
            Measurements
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={onUnitToggle}
            className="text-xs"
          >
            {unit === 'metric' ? 'm²' : 'ft²'}
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="pt-0">
        {/* Polygon Area */}
        <div className="text-center mb-4">
          <div className="text-3xl font-bold text-primary mb-1">
            {formatArea(area, unit)}
          </div>
          <div className="text-sm text-muted-foreground">
            Internal Polygon Area
          </div>
        </div>

        {/* Side Lengths */}
        {measurement.sideLengths.length > 0 && (
          <div className="space-y-2">
            <div className="text-sm font-medium text-muted-foreground">
              Side Lengths:
            </div>
            <div className="grid grid-cols-2 gap-2">
              {measurement.sideLengths.map((length, index) => (
                <div
                  key={index}
                  className="text-sm bg-muted rounded p-2 text-center"
                >
                  <span className="text-xs text-muted-foreground">
                    Side {index + 1}:
                  </span>
                  <div className="font-medium">
                    {formatDistance(length, unit)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
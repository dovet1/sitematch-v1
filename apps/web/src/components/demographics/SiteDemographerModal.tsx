'use client';

import { Dialog, DialogContent } from '@/components/ui/dialog';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LocationInputPanel, type MeasurementMode } from './LocationInputPanel';
import { DemographicsResults } from './DemographicsResults';
import { DemographicsMap } from './DemographicsMap';
import { useState } from 'react';
import type { LocationResult } from '@/lib/mapbox';
import type { DemographicsResult } from '@/lib/types/demographics';

interface SiteDemographerModalProps {
  open: boolean;
  onClose: () => void;
}

export function SiteDemographerModal({ open, onClose }: SiteDemographerModalProps) {
  const [selectedLocation, setSelectedLocation] = useState<LocationResult | null>(null);
  const [measurementMode, setMeasurementMode] = useState<MeasurementMode>('distance');
  const [measurementValue, setMeasurementValue] = useState<number>(10);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<DemographicsResult | null>(null);
  const [lsoaBoundaries, setLsoaBoundaries] = useState<GeoJSON.FeatureCollection | null>(null);

  // Convert measurement to radius in miles (same as SiteDemographerPage)
  const convertToRadiusMiles = (mode: MeasurementMode, value: number): number => {
    const WALK_SPEED_MPH = 3;
    const DRIVE_SPEED_MPH = 35;

    switch (mode) {
      case 'distance':
        return value;
      case 'walk_time':
        return (value / 60) * WALK_SPEED_MPH;
      case 'drive_time':
        return (value / 60) * DRIVE_SPEED_MPH;
    }
  };

  const handleAnalyze = async () => {
    if (!selectedLocation) return;

    setLoading(true);
    setError(null);

    try {
      const [lng, lat] = selectedLocation.center;

      // For time-based modes, pass minutes directly; for distance mode, pass miles
      const radiusMiles = measurementMode === 'distance'
        ? measurementValue
        : measurementValue;

      // Fetch all data in parallel
      const [geoResponse, boundariesResponse] = await Promise.all([
        // Step 1: Get geography codes
        fetch('/api/demographics/geography', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lat, lng, radius_miles: radiusMiles, measurement_mode: measurementMode }),
        }),
        // Step 2: Get LSOA boundaries for map
        fetch('/api/demographics/boundaries', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lat, lng, radius_miles: radiusMiles, measurement_mode: measurementMode }),
        }),
      ]);

      if (!geoResponse.ok) {
        throw new Error('Failed to resolve geographic areas');
      }

      const geoData = await geoResponse.json();
      const boundaries = await boundariesResponse.json();

      // Step 3: Get demographics data
      const dataResponse = await fetch('/api/demographics/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          geography_codes: geoData.geography_codes,
        }),
      });

      if (!dataResponse.ok) {
        throw new Error('Failed to fetch demographics data');
      }

      const demographicsData = await dataResponse.json();
      setResults(demographicsData);
      setLsoaBoundaries(boundaries);
    } catch (err) {
      console.error('Error analyzing demographics:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  // Handle mode change with appropriate defaults
  const handleMeasurementModeChange = (mode: MeasurementMode) => {
    setMeasurementMode(mode);
    if (mode === 'walk_time') {
      setMeasurementValue(20); // 20 min = 1 mile
    } else if (mode === 'drive_time') {
      setMeasurementValue(10); // 10 min = ~6 miles
    } else {
      setMeasurementValue(10); // 10 miles
    }
  };

  const handleReset = () => {
    setSelectedLocation(null);
    setMeasurementMode('distance');
    setMeasurementValue(10);
    setResults(null);
    setLsoaBoundaries(null);
    setError(null);
  };

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[95vw] w-full h-[90vh] p-0 gap-0">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">SiteDemographer</h2>
            <p className="text-sm text-gray-500 mt-1">
              Analyze demographics for any UK location
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8 rounded-full"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Main Content */}
        <div className="flex flex-col lg:flex-row h-[calc(90vh-73px)] overflow-hidden">
          {/* Left Panel - Input Controls */}
          <div className="w-full lg:w-96 border-r border-gray-200 p-6 overflow-y-auto">
            <LocationInputPanel
              selectedLocation={selectedLocation}
              onLocationChange={setSelectedLocation}
              measurementMode={measurementMode}
              onMeasurementModeChange={handleMeasurementModeChange}
              measurementValue={measurementValue}
              onMeasurementValueChange={setMeasurementValue}
              onAnalyze={handleAnalyze}
              onReset={handleReset}
              loading={loading}
              hasResults={!!results}
            />
          </div>

          {/* Center Panel - Map */}
          <div className="flex-1 min-h-[400px] bg-gray-100">
            {selectedLocation ? (
              <DemographicsMap
                center={{ lat: selectedLocation.center[1], lng: selectedLocation.center[0] }}
                radiusMiles={convertToRadiusMiles(measurementMode, measurementValue)}
                isochroneGeometry={null}
                loading={loading}
                measurementMode={measurementMode}
                measurementValue={measurementValue}
                selectedLsoaCodes={new Set()}
                allLsoaCodes={[]}
                onLsoaToggle={() => {}}
                lsoaTooltipData={{}}
              />
            ) : (
              <div className="h-full flex items-center justify-center text-gray-400">
                <div className="text-center">
                  <p className="text-lg font-medium mb-2">No location selected</p>
                  <p className="text-sm">Search for a location to see the map</p>
                </div>
              </div>
            )}
          </div>

          {/* Right Panel - Results */}
          <div className="w-full lg:w-96 border-l border-gray-200 p-6 overflow-y-auto bg-gray-50">
            <DemographicsResults
              loading={loading}
              error={error}
              location={selectedLocation}
              measurementMode={measurementMode}
              measurementValue={measurementValue}
              totalLsoaCount={0}
              rawData={null}
              selectedLsoaCodes={new Set()}
              nationalAverages={{}}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

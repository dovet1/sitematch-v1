'use client';

import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LocationInputPanel, type MeasurementMode } from './LocationInputPanel';
import { DemographicsResults } from './DemographicsResults';
import { DemographicsMap } from './DemographicsMap';
import { useState, useMemo, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import type { LocationResult } from '@/lib/mapbox';
import type { LSOATooltipData } from '@/lib/supabase-census-data';

// Conversion constants
const WALK_SPEED_MPH = 3;
const DRIVE_SPEED_MPH = 35;

// Convert measurement to radius in miles
function convertToRadiusMiles(mode: MeasurementMode, value: number): number {
  switch (mode) {
    case 'distance':
      return value;
    case 'walk_time':
      return (value / 60) * WALK_SPEED_MPH; // minutes to hours * speed
    case 'drive_time':
      return (value / 60) * DRIVE_SPEED_MPH;
  }
}

export function SiteDemographerPage() {
  const router = useRouter();
  const [selectedLocation, setSelectedLocation] = useState<LocationResult | null>(null);
  const [measurementMode, setMeasurementMode] = useState<MeasurementMode>('distance');
  const [measurementValue, setMeasurementValue] = useState<number>(10);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rawDemographicsData, setRawDemographicsData] = useState<Record<string, any> | null>(null);
  const [lsoaBoundaries, setLsoaBoundaries] = useState<GeoJSON.FeatureCollection | null>(null);
  const [isochroneGeometry, setIsochroneGeometry] = useState<any>(null);
  const [selectedLsoaCodes, setSelectedLsoaCodes] = useState<Set<string>>(new Set());
  const [allLsoaCodes, setAllLsoaCodes] = useState<string[]>([]);
  const [isRefetchingData, setIsRefetchingData] = useState(false);
  const initialLoadComplete = useRef(false);
  const [lsoaTooltipData, setLsoaTooltipData] = useState<Record<string, LSOATooltipData>>({});

  // Re-fetch aggregated data when selection changes
  useEffect(() => {
    // Skip if no initial data loaded yet
    if (!initialLoadComplete.current || selectedLsoaCodes.size === 0) return;

    const fetchAggregatedData = async () => {
      setIsRefetchingData(true);
      try {
        const codes = Array.from(selectedLsoaCodes);
        const dataResponse = await fetch('/api/demographics/data', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            geography_codes: codes,
          }),
        });

        if (!dataResponse.ok) {
          throw new Error('Failed to fetch demographics data');
        }

        const demographicsData = await dataResponse.json();
        setRawDemographicsData(demographicsData.by_lsoa);
      } catch (err) {
        console.error('Error refetching demographics:', err);
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setIsRefetchingData(false);
      }
    };

    // Debounce to avoid too many API calls
    const timeoutId = setTimeout(fetchAggregatedData, 300);
    return () => clearTimeout(timeoutId);
  }, [selectedLsoaCodes]);

  // Handle LSOA toggle
  const handleLsoaToggle = (code: string) => {
    setSelectedLsoaCodes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(code)) {
        // Don't allow deselecting all LSOAs
        if (newSet.size > 1) {
          newSet.delete(code);
        }
      } else {
        newSet.add(code);
      }
      return newSet;
    });
  };

  // Handle mode change and adjust value if needed
  const handleMeasurementModeChange = (mode: MeasurementMode) => {
    setMeasurementMode(mode);
    // Set appropriate default value for each mode
    if (mode === 'walk_time') {
      setMeasurementValue(20); // 20 min = 1 mile
    } else if (mode === 'drive_time') {
      setMeasurementValue(10); // 10 min = ~6 miles
    } else {
      setMeasurementValue(10); // 10 miles
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
        : measurementValue; // For isochrone API, pass minutes directly

      // Fetch all data in parallel
      const [geoResponse, boundariesResponse] = await Promise.all([
        // Step 1: Get geography codes
        fetch('/api/demographics/geography', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lat,
            lng,
            radius_miles: radiusMiles,
            measurement_mode: measurementMode,
          }),
        }),
        // Step 2: Get LSOA boundaries for map
        fetch('/api/demographics/boundaries', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lat,
            lng,
            radius_miles: radiusMiles,
            measurement_mode: measurementMode,
          }),
        }),
      ]);

      if (!geoResponse.ok) {
        throw new Error('Failed to resolve geographic areas');
      }

      const geoData = await geoResponse.json();
      const boundariesData = await boundariesResponse.json();

      // Step 3: Get demographics data and tooltip data in parallel
      const [dataResponse, tooltipResponse] = await Promise.all([
        fetch('/api/demographics/data', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            geography_codes: geoData.geography_codes,
          }),
        }),
        fetch('/api/demographics/tooltip-data', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            geography_codes: geoData.geography_codes,
          }),
        }),
      ]);

      if (!dataResponse.ok) {
        throw new Error('Failed to fetch demographics data');
      }

      const demographicsData = await dataResponse.json();
      const tooltipData = await tooltipResponse.json();

      // Store raw data
      setRawDemographicsData(demographicsData.by_lsoa);
      setLsoaTooltipData(tooltipData.tooltip_data || {});

      // Initialize all LSOAs as selected (use geography codes from API)
      setAllLsoaCodes(geoData.geography_codes);
      setSelectedLsoaCodes(new Set(geoData.geography_codes));
      initialLoadComplete.current = true;

      // Store boundaries and isochrone geometry
      console.log('[SiteDemographerPage] Received boundaries:', boundariesData);
      console.log('[SiteDemographerPage] Isochrone geometry:', boundariesData.isochrone_geometry);
      setLsoaBoundaries(boundariesData.lsoa_polygons);
      setIsochroneGeometry(boundariesData.isochrone_geometry);
    } catch (err) {
      console.error('Error analyzing demographics:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setSelectedLocation(null);
    setMeasurementMode('distance');
    setMeasurementValue(10);
    setRawDemographicsData(null);
    setLsoaBoundaries(null);
    setIsochroneGeometry(null);
    setSelectedLsoaCodes(new Set());
    setAllLsoaCodes([]);
    setError(null);
    initialLoadComplete.current = false;
  };

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col bg-white">
      {/* Consolidated Header with Controls */}
      <div className="px-8 py-5 border-b border-gray-200 bg-white shadow-sm">
        <div className="flex items-center justify-between gap-6">
          {/* Left: Title */}
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push('/new-dashboard?tab=tools')}
              className="h-9 w-9 rounded-full hover:bg-gray-100 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-xl font-bold text-gray-900">SiteDemographer</h1>
            </div>
          </div>

          {/* Right: Controls */}
          <div className="flex-1 max-w-4xl">
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
              hasResults={!!rawDemographicsData}
            />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden min-h-0">
        {/* Left Panel - Results */}
        <div className="flex-1 flex flex-col overflow-y-auto bg-white min-h-0">
          <div className={rawDemographicsData || loading ? "p-10" : "flex-1"}>
            <DemographicsResults
              loading={loading}
              error={error}
              location={selectedLocation}
              measurementMode={measurementMode}
              measurementValue={measurementValue}
              totalLsoaCount={allLsoaCodes.length}
              rawData={rawDemographicsData}
              selectedLsoaCodes={selectedLsoaCodes}
            />
          </div>
        </div>

        {/* Right Panel - Map */}
        <div className="flex-1 bg-gray-50 border-l border-gray-200 relative min-h-0">
          {selectedLocation ? (
            <DemographicsMap
              center={{ lat: selectedLocation.center[1], lng: selectedLocation.center[0] }}
              radiusMiles={convertToRadiusMiles(measurementMode, measurementValue)}
              lsoaBoundaries={lsoaBoundaries}
              isochroneGeometry={isochroneGeometry}
              loading={loading}
              measurementMode={measurementMode}
              measurementValue={measurementValue}
              selectedLsoaCodes={selectedLsoaCodes}
              allLsoaCodes={allLsoaCodes}
              onLsoaToggle={handleLsoaToggle}
              lsoaTooltipData={lsoaTooltipData}
            />
          ) : (
            <div className="h-full flex items-center justify-center">
              <div className="text-center max-w-sm px-8">
                <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-violet-100 to-purple-100 flex items-center justify-center">
                  <svg className="w-10 h-10 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                  </svg>
                </div>
                <p className="text-base font-medium text-gray-900 mb-2">Ready to analyze</p>
                <p className="text-sm text-gray-500">Enter a UK location above to view demographic insights and geographic coverage</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

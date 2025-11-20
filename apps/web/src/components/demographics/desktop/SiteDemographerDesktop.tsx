'use client';

import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LocationInputPanel } from './LocationInputPanel';
import { DemographicsResults } from './DemographicsResults';
import { DemographicsMap } from '../DemographicsMap';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useDemographicsData } from '../shared/hooks/useDemographicsData';
import { useLsoaSelection } from '../shared/hooks/useLsoaSelection';
import { useLocationSearch } from '../shared/hooks/useLocationSearch';

// Conversion constants
const WALK_SPEED_MPH = 3;
const DRIVE_SPEED_MPH = 35;

// Convert measurement to radius in miles
function convertToRadiusMiles(mode: 'distance' | 'drive_time' | 'walk_time', value: number): number {
  switch (mode) {
    case 'distance':
      return value;
    case 'walk_time':
      return (value / 60) * WALK_SPEED_MPH;
    case 'drive_time':
      return (value / 60) * DRIVE_SPEED_MPH;
  }
}

export function SiteDemographerDesktop() {
  const router = useRouter();

  // Shared hooks for data management
  const {
    rawDemographicsData,
    isochroneGeometry,
    lsoaTooltipData,
    nationalAverages,
    loading,
    error,
    analyze,
    reset: resetDemographics,
    updateData,
  } = useDemographicsData();

  const {
    selectedLsoaCodes,
    allLsoaCodes,
    isRefetchingData,
    setIsRefetchingData,
    toggleLsoa,
    initializeSelection,
    reset: resetSelection,
  } = useLsoaSelection();

  const {
    selectedLocation,
    measurementMode,
    measurementValue,
    setSelectedLocation,
    setMeasurementMode,
    setMeasurementValue,
    reset: resetLocation,
  } = useLocationSearch();

  // Desktop-specific state
  const [showTraffic, setShowTraffic] = useState(false);
  const [showCountPoints, setShowCountPoints] = useState(false);

  // Re-fetch aggregated data when selection changes
  useEffect(() => {
    if (!rawDemographicsData || selectedLsoaCodes.size === 0) return;

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
        // Update the data with newly aggregated results
        updateData(demographicsData.by_lsoa);
      } catch (err) {
        console.error('Error refetching demographics:', err);
      } finally {
        setIsRefetchingData(false);
      }
    };

    // Debounce to avoid too many API calls
    const timeoutId = setTimeout(fetchAggregatedData, 300);
    return () => clearTimeout(timeoutId);
  }, [selectedLsoaCodes, rawDemographicsData, setIsRefetchingData, updateData]);

  const handleAnalyze = async () => {
    if (!selectedLocation) return;

    const result = await analyze(selectedLocation, measurementMode, measurementValue);

    if (result.success && result.lsoaCodes) {
      // Initialize LSOA selection with all codes
      initializeSelection(result.lsoaCodes);
    }
  };

  const handleReset = () => {
    resetDemographics();
    resetSelection();
    resetLocation();
  };

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col bg-gradient-to-b from-gray-50 to-white">
      {/* Premium Header with Controls */}
      <div className="relative z-50 px-8 py-4 border-b border-gray-200 bg-white/80 backdrop-blur-sm">
        {/* Subtle gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-r from-violet-50/30 via-transparent to-purple-50/30 pointer-events-none" />

        <div className="relative flex items-center justify-between gap-6">
          {/* Left: Premium Title Section */}
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push('/new-dashboard?tab=tools')}
              className="h-8 w-8 rounded-lg hover:bg-violet-50 hover:text-violet-700 transition-all duration-200"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-2">
              <div className="h-8 w-1 bg-gradient-to-b from-violet-500 to-purple-600 rounded-full" />
              <h1 className="text-lg font-semibold text-gray-900 tracking-tight">
                SiteAnalyser
              </h1>
            </div>
          </div>

          {/* Right: Premium Controls */}
          <div className="flex-1 max-w-4xl">
            <LocationInputPanel
              selectedLocation={selectedLocation}
              onLocationChange={setSelectedLocation}
              measurementMode={measurementMode}
              onMeasurementModeChange={setMeasurementMode}
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
        {/* Left Panel - Results (30%) */}
        <div className="w-[30%] flex flex-col overflow-y-auto bg-white min-h-0 border-r border-gray-200">
          <div className={rawDemographicsData || loading ? "p-6" : "flex-1"}>
            <DemographicsResults
              loading={loading}
              error={error}
              location={selectedLocation}
              measurementMode={measurementMode}
              measurementValue={measurementValue}
              totalLsoaCount={allLsoaCodes.length}
              rawData={rawDemographicsData}
              selectedLsoaCodes={selectedLsoaCodes}
              nationalAverages={nationalAverages}
            />
          </div>
        </div>

        {/* Right Panel - Map (70%) */}
        <div className="flex-1 bg-gray-50 relative min-h-0">
          {selectedLocation ? (
            <>
              <DemographicsMap
                center={{ lat: selectedLocation.center[1], lng: selectedLocation.center[0] }}
                radiusMiles={convertToRadiusMiles(measurementMode, measurementValue)}
                isochroneGeometry={isochroneGeometry}
                loading={loading}
                measurementMode={measurementMode}
                measurementValue={measurementValue}
                selectedLsoaCodes={selectedLsoaCodes}
                allLsoaCodes={allLsoaCodes}
                onLsoaToggle={toggleLsoa}
                lsoaTooltipData={lsoaTooltipData}
                showTraffic={showTraffic}
                showCountPoints={showCountPoints}
              />

              {/* Traffic Layer Toggles - Floating Buttons */}
              <div className="absolute bottom-4 left-4 z-20 flex flex-col gap-2">
                <Button
                  onClick={() => setShowTraffic(!showTraffic)}
                  variant={showTraffic ? "default" : "outline"}
                  size="sm"
                  className={showTraffic ? "bg-violet-600 hover:bg-violet-700" : "bg-white"}
                >
                  {showTraffic ? "Hide Traffic" : "Show Traffic"}
                </Button>
                <Button
                  onClick={() => setShowCountPoints(!showCountPoints)}
                  variant={showCountPoints ? "default" : "outline"}
                  size="sm"
                  className={showCountPoints ? "bg-cyan-500 hover:bg-cyan-600" : "bg-white"}
                >
                  {showCountPoints ? "Hide Count Points" : "Show Count Points"}
                </Button>
              </div>
            </>
          ) : (
            <div className="h-full flex items-center justify-center">
              <div className="text-center max-w-sm px-8">
                <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-violet-100 to-purple-100 flex items-center justify-center">
                  <svg className="w-10 h-10 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                  </svg>
                </div>
                <p className="text-base font-medium text-gray-900 mb-2">Ready to analyse</p>
                <p className="text-sm text-gray-500">Enter a UK location above to view demographic insights</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MobileHeader } from './MobileHeader';
import { MobileBottomSheet, type SheetHeight } from './MobileBottomSheet';
import { MobileLocationSearch } from './MobileLocationSearch';
import { MobileResults } from './MobileResults';
import { DemographicsMap } from '../DemographicsMap';
import { useDemographicsData } from '../shared/hooks/useDemographicsData';
import { useLsoaSelection } from '../shared/hooks/useLsoaSelection';
import { useLocationSearch } from '../shared/hooks/useLocationSearch';
import { useSubscriptionTier } from '@/hooks/useSubscriptionTier';
import type { LocationResult } from '@/lib/mapbox';
import { toast } from 'sonner';

// Conversion constants
const WALK_SPEED_MPH = 3;
const DRIVE_SPEED_MPH = 35;

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

export function SiteDemographerMobile() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isFreeTier, isPro } = useSubscriptionTier();

  // Get site context from URL params
  const linkedSiteId = searchParams?.get('site_id');
  const linkedSiteName = searchParams?.get('site_name');

  // Prevent overscroll/bounce on mobile
  useEffect(() => {
    // Prevent pull-to-refresh and overscroll bounce
    document.body.style.overscrollBehavior = 'none';
    document.documentElement.style.overscrollBehavior = 'none';

    // Lock body scroll to prevent scrolling behind the bottom sheet
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';
    document.body.style.height = '100%';

    return () => {
      // Cleanup on unmount
      document.body.style.overscrollBehavior = '';
      document.documentElement.style.overscrollBehavior = '';
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
      document.body.style.height = '';
    };
  }, []);

  // Shared hooks
  const {
    rawDemographicsData,
    isochroneGeometry,
    lsoaTooltipData,
    loading,
    error,
    analyze,
    updateData,
    reset: resetDemographics,
    loadSavedAnalysis,
  } = useDemographicsData();

  const {
    selectedLsoaCodes,
    allLsoaCodes,
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

  // Mobile-specific state
  const [sheetHeight, setSheetHeight] = useState<SheetHeight>('collapsed');
  const [searchOpen, setSearchOpen] = useState(false);
  const [isRefetchingData, setIsRefetchingData] = useState(false);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);

  // Load saved analysis from query parameter
  useEffect(() => {
    const analysisId = searchParams?.get('analysis');
    if (!analysisId || loadingAnalysis) return;

    const loadAnalysis = async () => {
      setLoadingAnalysis(true);
      try {
        const response = await fetch(`/api/demographic-analyses/${analysisId}`);

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to load analysis');
        }

        const { analysis } = await response.json();

        // Reconstruct location object from saved data
        const reconstructedLocation: LocationResult = {
          id: `saved-${analysis.id}`,
          place_type: ['place'],
          text: analysis.location_name,
          place_name: analysis.location_name,
          center: [analysis.location.lng, analysis.location.lat],
          context: [],
        };

        // Load saved state
        setSelectedLocation(reconstructedLocation);
        setMeasurementMode(analysis.measurement_mode);
        setMeasurementValue(analysis.measurement_value);

        // Load demographics data
        loadSavedAnalysis({
          demographics_data: analysis.demographics_data,
          isochrone_geometry: analysis.isochrone_geometry,
          national_averages: analysis.national_averages,
        });

        // Initialize LSOA selection
        initializeSelection(analysis.selected_lsoa_codes);

        // Expand sheet to show results on mobile
        setSheetHeight('halfway');

        toast.success('Analysis loaded successfully');
      } catch (error) {
        console.error('Error loading saved analysis:', error);
        toast.error(error instanceof Error ? error.message : 'Failed to load analysis');
        // Clear the query parameter on error
        router.replace('/new-dashboard/tools/site-demographer');
      } finally {
        setLoadingAnalysis(false);
      }
    };

    loadAnalysis();
  }, [searchParams]); // Only run when searchParams changes

  // Refetch data when LSOA selection changes
  useEffect(() => {
    // Only refetch if we have initial data AND the selection has changed
    if (!rawDemographicsData || selectedLsoaCodes.size === 0) {
      return;
    }

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

        // Update the raw data with the new aggregated data
        updateData(demographicsData.by_lsoa);
      } catch (error) {
        console.error('Error refetching demographics data:', error);
      } finally {
        setIsRefetchingData(false);
      }
    };

    // Debounce the refetch to avoid too many requests
    const timeoutId = setTimeout(() => {
      fetchAggregatedData();
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [selectedLsoaCodes, updateData]); // Removed rawDemographicsData to prevent infinite loop

  const handleAnalyze = async () => {
    if (!selectedLocation) return;

    const result = await analyze(selectedLocation, measurementMode, measurementValue);

    if (result.success && result.lsoaCodes) {
      initializeSelection(result.lsoaCodes);
      // Expand sheet to show results
      setSheetHeight('halfway');
    }
  };

  // Handle location selection - reset previous data and auto-analyze
  const handleLocationSelect = async (location: LocationResult) => {
    // Reset previous data if we had results
    if (rawDemographicsData) {
      resetDemographics();
      resetSelection();
    }

    // Set new location
    setSelectedLocation(location);

    // Auto-analyze the new location
    const result = await analyze(location, measurementMode, measurementValue);

    if (result.success && result.lsoaCodes) {
      initializeSelection(result.lsoaCodes);
      setSheetHeight('halfway');
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-white overflow-hidden">
      {/* Mobile Header */}
      <MobileHeader
        selectedLocation={selectedLocation}
        onSearchClick={() => setSearchOpen(true)}
        measurementMode={measurementMode}
        measurementValue={measurementValue}
        onAnalyze={handleAnalyze}
        loading={loading}
      />

      {/* Site Context Banner */}
      {linkedSiteId && linkedSiteName && (
        <div className="bg-gradient-to-r from-purple-50 to-violet-50 border-b-2 border-purple-200 px-4 py-3">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-purple-600 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-purple-900">
                Saving to site: <span className="text-purple-700">{linkedSiteName}</span>
              </p>
              <p className="text-xs text-purple-600">
                Auto-linked on save
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                const url = new URL(window.location.href);
                url.searchParams.delete('site_id');
                url.searchParams.delete('site_name');
                window.history.replaceState({}, '', url.toString());
                window.location.reload();
              }}
              className="text-purple-600 hover:text-purple-700 hover:bg-purple-100 text-xs px-2 py-1 h-auto"
            >
              Remove
            </Button>
          </div>
        </div>
      )}

      {/* Map Container - Takes remaining height, non-scrollable */}
      <div className="flex-1 relative overflow-hidden">
        {selectedLocation ? (
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
            showTraffic={false}
            showCountPoints={false}
            isMobile={true}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-50 overflow-hidden">
            <div className="text-center px-8">
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-violet-100 to-purple-100 flex items-center justify-center">
                <svg className="w-10 h-10 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                </svg>
              </div>
              <p className="text-lg font-medium text-gray-900 mb-2">Ready to analyse</p>
              <p className="text-sm text-gray-500">Tap above to search for a UK location</p>
            </div>
          </div>
        )}

        {/* Mobile Bottom Sheet */}
        <MobileBottomSheet
          open={true}
          height={sheetHeight}
          onHeightChange={setSheetHeight}
        >
          <MobileResults
            loading={loading}
            error={error}
            location={selectedLocation}
            measurementMode={measurementMode}
            measurementValue={measurementValue}
            rawData={rawDemographicsData}
            selectedLsoaCodes={selectedLsoaCodes}
            isFreeTier={isFreeTier}
          />
        </MobileBottomSheet>
      </div>

      {/* Location Search Modal */}
      <MobileLocationSearch
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        selectedLocation={selectedLocation}
        onLocationSelect={handleLocationSelect}
        measurementMode={measurementMode}
        measurementValue={measurementValue}
        onMeasurementModeChange={setMeasurementMode}
        onMeasurementValueChange={setMeasurementValue}
      />
    </div>
  );
}

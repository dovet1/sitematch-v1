/**
 * Hook for managing demographics data fetching and state
 * Extracted from SiteDemographerPage to be shared between mobile and desktop
 */

import { useState, useRef, useCallback } from 'react';
import type { LocationResult } from '@/lib/mapbox';
import { formatLocationDisplay } from '@/lib/mapbox';
import type { LSOATooltipData } from '@/lib/supabase-census-data';
import type { MeasurementMode } from '../types/demographics.types';
import type { CoverageStatus } from '@/lib/types/demographics';
import { getCoverageMessages } from '@/lib/coverage-utils';

export function useDemographicsData() {
  const [rawDemographicsData, setRawDemographicsData] = useState<Record<string, any> | null>(null);
  const [isochroneGeometry, setIsochroneGeometry] = useState<any>(null);
  const [lsoaTooltipData, setLsoaTooltipData] = useState<Record<string, LSOATooltipData>>({});
  const [dataZoneTooltipData, setDataZoneTooltipData] = useState<Record<string, LSOATooltipData>>({});
  const [nationalAverages, setNationalAverages] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorType, setErrorType] = useState<'coverage' | 'validation' | 'server' | null>(null);
  const [coverageStatus, setCoverageStatus] = useState<CoverageStatus | null>(null);
  const initialLoadComplete = useRef(false);

  const analyze = async (
    location: LocationResult,
    measurementMode: MeasurementMode,
    measurementValue: number
  ) => {
    // Validate measurement value
    if (!measurementValue || typeof measurementValue !== 'number' || measurementValue <= 0) {
      setError('Invalid measurement value');
      return { success: false, error: 'Invalid measurement value' };
    }

    setLoading(true);
    setError(null);
    setErrorType(null);
    setCoverageStatus(null);

    try {
      const [lng, lat] = location.center;

      // Fetch LSOA codes and isochrone geometry
      const boundariesResponse = await fetch('/api/demographics/boundaries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lat,
          lng,
          radius_miles: measurementValue,
          measurement_mode: measurementMode,
          place_name: formatLocationDisplay(location),
        }),
      });

      if (!boundariesResponse.ok) {
        let errorData: any = {};

        try {
          const responseText = await boundariesResponse.text();
          console.log('[useDemographicsData] Raw error response:', responseText);

          if (responseText) {
            try {
              errorData = JSON.parse(responseText);
            } catch (jsonError) {
              console.error('[useDemographicsData] Response is not valid JSON:', jsonError);
              errorData = { error: 'Invalid server response', details: responseText };
            }
          } else {
            console.error('[useDemographicsData] Empty error response');
            errorData = { error: 'Empty error response from server' };
          }
        } catch (textError) {
          console.error('[useDemographicsData] Failed to read error response:', textError);
          errorData = { error: 'Failed to read error response' };
        }

        console.error('[useDemographicsData] Boundaries API error:', {
          status: boundariesResponse.status,
          statusText: boundariesResponse.statusText,
          errorData,
        });

        // Handle coverage errors separately
        if (errorData.error_type === 'coverage') {
          const messages = getCoverageMessages(
            errorData.coverage_status,
            formatLocationDisplay(location)
          );
          setError(messages.validationError || 'This location is outside our coverage area');
          setErrorType('coverage');
          setCoverageStatus(errorData.coverage_status);
          return {
            lsoaCodes: [],
            success: false,
            error: messages.validationError,
            errorType: 'coverage' as const,
            coverageStatus: errorData.coverage_status,
          };
        }

        throw new Error(errorData.error || errorData.details || 'Failed to resolve geographic areas');
      }

      const boundariesData = await boundariesResponse.json();
      const lsoaCodes = boundariesData.lsoa_codes || [];
      const dataZoneCodes = boundariesData.data_zone_codes || [];

      // Get demographics data and tooltip data in parallel
      const [dataResponse, tooltipResponse] = await Promise.all([
        fetch('/api/demographics/data', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lsoa_codes: lsoaCodes,
            data_zone_codes: dataZoneCodes,
          }),
        }),
        fetch('/api/demographics/tooltip-data', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lsoa_codes: lsoaCodes,
            data_zone_codes: dataZoneCodes,
          }),
        }),
      ]);

      if (!dataResponse.ok) {
        throw new Error('Failed to fetch demographics data');
      }

      const demographicsData = await dataResponse.json();
      const tooltipData = await tooltipResponse.json();

      // Store data - handle both regions
      setRawDemographicsData(demographicsData);
      setLsoaTooltipData(tooltipData.lsoa_tooltip_data || {});
      setDataZoneTooltipData(tooltipData.dz_tooltip_data || {});

      // Store national averages (for single-region searches, use that region's averages)
      if (demographicsData.is_mixed) {
        // For mixed searches, we don't use a single national average
        // This will be handled in the UI layer
        setNationalAverages({});
      } else if (demographicsData.england_wales) {
        setNationalAverages(demographicsData.england_wales.national_averages || {});
        console.log('[useDemographicsData] Loaded', Object.keys(demographicsData.england_wales.national_averages || {}).length, 'England/Wales national averages');
      } else if (demographicsData.scotland) {
        setNationalAverages(demographicsData.scotland.national_averages || {});
        console.log('[useDemographicsData] Loaded', Object.keys(demographicsData.scotland.national_averages || {}).length, 'Scotland national averages');
      }

      // Store isochrone geometry
      console.log('[useDemographicsData] Received LSOA codes:', lsoaCodes.length);
      console.log('[useDemographicsData] Received Data Zone codes:', dataZoneCodes.length);
      console.log('[useDemographicsData] Isochrone geometry:', boundariesData.isochrone_geometry);
      setIsochroneGeometry(boundariesData.isochrone_geometry);

      initialLoadComplete.current = true;

      return {
        lsoaCodes,
        dataZoneCodes,
        success: true,
      };
    } catch (err) {
      console.error('Error analyzing demographics:', err);
      const errorMessage = err instanceof Error ? err.message : 'An error occurred';
      setError(errorMessage);
      return {
        lsoaCodes: [],
        success: false,
      };
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setRawDemographicsData(null);
    setIsochroneGeometry(null);
    setLsoaTooltipData({});
    setDataZoneTooltipData({});
    setNationalAverages({});
    setError(null);
    setErrorType(null);
    setCoverageStatus(null);
    initialLoadComplete.current = false;
  };

  const updateData = useCallback((newData: Record<string, any>) => {
    setRawDemographicsData(newData);
  }, []);

  const loadSavedAnalysis = useCallback((analysisData: {
    demographics_data: Record<string, any>;
    isochrone_geometry: any;
    national_averages: Record<string, number>;
  }) => {
    setRawDemographicsData(analysisData.demographics_data);
    setIsochroneGeometry(analysisData.isochrone_geometry);
    setNationalAverages(analysisData.national_averages);
    setLsoaTooltipData({}); // Tooltip data isn't saved, can be refetched if needed
    initialLoadComplete.current = true;
  }, []);

  return {
    rawDemographicsData,
    isochroneGeometry,
    lsoaTooltipData,
    dataZoneTooltipData,
    nationalAverages,
    loading,
    error,
    errorType,
    coverageStatus,
    initialLoadComplete: initialLoadComplete.current,
    analyze,
    reset,
    updateData,
    loadSavedAnalysis,
  };
}

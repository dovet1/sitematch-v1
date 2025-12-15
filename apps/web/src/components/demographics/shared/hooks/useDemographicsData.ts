/**
 * Hook for managing demographics data fetching and state
 * Extracted from SiteDemographerPage to be shared between mobile and desktop
 */

import { useState, useRef, useCallback } from 'react';
import type { LocationResult } from '@/lib/mapbox';
import type { LSOATooltipData } from '@/lib/supabase-census-data';
import type { MeasurementMode } from '../types/demographics.types';

export function useDemographicsData() {
  const [rawDemographicsData, setRawDemographicsData] = useState<Record<string, any> | null>(null);
  const [isochroneGeometry, setIsochroneGeometry] = useState<any>(null);
  const [lsoaTooltipData, setLsoaTooltipData] = useState<Record<string, LSOATooltipData>>({});
  const [nationalAverages, setNationalAverages] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const initialLoadComplete = useRef(false);

  const analyze = async (
    location: LocationResult,
    measurementMode: MeasurementMode,
    measurementValue: number
  ) => {
    setLoading(true);
    setError(null);

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
        }),
      });

      if (!boundariesResponse.ok) {
        const errorData = await boundariesResponse.json().catch(() => ({}));
        console.error('[useDemographicsData] Boundaries API error:', errorData);
        throw new Error(errorData.error || errorData.details || 'Failed to resolve geographic areas');
      }

      const boundariesData = await boundariesResponse.json();
      const lsoaCodes = boundariesData.lsoa_codes;

      // Get demographics data and tooltip data in parallel
      const [dataResponse, tooltipResponse] = await Promise.all([
        fetch('/api/demographics/data', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            geography_codes: lsoaCodes,
          }),
        }),
        fetch('/api/demographics/tooltip-data', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            geography_codes: lsoaCodes,
          }),
        }),
      ]);

      if (!dataResponse.ok) {
        throw new Error('Failed to fetch demographics data');
      }

      const demographicsData = await dataResponse.json();
      const tooltipData = await tooltipResponse.json();

      // Store data
      setRawDemographicsData(demographicsData.by_lsoa);
      setLsoaTooltipData(tooltipData.tooltip_data || {});

      // Store national averages
      if (demographicsData.national_averages) {
        setNationalAverages(demographicsData.national_averages);
        console.log('[useDemographicsData] Loaded', Object.keys(demographicsData.national_averages).length, 'national averages');
      }

      // Store isochrone geometry
      console.log('[useDemographicsData] Received LSOA codes:', lsoaCodes.length);
      console.log('[useDemographicsData] Isochrone geometry:', boundariesData.isochrone_geometry);
      setIsochroneGeometry(boundariesData.isochrone_geometry);

      initialLoadComplete.current = true;

      return {
        lsoaCodes,
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
    setNationalAverages({});
    setError(null);
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
    nationalAverages,
    loading,
    error,
    initialLoadComplete: initialLoadComplete.current,
    analyze,
    reset,
    updateData,
    loadSavedAnalysis,
  };
}

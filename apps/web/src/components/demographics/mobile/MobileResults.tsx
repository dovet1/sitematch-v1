'use client';

import { Users, TrendingUp } from 'lucide-react';
import type { LocationResult } from '@/lib/mapbox';
import { formatLocationDisplay } from '@/lib/mapbox';
import type { MeasurementMode } from '../shared/types/demographics.types';
import { useMemo } from 'react';

interface MobileResultsProps {
  loading: boolean;
  error: string | null;
  location: LocationResult | null;
  measurementMode: MeasurementMode;
  measurementValue: number;
  rawData?: Record<string, any> | null;
  selectedLsoaCodes?: Set<string>;
}

function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toString();
}

export function MobileResults({
  loading,
  error,
  location,
  measurementMode,
  measurementValue,
  rawData,
  selectedLsoaCodes,
}: MobileResultsProps) {
  const getMeasurementDisplay = () => {
    switch (measurementMode) {
      case 'distance':
        return `${measurementValue} mile${measurementValue !== 1 ? 's' : ''}`;
      case 'drive_time':
        return `${measurementValue} min drive`;
      case 'walk_time':
        return `${measurementValue} min walk`;
    }
  };

  const allCategoryData = useMemo(() => {
    console.log('[MobileResults] rawData:', rawData);
    if (!rawData) {
      console.log('[MobileResults] No rawData');
      return null;
    }

    const aggregatedData = rawData['aggregated'];
    console.log('[MobileResults] aggregatedData:', aggregatedData);
    if (!aggregatedData) {
      console.log('[MobileResults] No aggregatedData');
      return null;
    }

    // Extract key metrics
    // Note: aggregated data uses different field names than individual LSOA data
    const totalPop = aggregatedData.population_total || 0;

    // Affluence is nested in an 'affluence' object for aggregated data
    // Use avg_raw_score which is the same as what desktop uses
    const affluenceScore = aggregatedData.affluence?.avg_raw_score || 0;

    console.log('[MobileResults] Extracted metrics:', { totalPop, affluenceScore, affluence: aggregatedData.affluence });

    return {
      population: totalPop,
      affluence: affluenceScore,
    };
  }, [rawData]);

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-3">
            <div className="w-12 h-12 border-4 border-violet-200 border-t-violet-600 rounded-full animate-spin" />
            <p className="text-sm text-gray-500">Analyzing demographics...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-sm font-medium text-red-900">Error Loading Data</p>
          <p className="text-sm text-red-700 mt-1">{error}</p>
        </div>
      </div>
    );
  }

  if (!location || !allCategoryData) {
    return (
      <div className="p-6">
        <div className="flex flex-col items-center justify-center py-12">
          <div className="w-16 h-16 bg-violet-100 rounded-full flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
          </div>
          <p className="text-base font-medium text-gray-900 mb-1">Ready to analyse</p>
          <p className="text-sm text-gray-500 text-center px-4">
            Search for a location and tap Analyse to view demographic insights
          </p>
        </div>
      </div>
    );
  }

  const selectedCount = selectedLsoaCodes?.size || 0;

  return (
    <div className="pb-6">
      {/* Location Header */}
      <div className="px-4 py-3 border-b border-gray-100">
        <h3 className="text-base font-semibold text-gray-900">
          {formatLocationDisplay(location)}
        </h3>
        <p className="text-sm text-gray-500 mt-0.5">
          Within {getMeasurementDisplay()}
          {selectedCount > 0 && ` • ${selectedCount} areas selected`}
        </p>
      </div>

      {/* Key Metrics Cards */}
      <div className="px-4 pt-4 space-y-3">
        {/* Population Card */}
        <div className="bg-gradient-to-br from-violet-50 to-violet-100/50 rounded-2xl p-4 border border-violet-200/50">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 bg-violet-600 rounded-lg flex items-center justify-center">
                  <Users className="w-4 h-4 text-white" />
                </div>
                <span className="text-sm font-medium text-violet-900">Population</span>
              </div>
              <p className="text-3xl font-bold text-violet-900">
                {formatNumber(allCategoryData.population)}
              </p>
              <p className="text-xs text-violet-600 mt-1">Total residents</p>
            </div>
          </div>
        </div>

        {/* Affluence Card */}
        <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 rounded-2xl p-4 border border-emerald-200/50">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-4 h-4 text-white" />
                </div>
                <span className="text-sm font-medium text-emerald-900">Affluence Score</span>
              </div>
              <p className="text-3xl font-bold text-emerald-900">
                {allCategoryData.affluence.toFixed(1)}
              </p>
              <p className="text-xs text-emerald-600 mt-1">
                {allCategoryData.affluence >= 70
                  ? 'Very affluent'
                  : allCategoryData.affluence >= 55
                  ? 'Above average'
                  : allCategoryData.affluence >= 40
                  ? 'Typical'
                  : allCategoryData.affluence >= 25
                  ? 'Below average'
                  : 'Less affluent'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Interaction Hint */}
      <div className="px-4 pt-4">
        <div className="bg-gray-50 rounded-xl p-3 border border-gray-200">
          <p className="text-xs text-gray-600 text-center">
            Tap areas on the map to include/exclude them from the analysis
          </p>
        </div>
      </div>
    </div>
  );
}

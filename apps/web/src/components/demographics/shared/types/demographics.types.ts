/**
 * Shared TypeScript types for demographics components
 */

import type { LocationResult } from '@/lib/mapbox';
import type { LSOATooltipData } from '@/lib/supabase-census-data';

export type MeasurementMode = 'distance' | 'drive_time' | 'walk_time';

export interface DemographicsState {
  selectedLocation: LocationResult | null;
  measurementMode: MeasurementMode;
  measurementValue: number;
  rawDemographicsData: Record<string, any> | null;
  isochroneGeometry: any;
  selectedLsoaCodes: Set<string>;
  allLsoaCodes: string[];
  lsoaTooltipData: Record<string, LSOATooltipData>;
  nationalAverages: Record<string, number>;
  loading: boolean;
  error: string | null;
  showTraffic: boolean;
  showCountPoints: boolean;
}

export interface AnalyzeParams {
  location: LocationResult;
  measurementMode: MeasurementMode;
  measurementValue: number;
}

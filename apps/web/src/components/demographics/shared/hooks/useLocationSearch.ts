/**
 * Hook for managing location search state
 * Extracted to be shared between mobile and desktop
 */

import { useState } from 'react';
import type { LocationResult } from '@/lib/mapbox';
import type { MeasurementMode } from '../types/demographics.types';

export function useLocationSearch() {
  const [selectedLocation, setSelectedLocation] = useState<LocationResult | null>(null);
  const [measurementMode, setMeasurementMode] = useState<MeasurementMode>('distance');
  const [measurementValue, setMeasurementValue] = useState<number>(10);

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

  const reset = () => {
    setSelectedLocation(null);
    setMeasurementMode('distance');
    setMeasurementValue(10);
  };

  return {
    selectedLocation,
    measurementMode,
    measurementValue,
    setSelectedLocation,
    setMeasurementMode: handleMeasurementModeChange,
    setMeasurementValue,
    reset,
  };
}

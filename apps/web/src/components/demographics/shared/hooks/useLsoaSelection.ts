/**
 * Hook for managing LSOA and Data Zone selection state
 * Extracted from SiteDemographerPage to be shared between mobile and desktop
 */

import { useState, useEffect } from 'react';

export function useLsoaSelection() {
  const [selectedLsoaCodes, setSelectedLsoaCodes] = useState<Set<string>>(new Set());
  const [allLsoaCodes, setAllLsoaCodes] = useState<string[]>([]);
  const [selectedDataZoneCodes, setSelectedDataZoneCodes] = useState<Set<string>>(new Set());
  const [allDataZoneCodes, setAllDataZoneCodes] = useState<string[]>([]);
  const [isRefetchingData, setIsRefetchingData] = useState(false);

  const toggleLsoa = (code: string) => {
    setSelectedLsoaCodes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(code)) {
        // Don't allow deselecting all LSOAs if there are no Data Zones
        if (newSet.size > 1 || allDataZoneCodes.length > 0) {
          newSet.delete(code);
        }
      } else {
        newSet.add(code);
      }
      return newSet;
    });
  };

  const toggleDataZone = (code: string) => {
    setSelectedDataZoneCodes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(code)) {
        // Don't allow deselecting all Data Zones if there are no LSOAs
        if (newSet.size > 1 || allLsoaCodes.length > 0) {
          newSet.delete(code);
        }
      } else {
        newSet.add(code);
      }
      return newSet;
    });
  };

  const initializeSelection = (lsoaCodes: string[], dataZoneCodes: string[] = []) => {
    setAllLsoaCodes(lsoaCodes);
    setSelectedLsoaCodes(new Set(lsoaCodes));
    setAllDataZoneCodes(dataZoneCodes);
    setSelectedDataZoneCodes(new Set(dataZoneCodes));
  };

  const reset = () => {
    setSelectedLsoaCodes(new Set());
    setAllLsoaCodes([]);
    setSelectedDataZoneCodes(new Set());
    setAllDataZoneCodes([]);
    setIsRefetchingData(false);
  };

  return {
    selectedLsoaCodes,
    allLsoaCodes,
    selectedDataZoneCodes,
    allDataZoneCodes,
    isRefetchingData,
    setIsRefetchingData,
    toggleLsoa,
    toggleDataZone,
    initializeSelection,
    reset,
  };
}

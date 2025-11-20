/**
 * Hook for managing LSOA selection state
 * Extracted from SiteDemographerPage to be shared between mobile and desktop
 */

import { useState, useEffect } from 'react';

export function useLsoaSelection() {
  const [selectedLsoaCodes, setSelectedLsoaCodes] = useState<Set<string>>(new Set());
  const [allLsoaCodes, setAllLsoaCodes] = useState<string[]>([]);
  const [isRefetchingData, setIsRefetchingData] = useState(false);

  const toggleLsoa = (code: string) => {
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

  const initializeSelection = (codes: string[]) => {
    setAllLsoaCodes(codes);
    setSelectedLsoaCodes(new Set(codes));
  };

  const reset = () => {
    setSelectedLsoaCodes(new Set());
    setAllLsoaCodes([]);
    setIsRefetchingData(false);
  };

  return {
    selectedLsoaCodes,
    allLsoaCodes,
    isRefetchingData,
    setIsRefetchingData,
    toggleLsoa,
    initializeSelection,
    reset,
  };
}

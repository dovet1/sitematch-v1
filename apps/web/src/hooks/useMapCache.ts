import { useState, useRef } from 'react';
import { SearchResult, SearchFilters } from '@/types/search';

interface CacheEntry {
  data: SearchResult[];
  timestamp: number;
  bounds: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
}

interface MapCacheHook {
  getCachedData: (cacheKey: string) => SearchResult[] | null;
  setCachedData: (cacheKey: string, data: SearchResult[], bounds: any) => void;
  clearCache: () => void;
  generateCacheKey: (filters: SearchFilters, bounds: any) => string;
}

const CACHE_EXPIRY = 10 * 60 * 1000; // 10 minutes - longer for map data
const MAX_CACHE_SIZE = 100; // Larger cache for better map performance

export function useMapCache(): MapCacheHook {
  const cacheRef = useRef<Map<string, CacheEntry>>(new Map());

  const getCachedData = (cacheKey: string): SearchResult[] | null => {
    const entry = cacheRef.current.get(cacheKey);
    
    if (!entry) {
      return null;
    }

    // Check if cache entry has expired
    const now = Date.now();
    if (now - entry.timestamp > CACHE_EXPIRY) {
      cacheRef.current.delete(cacheKey);
      return null;
    }

    return entry.data;
  };

  const setCachedData = (cacheKey: string, data: SearchResult[], bounds: any) => {
    // Enforce cache size limit with LRU eviction
    if (cacheRef.current.size >= MAX_CACHE_SIZE) {
      // Remove oldest entries (LRU)
      let entriesToRemove = Math.floor(MAX_CACHE_SIZE * 0.2); // Remove 20% when full
      const sortedEntries = Array.from(cacheRef.current.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp);
      
      for (let i = 0; i < entriesToRemove && i < sortedEntries.length; i++) {
        cacheRef.current.delete(sortedEntries[i][0]);
      }
    }

    cacheRef.current.set(cacheKey, {
      data: [...data], // Create a copy to avoid reference issues
      timestamp: Date.now(),
      bounds: { ...bounds }
    });
  };

  const clearCache = () => {
    cacheRef.current.clear();
  };

  const generateCacheKey = (filters: SearchFilters, bounds: any): string => {
    // Create a stable cache key based on filters and map bounds
    const filterKey = [
      filters.location || '',
      filters.companyName || '',
      filters.sector.sort().join(','),
      filters.useClass.sort().join(','),
      filters.sizeMin?.toString() || '',
      filters.sizeMax?.toString() || '',
      filters.isNationwide ? '1' : '0'
    ].join('|');

    // Round bounds more aggressively to improve cache hit rate
    const roundedBounds = [
      Math.round(bounds.north * 100) / 100,  // Round to 2 decimal places for better cache hits
      Math.round(bounds.south * 100) / 100,
      Math.round(bounds.east * 100) / 100,
      Math.round(bounds.west * 100) / 100
    ].join(',');

    return `${filterKey}:${roundedBounds}`;
  };

  return {
    getCachedData,
    setCachedData,
    clearCache,
    generateCacheKey
  };
}
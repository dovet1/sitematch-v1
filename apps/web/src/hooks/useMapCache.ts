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

const CACHE_EXPIRY = 5 * 60 * 1000; // 5 minutes
const MAX_CACHE_SIZE = 50;

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
    // Enforce cache size limit
    if (cacheRef.current.size >= MAX_CACHE_SIZE) {
      // Remove oldest entry
      const firstKey = cacheRef.current.keys().next().value;
      if (firstKey) {
        cacheRef.current.delete(firstKey);
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

    // Round bounds to reduce cache misses from tiny movements
    const roundedBounds = [
      Math.round(bounds.north * 1000) / 1000,
      Math.round(bounds.south * 1000) / 1000,
      Math.round(bounds.east * 1000) / 1000,
      Math.round(bounds.west * 1000) / 1000
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
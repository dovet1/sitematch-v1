'use client';

import { SiteNavbar } from '@/components/header';
import { SearchFilters } from '@/types/search';
import { SearchHeaderBar } from './SearchHeaderBar';

interface UnifiedHeaderProps {
  searchFilters: SearchFilters;
  onFiltersChange: (filters: SearchFilters) => void;
  isMapView?: boolean;
  onMapViewToggle?: (isMapView: boolean) => void;
  showViewToggle?: boolean;
}

export function UnifiedHeader({
  searchFilters,
  onFiltersChange,
  isMapView = false,
  onMapViewToggle,
  showViewToggle = false
}: UnifiedHeaderProps) {
  return (
    <>
      <SiteNavbar />
      <SearchHeaderBar
        searchFilters={searchFilters}
        onFiltersChange={onFiltersChange}
        isMapView={isMapView}
        onMapViewToggle={onMapViewToggle}
        showViewToggle={showViewToggle}
      />
    </>
  );
}

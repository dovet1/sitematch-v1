// =====================================================
// Reference Data Service - Story 3.1
// Provides sector and use class data for wizard components
// =====================================================

import { getSectors, getUseClasses } from '@/lib/listings';
import type { SearchableOption } from '@/components/ui/searchable-dropdown';

// Sector options aligned with PRD specifications
export const SECTOR_OPTIONS = [
  { value: 'retail', label: 'Retail', description: 'Retail and consumer-facing businesses' },
  { value: 'food_beverage', label: 'Food & Beverage', description: 'Food & Beverage establishments' },
  { value: 'leisure', label: 'Leisure', description: 'Entertainment and hospitality' },
  { value: 'industrial_logistics', label: 'Industrial & Logistics', description: 'Industrial & Logistics operations' },
  { value: 'office', label: 'Office', description: 'Office and professional services' },
  { value: 'healthcare', label: 'Healthcare', description: 'Healthcare and medical services' },
  { value: 'automotive', label: 'Automotive', description: 'Automotive and transport services' },
  { value: 'roadside', label: 'Roadside', description: 'Roadside and highway services' },
  { value: 'other', label: 'Other', description: 'Other sectors not specified above' }
] as const;

export type SectorValue = typeof SECTOR_OPTIONS[number]['value'];

// Note: Removed module-level caching to prevent cross-user data leakage
// Each request will fetch fresh data from the database

/**
 * Format sector names for better display
 * Converts database names like "retail" to "Retail" or "industrial_logistics" to "Industrial & Logistics"
 */
function formatSectorName(name: string): string {
  const formatMap: Record<string, string> = {
    'retail': 'Retail',
    'office': 'Office',
    'industrial': 'Industrial',
    'leisure': 'Entertainment & Leisure',
    'mixed': 'Mixed Use',
    'food_beverage': 'Food & Beverage',
    'industrial_logistics': 'Industrial & Logistics',
    'healthcare': 'Healthcare',
    'automotive': 'Automotive',
    'roadside': 'Roadside Services'
  };

  // Check for exact match first
  if (formatMap[name]) {
    return formatMap[name];
  }

  // Fall back to title case formatting
  return name
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' & ');
}

/**
 * Get use class options for searchable dropdown
 * Returns cached data or fetches from database
 */
export async function getUseClassOptions(): Promise<SearchableOption[]> {
  try {
    const useClasses = await getUseClasses();
    
    return useClasses.map(uc => ({
      value: uc.id,
      label: `${uc.code} - ${uc.name}`,
      description: uc.description || undefined
    }));
  } catch (error) {
    console.error('Failed to fetch use classes:', error);
    
    // Return fallback options based on PRD specifications
    return [
      { value: 'fallback-retail', label: 'E(a) - Retail', description: 'Display or retail sale of goods' },
      { value: 'fallback-cafe', label: 'E(b) - Café/Restaurant', description: 'Sale of food and drink for consumption' },
      { value: 'fallback-office', label: 'E(g)(i) - Office', description: 'Offices to carry out operational/administrative functions' },
      { value: 'fallback-light-industrial', label: 'E(g)(iii) - Light Industrial', description: 'Light industrial processes' },
      { value: 'fallback-general-industrial', label: 'B2 - General Industrial', description: 'General industrial processes' },
      { value: 'fallback-storage', label: 'B8 - Storage/Distribution', description: 'Storage or distribution of goods' },
      { value: 'fallback-hotel', label: 'C1 - Hotel', description: 'Hotels and accommodation' },
      { value: 'fallback-special', label: 'Sui Generis - Special Use', description: 'Drive-thru, Petrol, Cinema, Casino, etc.' }
    ];
  }
}

/**
 * Get sector options for searchable dropdown
 * Returns cached data or fetches from database
 */
export async function getSectorOptions(): Promise<SearchableOption[]> {
  try {
    const sectors = await getSectors();
    
    return sectors.map(sector => ({
      value: sector.id,
      label: formatSectorName(sector.name),
      description: sector.description || undefined
    }));
  } catch (error) {
    console.error('Failed to fetch sectors:', error);
    
    // Return fallback options based on PRD specifications
    return [...SECTOR_OPTIONS];
  }
}

/**
 * Get sector options with database validation
 * Ensures all PRD sectors exist in database
 */
export async function validateSectorOptions(): Promise<{ valid: boolean; missingsectors: string[] }> {
  try {
    const sectors = await getSectors();
    const dbSectorNames = new Set(sectors.map(s => s.name));
    
    const missingBbSectors = SECTOR_OPTIONS
      .map(option => option.value)
      .filter(sectorValue => !dbSectorNames.has(sectorValue));

    return {
      valid: missingBbSectors.length === 0,
      missingsectors: missingBbSectors
    };
  } catch (error) {
    console.error('Failed to validate sectors:', error);
    return {
      valid: false,
      missingsectors: SECTOR_OPTIONS.map(s => s.value)
    };
  }
}

/**
 * Map sector name to database ID
 * Used during listing creation
 */
export async function mapSectorToId(sectorName: SectorValue): Promise<string | null> {
  try {
    const sectors = await getSectors();
    const sector = sectors.find(s => s.name === sectorName);
    return sector?.id || null;
  } catch (error) {
    console.error('Failed to map sector to ID:', error);
    return null;
  }
}

/**
 * Validate use class ID exists in database
 * Used during listing creation
 */
export async function validateUseClassId(useClassId: string): Promise<boolean> {
  try {
    const useClasses = await getUseClasses();
    return useClasses.some(uc => uc.id === useClassId);
  } catch (error) {
    console.error('Failed to validate use class ID:', error);
    return false;
  }
}

/**
 * Clear reference data cache
 * Note: Caching has been removed to prevent cross-user data leakage
 * This function is kept for backward compatibility but does nothing
 */
export function clearReferenceDataCache(): void {
  // No-op: caching has been removed
}

/**
 * Preload reference data for better performance
 * Call this during app initialization
 */
export async function preloadReferenceData(): Promise<void> {
  try {
    await Promise.all([
      getSectorOptions(),
      getUseClassOptions(),
      validateSectorOptions()
    ]);
    console.log('Reference data preloaded successfully');
  } catch (error) {
    console.error('Failed to preload reference data:', error);
  }
}

// Export types for use in components
export type { SearchableOption };
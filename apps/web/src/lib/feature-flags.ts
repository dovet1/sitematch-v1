import { createServerClient } from '@/lib/supabase'

/**
 * Server-side reader for the `feature_flags` config table. Flags are global
 * (not per-user) and toggled via SQL/admin so a feature can be enabled or
 * disabled instantly without a redeploy.
 *
 * Fails closed: any error (missing row, DB unavailable) resolves to `false`.
 */
export async function isFeatureEnabled(key: string): Promise<boolean> {
  try {
    const supabase = await createServerClient()
    const { data, error } = await supabase
      .from('feature_flags')
      .select('enabled')
      .eq('key', key)
      .single()

    if (error || !data) return false
    return data.enabled === true
  } catch {
    return false
  }
}

export const UNIFIED_WORKSPACE_FLAG = 'unified_workspace_enabled'

export function isUnifiedWorkspaceEnabled(): Promise<boolean> {
  return isFeatureEnabled(UNIFIED_WORKSPACE_FLAG)
}

// Find Sites — the standalone experimental prospecting route. Off by default; enable the
// `find_sites_enabled` row in the DB to view it (internal/beta convention).
export const FIND_SITES_FLAG = 'find_sites_enabled'

export function isFindSitesEnabled(): Promise<boolean> {
  return isFeatureEnabled(FIND_SITES_FLAG)
}

// Auto parking (SiteMatcher unified workspace, Sketch tool). Off by default until
// the full vertical flow (through apply + persistence) is done — see
// docs/design_handoff_auto_parking/INTEGRATION_PLAN.md §8.
export const AUTO_PARKING_FLAG = 'auto_parking_enabled'

export function isAutoParkingEnabled(): Promise<boolean> {
  return isFeatureEnabled(AUTO_PARKING_FLAG)
}

// GeoDS retail-centre geography in Find Gaps. Kept off until the GeoDS import
// and Mapbox layers have both been deployed.
export const RETAIL_CENTRE_GAPS_FLAG = 'retail_centre_gaps_enabled'

export function isRetailCentreGapsEnabled(): Promise<boolean> {
  return isFeatureEnabled(RETAIL_CENTRE_GAPS_FLAG)
}

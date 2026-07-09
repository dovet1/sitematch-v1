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

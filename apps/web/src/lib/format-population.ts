/**
 * Format population for display according to specification:
 * - "<5k" for BUAs with pop_final < 5000
 * - Formatted numbers for larger BUAs
 */
export function formatPopulation(pop_final: number | null | undefined): string {
  if (pop_final == null) return 'Unknown'
  if (pop_final < 5000) return '<5k'
  return pop_final.toLocaleString()
}

/**
 * Get the effective population value for filtering/sorting
 * Uses pop_final if available, falls back to pop
 */
export function getEffectivePopulation(bua: { pop_final?: number | null; pop: number }): number {
  return bua.pop_final ?? bua.pop
}

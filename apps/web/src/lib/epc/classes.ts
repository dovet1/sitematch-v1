/**
 * Which property classes a brand's certificates are admitted from.
 *
 * matchall.py discovers this in a first pass over every property class, keeping the
 * certificates that name the brand and then admitting whichever classes those anchors
 * actually used. That is what finds, without being told, that Screwfix trade counters
 * are certificated as warehouses, Premier Inn as hotels, nine gym brands as leisure.
 *
 * It is a whole-estate computation and cannot be run for one batch of new stores. So
 * the incremental matcher reads the answer back out of what that pass already
 * established — the property classes on the brand's committed high-confidence rows.
 *
 * Pure, so both the cron and the conformance test use this and not a copy of it. The
 * fetching differs between them; the rule must not.
 */
export const BASE_CLASSES = ['retail', 'food'] as const

// Enough certificates to be a pattern rather than an accident, and a large enough share
// that one mis-grouped brand cannot open a class up. Mirrors matchall.py's own
// thresholds for admitting a learned class.
export const LEARNED_MIN_ROWS = 5
export const LEARNED_MIN_SHARE = 0.2

export interface ClassObservation {
  brand_id: string
  property_class: string | null
}

export function deriveAdmissibleClasses(
  rows: ClassObservation[]
): Map<string, Set<string>> {
  const tally = new Map<string, Map<string, number>>()
  for (const r of rows) {
    if (!r.brand_id || !r.property_class) continue
    const m = tally.get(r.brand_id) ?? new Map<string, number>()
    m.set(r.property_class, (m.get(r.property_class) ?? 0) + 1)
    tally.set(r.brand_id, m)
  }

  const out = new Map<string, Set<string>>()
  for (const [brand, m] of Array.from(tally)) {
    const total = Array.from(m.values()).reduce((a, b) => a + b, 0)
    const set = new Set<string>(BASE_CLASSES)
    for (const [cls, n] of Array.from(m)) {
      if (n >= LEARNED_MIN_ROWS && n / total >= LEARNED_MIN_SHARE) set.add(cls)
    }
    out.set(brand, set)
  }
  return out
}

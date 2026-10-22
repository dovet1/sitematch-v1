import type { NearbyStore } from './services/gaps-service'

// Filters find-gaps map pins by the sidebar's brand/category selections.
// Category matching uses each store's own fascia -> categories, mirroring the
// present-brand cards in brand-landscape.ts. Empty selections pass everything.
export function filterGapStorePins(
  pins: NearbyStore[],
  catSet: Set<string>,
  brandSet: Set<string>,
  fasciaCategoryIds: Map<string, string[]>
): NearbyStore[] {
  if (catSet.size === 0 && brandSet.size === 0) return pins
  return pins.filter((s) => {
    if (brandSet.size > 0 && !brandSet.has(s.brand_id)) return false
    if (catSet.size > 0) {
      const cats = fasciaCategoryIds.get(s.fascia_id) ?? []
      if (!cats.some((c) => catSet.has(c))) return false
    }
    return true
  })
}

import type {
  ReferenceData,
  MissingFascia,
  PresentBrand,
  MissingBrand,
} from '../types/unified-workspace'
import type { NearbyStore } from './services/gaps-service'

// Collapses the fascia-level landscape (nearby stores + missing fascias) into a
// brand-level view for the Assess sidebar: one row per brand trading here, and
// one row per brand with no presence. A brand with any fascia trading in the
// catchment counts as present, so it never appears in the missing list.
export function buildBrandLandscape(
  stores: NearbyStore[],
  missing: MissingFascia[],
  refData: ReferenceData | null
): { present: PresentBrand[]; missing: MissingBrand[] } {
  const brandNameById = new Map<string, string>()
  for (const b of refData?.brands ?? []) brandNameById.set(b.id, b.name)

  const presentMap = new Map<string, PresentBrand>()
  for (const s of stores) {
    const existing = presentMap.get(s.brand_id)
    if (existing) {
      existing.storeCount += 1
    } else {
      presentMap.set(s.brand_id, {
        brandId: s.brand_id,
        brandName: brandNameById.get(s.brand_id) ?? s.fascia_name ?? s.name,
        storeCount: 1,
        town: s.town,
      })
    }
  }
  const present = Array.from(presentMap.values()).sort(
    (a, b) => b.storeCount - a.storeCount
  )

  const missingMap = new Map<string, MissingBrand>()
  for (const m of missing) {
    if (presentMap.has(m.brandId)) continue
    const existing = missingMap.get(m.brandId)
    if (!existing) {
      missingMap.set(m.brandId, {
        brandId: m.brandId,
        brandName: m.brandName,
        categoryName: m.categoryName,
        nearestStoreDistance: m.nearestStoreDistance,
        representative: m,
      })
    } else if (
      m.nearestStoreDistance != null &&
      (existing.nearestStoreDistance == null ||
        m.nearestStoreDistance < existing.nearestStoreDistance)
    ) {
      // Prefer the closest missing fascia as the brand's representative.
      existing.nearestStoreDistance = m.nearestStoreDistance
      existing.representative = m
    }
  }

  return { present, missing: Array.from(missingMap.values()) }
}

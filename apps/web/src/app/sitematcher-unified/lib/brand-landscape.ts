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

  // fascia -> its category ids (primary first), and category id -> name.
  const fasciaCategoryIds = new Map<string, string[]>()
  const primaryCategoryByFascia = new Map<string, string>()
  const categoryNameById = new Map<string, string>()
  for (const c of refData?.categories ?? []) categoryNameById.set(c.id, c.name)
  for (const m of refData?.fasciaCategoryMappings ?? []) {
    const list = fasciaCategoryIds.get(m.fascia_id)
    if (list) list.push(m.category_id)
    else fasciaCategoryIds.set(m.fascia_id, [m.category_id])
    if (m.is_primary) primaryCategoryByFascia.set(m.fascia_id, m.category_id)
  }

  // Present brands: aggregate stores per brand, tracking the union of the
  // trading fascias' categories plus the most common fascia (for a display name).
  interface PresentAgg {
    brand: PresentBrand
    categoryIds: Set<string>
    fasciaCounts: Map<string, number>
  }
  const presentMap = new Map<string, PresentAgg>()
  for (const s of stores) {
    let agg = presentMap.get(s.brand_id)
    if (!agg) {
      agg = {
        brand: {
          brandId: s.brand_id,
          brandName: brandNameById.get(s.brand_id) ?? s.fascia_name ?? s.name,
          storeCount: 0,
          town: s.town,
          categoryIds: [],
          categoryName: null,
          logoDomain: s.logo_domain ?? null,
          logoUrl: s.logo_url ?? null,
        },
        categoryIds: new Set<string>(),
        fasciaCounts: new Map<string, number>(),
      }
      presentMap.set(s.brand_id, agg)
    }
    agg.brand.storeCount += 1
    for (const cid of fasciaCategoryIds.get(s.fascia_id) ?? [])
      agg.categoryIds.add(cid)
    agg.fasciaCounts.set(
      s.fascia_id,
      (agg.fasciaCounts.get(s.fascia_id) ?? 0) + 1
    )
  }

  const present: PresentBrand[] = []
  for (const agg of Array.from(presentMap.values())) {
    agg.brand.categoryIds = Array.from(agg.categoryIds)
    // Display name: primary category of the brand's most common present fascia.
    let topFascia: string | null = null
    let topCount = -1
    for (const [fasciaId, count] of Array.from(agg.fasciaCounts)) {
      if (count > topCount) {
        topCount = count
        topFascia = fasciaId
      }
    }
    const displayCat = topFascia ? primaryCategoryByFascia.get(topFascia) : null
    agg.brand.categoryName = displayCat
      ? (categoryNameById.get(displayCat) ?? null)
      : null
    present.push(agg.brand)
  }
  present.sort((a, b) =>
    a.brandName.localeCompare(b.brandName, undefined, { sensitivity: 'base' })
  )

  // Missing brands: collapse missing fascias to their owning brand, excluding
  // any brand already trading here. Accumulate categories across all of the
  // brand's missing fascias; the representative is the closest missing fascia.
  interface MissingAgg {
    brand: MissingBrand
    categoryIds: Set<string>
  }
  const missingMap = new Map<string, MissingAgg>()
  for (const m of missing) {
    if (presentMap.has(m.brandId)) continue
    let agg = missingMap.get(m.brandId)
    if (!agg) {
      agg = {
        brand: {
          brandId: m.brandId,
          brandName: m.brandName,
          categoryName: m.categoryName,
          categoryIds: [],
          nearestStoreDistance: m.nearestStoreDistance,
          representative: m,
          logoDomain: m.logoDomain,
          logoUrl: m.logoUrl,
        },
        categoryIds: new Set<string>(),
      }
      missingMap.set(m.brandId, agg)
    } else if (
      m.nearestStoreDistance != null &&
      (agg.brand.nearestStoreDistance == null ||
        m.nearestStoreDistance < agg.brand.nearestStoreDistance)
    ) {
      // Prefer the closest missing fascia as the brand's representative; keep
      // the display name in sync with it so display and filtering can't diverge.
      agg.brand.nearestStoreDistance = m.nearestStoreDistance
      agg.brand.representative = m
      agg.brand.categoryName = m.categoryName
      // Logo comes from the brand, so it's the same across fascias — but keep it
      // in sync with the representative for consistency.
      agg.brand.logoDomain = m.logoDomain
      agg.brand.logoUrl = m.logoUrl
    }
    if (m.categoryId) agg.categoryIds.add(m.categoryId)
  }

  const missingList: MissingBrand[] = []
  for (const agg of Array.from(missingMap.values())) {
    agg.brand.categoryIds = Array.from(agg.categoryIds)
    missingList.push(agg.brand)
  }

  return { present, missing: missingList }
}

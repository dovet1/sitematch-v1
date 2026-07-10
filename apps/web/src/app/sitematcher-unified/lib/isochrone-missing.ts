import type { NearbyStore } from './services/gaps-service'
import type { MissingFascia, ReferenceData } from '../types/unified-workspace'

// Under a drive/walk catchment the store landscape is scoped to the isochrone
// polygon, but the server `/missing-fascias` endpoint only knows radius circles.
// So we take the server's missing set (computed for the bounding circle) and
// union in "ring-only" brands: fascias that DO trade inside the bounding circle
// but fall OUTSIDE the isochrone — i.e. missing from the catchment the user sees.
//
// This stays bounded (it can only add brands that physically exist in the ring),
// avoiding the thousands-of-entries blow-up a naive "universe − present" would give.
export function computeIsochroneMissing(
  filtered: NearbyStore[],
  allStores: NearbyStore[],
  serverMissing: MissingFascia[],
  refData: ReferenceData
): MissingFascia[] {
  const presentInBlob = new Set(filtered.map((s) => s.fascia_id))
  const alreadyMissing = new Set(serverMissing.map((m) => m.fasciaId))

  // fascia id -> { fasciaName, brandId, brandName }
  const fasciaMeta = new Map<
    string,
    { fasciaName: string; brandId: string; brandName: string }
  >()
  for (const brand of refData.brands) {
    for (const f of brand.fascias) {
      fasciaMeta.set(f.id, {
        fasciaName: f.name,
        brandId: brand.id,
        brandName: brand.name,
      })
    }
  }

  // fascia id -> primary category (fall back to any mapped category)
  const categoryName = new Map(refData.categories.map((c) => [c.id, c.name]))
  const fasciaCategory = new Map<string, { id: string; name: string | null }>()
  for (const m of refData.fasciaCategoryMappings) {
    const existing = fasciaCategory.get(m.fascia_id)
    if (!existing || m.is_primary) {
      fasciaCategory.set(m.fascia_id, {
        id: m.category_id,
        name: categoryName.get(m.category_id) ?? null,
      })
    }
  }

  const ringOnly: MissingFascia[] = []
  const seen = new Set<string>()
  for (const s of allStores) {
    const fid = s.fascia_id
    if (presentInBlob.has(fid) || alreadyMissing.has(fid) || seen.has(fid)) continue
    seen.add(fid)
    const meta = fasciaMeta.get(fid)
    const cat = fasciaCategory.get(fid)
    ringOnly.push({
      fasciaId: fid,
      fasciaName: meta?.fasciaName ?? s.fascia_name ?? s.name,
      brandId: meta?.brandId ?? s.brand_id,
      brandName: meta?.brandName ?? s.fascia_name ?? s.name,
      categoryId: cat?.id ?? null,
      categoryName: cat?.name ?? null,
    })
  }

  return [...serverMissing, ...ringOnly]
}

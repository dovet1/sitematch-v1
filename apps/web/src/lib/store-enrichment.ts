import { createServerClient } from '@/lib/supabase'
import type { Store } from '@/lib/stores'

export async function addFasciaNames(stores: Store[]): Promise<Store[]> {
  if (stores.length === 0) {
    return stores
  }

  const fasciaIds = Array.from(new Set(stores.map(store => store.fascia_id).filter(Boolean)))
  if (fasciaIds.length === 0) {
    return stores
  }

  const supabase = await createServerClient()
  const { data } = await supabase
    .from('fascias')
    .select('id, name')
    .in('id', fasciaIds)

  const fasciaNameById = new Map((data || []).map((fascia: any) => [fascia.id, fascia.name]))

  return stores.map(store => ({
    ...store,
    fascia_name: fasciaNameById.get(store.fascia_id) ?? store.fascia_name ?? null
  }))
}

export async function addBrandInfo(stores: Store[]): Promise<Store[]> {
  if (stores.length === 0) {
    return stores
  }

  const brandIds = Array.from(new Set(stores.map(store => store.brand_id).filter(Boolean)))
  if (brandIds.length === 0) {
    return stores
  }

  const supabase = await createServerClient()
  const { data } = await supabase
    .from('brands')
    .select('id, name, domain, logo_url')
    .in('id', brandIds)

  const brandById = new Map((data || []).map((brand: any) => [brand.id, brand]))

  return stores.map(store => {
    const brand = brandById.get(store.brand_id)
    return {
      ...store,
      brand_name: brand?.name ?? store.brand_name ?? null,
      logo_domain: brand?.domain ?? null,
      logo_url: brand?.logo_url ?? null,
    }
  })
}

// Convenience: apply both enrichments (fascia names, then brand info).
export async function enrichStores(stores: Store[]): Promise<Store[]> {
  return addBrandInfo(await addFasciaNames(stores))
}

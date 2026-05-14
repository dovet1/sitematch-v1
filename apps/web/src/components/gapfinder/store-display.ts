import type { Store, ViewportStore } from '@/lib/stores'

type StoreAddressFields = Pick<
  Store | ViewportStore,
  'address_line_1' | 'address_line_2' | 'suburb' | 'town' | 'county' | 'postcode'
>

export function formatStorePopupAddress(store: StoreAddressFields): string {
  const addressParts = [
    store.address_line_1,
    store.address_line_2,
    store.suburb,
    store.town,
    store.county,
    store.postcode
  ]
    .map(part => (part || '').trim())
    .filter(Boolean)

  const seenParts = new Set<string>()
  const dedupedParts = addressParts.filter((part) => {
    const normalizedPart = part.toLowerCase()
    const isAlreadyRepresented = seenParts.has(normalizedPart)

    part
      .split(',')
      .map(piece => piece.trim().toLowerCase())
      .filter(Boolean)
      .forEach(piece => seenParts.add(piece))

    if (!isAlreadyRepresented) {
      seenParts.add(normalizedPart)
    }

    return !isAlreadyRepresented
  })

  return dedupedParts.join('\n')
}

export function getStorePopupTitle(store: Pick<Store | ViewportStore, 'fascia_name' | 'name'>): string {
  return store.fascia_name?.trim() || store.name?.trim() || 'Store'
}

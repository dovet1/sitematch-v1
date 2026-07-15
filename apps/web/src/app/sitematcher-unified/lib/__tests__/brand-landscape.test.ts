import { buildBrandLandscape } from '../brand-landscape'
import type { NearbyStore } from '../services/gaps-service'
import type { MissingFascia, ReferenceData } from '../../types/unified-workspace'

function store(overrides: Partial<NearbyStore> & { brand_id: string; fascia_id: string }): NearbyStore {
  return {
    id: `store-${Math.random()}`,
    name: 'Store',
    brand_name: null,
    fascia_name: null,
    logo_domain: null,
    logo_url: null,
    lat: 51.5,
    lon: -0.12,
    town: null,
    postcode: null,
    ...overrides,
  }
}

function missing(overrides: Partial<MissingFascia> & { fasciaId: string; brandId: string }): MissingFascia {
  return {
    fasciaName: 'Fascia',
    brandName: 'Brand',
    categoryId: null,
    categoryName: null,
    logoDomain: null,
    logoUrl: null,
    ...overrides,
  }
}

const refData: ReferenceData = {
  categories: [],
  brands: [],
  fasciaCategoryMappings: [],
}

describe('buildBrandLandscape', () => {
  it('carries logoDomain/logoUrl onto present rows from their stores', () => {
    const stores = [
      store({
        brand_id: 'brand-1',
        fascia_id: 'fascia-1',
        brand_name: 'BrandOne',
        logo_domain: 'brandone.com',
        logo_url: 'https://cdn/brandone.png',
      }),
    ]
    const { present } = buildBrandLandscape(stores, [], refData)
    expect(present).toHaveLength(1)
    expect(present[0].logoDomain).toBe('brandone.com')
    expect(present[0].logoUrl).toBe('https://cdn/brandone.png')
  })

  it('present rows default logo fields to null when the store has none', () => {
    const stores = [store({ brand_id: 'brand-2', fascia_id: 'fascia-2' })]
    const { present } = buildBrandLandscape(stores, [], refData)
    expect(present[0].logoDomain).toBeNull()
    expect(present[0].logoUrl).toBeNull()
  })

  it('counts every supplied store for a present brand', () => {
    const stores = [
      store({ id: 'inside-bua-1', brand_id: 'brand-2', fascia_id: 'fascia-2' }),
      store({ id: 'inside-bua-2', brand_id: 'brand-2', fascia_id: 'fascia-2' }),
      store({ id: 'inside-bua-3', brand_id: 'brand-2', fascia_id: 'fascia-3' }),
    ]

    const { present } = buildBrandLandscape(stores, [], refData)

    expect(present).toHaveLength(1)
    expect(present[0].brandId).toBe('brand-2')
    expect(present[0].storeCount).toBe(3)
  })

  it('carries logoDomain/logoUrl onto missing rows from the representative fascia', () => {
    const m = [
      missing({
        fasciaId: 'fascia-3',
        brandId: 'brand-3',
        nearestStoreDistance: 1000,
        logoDomain: 'brandthree.com',
        logoUrl: 'https://cdn/brandthree.png',
      }),
    ]
    const { missing: missingBrands } = buildBrandLandscape([], m, refData)
    expect(missingBrands).toHaveLength(1)
    expect(missingBrands[0].logoDomain).toBe('brandthree.com')
    expect(missingBrands[0].logoUrl).toBe('https://cdn/brandthree.png')
  })

  it('keeps missing-row logo in sync when a closer fascia replaces the representative', () => {
    const m = [
      missing({
        fasciaId: 'far',
        brandId: 'brand-4',
        nearestStoreDistance: 5000,
        logoDomain: 'far.com',
        logoUrl: 'https://cdn/far.png',
      }),
      missing({
        fasciaId: 'near',
        brandId: 'brand-4',
        nearestStoreDistance: 500,
        logoDomain: 'near.com',
        logoUrl: 'https://cdn/near.png',
      }),
    ]
    const { missing: missingBrands } = buildBrandLandscape([], m, refData)
    expect(missingBrands).toHaveLength(1)
    expect(missingBrands[0].representative.fasciaId).toBe('near')
    expect(missingBrands[0].logoDomain).toBe('near.com')
    expect(missingBrands[0].logoUrl).toBe('https://cdn/near.png')
  })
})

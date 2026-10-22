import {
  applyStoreBadgeHighlight,
  STORE_BADGE_SHADOW,
  STORE_BADGE_SHADOW_HL,
} from '../store-badges'
import type { NearbyStore } from '../../../lib/services/gaps-service'

function store(brandId: string): NearbyStore {
  return {
    id: `store-${brandId}`,
    name: 'Store',
    brand_id: brandId,
    fascia_id: 'fascia',
    brand_name: null,
    fascia_name: null,
    logo_domain: null,
    logo_url: null,
    lat: 51.5,
    lon: -0.12,
    town: null,
    postcode: null,
  }
}

describe('applyStoreBadgeHighlight', () => {
  it('highlights matching stores and dims non-matching stores', () => {
    const matching = document.createElement('div')
    const other = document.createElement('div')

    applyStoreBadgeHighlight(matching, store('brand-a'), 'brand-a')
    applyStoreBadgeHighlight(other, store('brand-b'), 'brand-a')

    expect(matching.style.opacity).toBe('1')
    expect(matching.style.boxShadow).toBe(STORE_BADGE_SHADOW_HL)
    expect(matching.style.zIndex).toBe('2')
    expect(other.style.opacity).toBe('0.35')
    expect(other.style.boxShadow).toBe(STORE_BADGE_SHADOW)
    expect(other.style.zIndex).toBe('')
  })

  it('resets store badge styling when no brand is hovered', () => {
    const el = document.createElement('div')
    el.style.opacity = '0.35'
    el.style.boxShadow = STORE_BADGE_SHADOW_HL
    el.style.zIndex = '2'

    applyStoreBadgeHighlight(el, store('brand-a'), null)

    expect(el.style.opacity).toBe('1')
    expect(el.style.boxShadow).toBe(STORE_BADGE_SHADOW)
    expect(el.style.zIndex).toBe('')
  })
})

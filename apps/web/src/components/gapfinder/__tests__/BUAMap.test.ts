jest.mock('mapbox-gl', () => ({
  __esModule: true,
  default: {
    accessToken: '',
    Map: jest.fn(),
    NavigationControl: jest.fn(),
    Marker: jest.fn(),
    Popup: jest.fn()
  }
}))

import {
  formatStorePopupAddress,
  generateStorePopupHTML,
  getStorePopupTitle,
  formatRequirementLocationDisplay,
  isRequirementLayerClick,
  isStoreMarkerEventTarget
} from '../BUAMap'

describe('formatStorePopupAddress', () => {
  it('formats a full store address with every available address part', () => {
    expect(formatStorePopupAddress({
      address_line_1: '1 High Street',
      address_line_2: 'Unit 2',
      suburb: 'Headingley',
      town: 'Leeds',
      county: 'West Yorkshire',
      postcode: 'LS1 1AA'
    })).toBe('1 High Street\nUnit 2\nHeadingley\nLeeds\nWest Yorkshire\nLS1 1AA')
  })

  it('omits missing and blank address fields cleanly', () => {
    expect(formatStorePopupAddress({
      address_line_1: '1 High Street',
      address_line_2: null,
      suburb: '   ',
      town: 'Leeds',
      county: null,
      postcode: 'LS1 1AA'
    })).toBe('1 High Street\nLeeds\nLS1 1AA')
  })

  it('removes duplicate adjacent address values', () => {
    expect(formatStorePopupAddress({
      address_line_1: '1 High Street',
      address_line_2: 'Leeds',
      suburb: 'leeds',
      town: 'Leeds',
      county: 'West Yorkshire',
      postcode: 'LS1 1AA'
    })).toBe('1 High Street\nLeeds\nWest Yorkshire\nLS1 1AA')
  })

  it('does not repeat town and postcode when address line 1 already contains the full address', () => {
    expect(formatStorePopupAddress({
      address_line_1: 'Unit 7, Parade, Canterbury, CT1 2SG',
      address_line_2: null,
      suburb: null,
      town: 'Canterbury',
      county: null,
      postcode: 'CT1 2SG'
    })).toBe('Unit 7, Parade, Canterbury, CT1 2SG')
  })
})

describe('store marker popup display', () => {
  it('prefers fascia name over store name for the popup header', () => {
    expect(getStorePopupTitle({
      fascia_name: 'Tesco Express',
      name: 'Tesco Store 123'
    })).toBe('Tesco Express')
  })

  it('falls back to store name when fascia name is unavailable', () => {
    expect(getStorePopupTitle({
      fascia_name: null,
      name: 'Tesco Store 123'
    })).toBe('Tesco Store 123')
  })

  it('falls back to store name when fascia name is blank', () => {
    expect(getStorePopupTitle({
      fascia_name: '   ',
      name: 'Tesco Store 123'
    })).toBe('Tesco Store 123')
  })

  it('renders escaped fascia header and address line breaks', () => {
    const html = generateStorePopupHTML(
      'Bob & Co Express',
      '1 High Street\nLeeds',
      '#6F5AFF'
    )

    expect(html).toContain('Bob &amp; Co Express')
    expect(html).toContain('1 High Street<br />Leeds')
  })
})

describe('formatRequirementLocationDisplay', () => {
  it('shortens London locality addresses', () => {
    expect(formatRequirementLocationDisplay(
      'Dulwich, London, England, United Kingdom',
      'Fallback'
    )).toBe('Dulwich, London')
  })

  it('shortens county addresses', () => {
    expect(formatRequirementLocationDisplay(
      'Canterbury, Kent, England, United Kingdom',
      'Fallback'
    )).toBe('Canterbury, Kent')
  })

  it('removes UK suffixes when only one locality remains', () => {
    expect(formatRequirementLocationDisplay('London, UK', 'Fallback')).toBe('London')
  })

  it('falls back to place name when formatted address is unavailable', () => {
    expect(formatRequirementLocationDisplay(
      null,
      'Dulwich, London, England, United Kingdom'
    )).toBe('Dulwich, London')
  })

  it('returns an empty string when no usable location is available', () => {
    expect(formatRequirementLocationDisplay(null, null)).toBe('')
    expect(formatRequirementLocationDisplay('', '   ')).toBe('')
  })
})

describe('isStoreMarkerEventTarget', () => {
  it('returns true when a click starts on a store marker', () => {
    const marker = document.createElement('div')
    marker.className = 'simple-store-marker'

    expect(isStoreMarkerEventTarget(marker)).toBe(true)
  })

  it('returns true when a click starts inside a store marker', () => {
    const marker = document.createElement('div')
    marker.className = 'simple-store-marker'
    const child = document.createElement('span')
    marker.appendChild(child)

    expect(isStoreMarkerEventTarget(child)).toBe(true)
  })

  it('returns false for normal map clicks', () => {
    const canvas = document.createElement('canvas')

    expect(isStoreMarkerEventTarget(canvas)).toBe(false)
    expect(isStoreMarkerEventTarget(null)).toBe(false)
  })
})

describe('isRequirementLayerClick', () => {
  it('returns true when a click intersects a requirement layer feature', () => {
    const map = {
      getLayer: jest.fn((layerId: string) => layerId === 'requirement-locations-point'),
      queryRenderedFeatures: jest.fn(() => [{ source: 'requirement-locations-source' }])
    }

    expect(isRequirementLayerClick(map as any, { x: 10, y: 20 } as any)).toBe(true)
    expect(map.queryRenderedFeatures).toHaveBeenCalledWith(
      { x: 10, y: 20 },
      { layers: ['requirement-locations-point'] }
    )
  })

  it('returns false when requirement layers are not present', () => {
    const map = {
      getLayer: jest.fn(() => undefined),
      queryRenderedFeatures: jest.fn()
    }

    expect(isRequirementLayerClick(map as any, { x: 10, y: 20 } as any)).toBe(false)
    expect(map.queryRenderedFeatures).not.toHaveBeenCalled()
  })
})

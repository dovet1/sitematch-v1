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
  formatRequirementLocationDisplay,
  isRequirementLayerClick,
  isStoreMarkerEventTarget
} from '../BUAMap'

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

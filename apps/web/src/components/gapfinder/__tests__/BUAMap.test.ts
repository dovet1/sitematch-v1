import React from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'

const mockMapInstances: any[] = []

jest.mock('mapbox-gl', () => {
  const Map = jest.fn(function MockMap(this: any) {
    this.handlers = {}
    this.sources = {}
    this.layers = {}
    this.getStyle = jest.fn(() => ({
      layers: [
        { id: 'background', type: 'background' },
        { id: 'road-label', type: 'symbol', layout: { 'text-field': '{name}' } }
      ]
    }))
    this.getSource = jest.fn((sourceId: string) => this.sources[sourceId])
    this.addSource = jest.fn((sourceId: string, source: any) => {
      this.sources[sourceId] = source?.type === 'geojson'
        ? { ...source, setData: jest.fn() }
        : source
    })
    this.getLayer = jest.fn((layerId: string) => this.layers[layerId])
    this.addLayer = jest.fn((layer: any) => {
      this.layers[layer.id] = layer
    })
    this.setLayoutProperty = jest.fn()
    this.setFilter = jest.fn()
    this.setTerrain = jest.fn()
    this.setFog = jest.fn()
    this.easeTo = jest.fn()
    this.addControl = jest.fn()
    this.resize = jest.fn()
    this.remove = jest.fn()
    this.isStyleLoaded = jest.fn(() => true)
    this.getBounds = jest.fn(() => ({
      getSouth: () => 50,
      getWest: () => -5,
      getNorth: () => 55,
      getEast: () => 1
    }))
    this.getCanvas = jest.fn(() => ({ style: {}, width: 1024 }))
    this.on = jest.fn((eventName: string, layerOrHandler: any, maybeHandler?: any) => {
      const handler = maybeHandler || layerOrHandler
      this.handlers[eventName] = this.handlers[eventName] || []
      this.handlers[eventName].push(handler)
    })
    this.off = jest.fn()
    this.__emit = (eventName: string, event: any = {}) => {
      ;(this.handlers[eventName] || []).forEach((handler: any) => handler(event))
    }
    mockMapInstances.push(this)
  })

  return {
    __esModule: true,
    default: {
      accessToken: '',
      Map,
      NavigationControl: jest.fn(),
      Marker: jest.fn(function MockMarker(this: any) {
        this.setLngLat = jest.fn(() => this)
        this.setPopup = jest.fn(() => this)
        this.addTo = jest.fn(() => this)
        this.remove = jest.fn()
      }),
      Popup: jest.fn(function MockPopup(this: any) {
        this.setLngLat = jest.fn(() => this)
        this.setHTML = jest.fn(() => this)
        this.addTo = jest.fn(() => this)
        this.remove = jest.fn()
      }),
      LngLatBounds: jest.fn(function MockLngLatBounds(this: any) {
        this.extend = jest.fn(() => this)
      })
    }
  }
})

import {
  formatStorePopupAddress,
  generateStorePopupHTML,
  getStorePopupTitle,
  formatRequirementLocationDisplay,
  enableGapFinder3DMode,
  disableGapFinder3DMode,
  BUAMap,
  isRequirementLayerClick,
  isStoreMarkerEventTarget
} from '../BUAMap'

beforeAll(() => {
  global.ResizeObserver = jest.fn().mockImplementation(() => ({
    observe: jest.fn(),
    disconnect: jest.fn()
  }))
})

beforeEach(() => {
  mockMapInstances.length = 0
})

describe('GapFinder 3D mode helpers', () => {
  it('adds terrain and building extrusion layers below the first symbol label', () => {
    const map: any = {
      sources: {},
      layers: {},
      getSource: jest.fn((sourceId: string) => (map.sources as any)[sourceId]),
      addSource: jest.fn((sourceId: string, source: any) => {
        ;(map.sources as any)[sourceId] = source
      }),
      getLayer: jest.fn((layerId: string) => (map.layers as any)[layerId]),
      addLayer: jest.fn((layer: any) => {
        ;(map.layers as any)[layer.id] = layer
      }),
      setLayoutProperty: jest.fn(),
      setTerrain: jest.fn(),
      setFog: jest.fn(),
      getStyle: jest.fn(() => ({
        layers: [
          { id: 'background', type: 'background' },
          { id: 'place-labels', type: 'symbol', layout: { 'text-field': '{name}' } }
        ]
      }))
    }

    enableGapFinder3DMode(map as any)

    expect(map.addSource).toHaveBeenCalledWith('mapbox-dem', expect.objectContaining({
      type: 'raster-dem',
      url: 'mapbox://mapbox.mapbox-terrain-dem-v1'
    }))
    expect(map.setTerrain).toHaveBeenCalledWith({ source: 'mapbox-dem', exaggeration: 1.2 })
    expect(map.addLayer).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'gapfinder-3d-buildings',
        type: 'fill-extrusion',
        source: 'composite',
        'source-layer': 'building'
      }),
      'place-labels'
    )
  })

  it('hides existing 3D buildings and clears terrain when disabled', () => {
    const map = {
      getLayer: jest.fn((layerId: string) => layerId === 'gapfinder-3d-buildings'),
      setLayoutProperty: jest.fn(),
      setTerrain: jest.fn(),
      setFog: jest.fn()
    }

    disableGapFinder3DMode(map as any)

    expect(map.setTerrain).toHaveBeenCalledWith(null)
    expect(map.setFog).toHaveBeenCalledWith(null)
    expect(map.setLayoutProperty).toHaveBeenCalledWith('gapfinder-3d-buildings', 'visibility', 'none')
  })
})

describe('BUAMap 3D toggle', () => {
  const renderLoadedMap = async () => {
    render(React.createElement(BUAMap, {
      minPopulation: 5001,
      maxPopulation: 1200000,
      className: 'h-96'
    }))

    const map = mockMapInstances[0]
    act(() => {
      map.__emit('load')
    })

    await screen.findByRole('button', { name: 'Switch GapFinder map to 3D mode' })
    return map
  }

  it('toggles the existing Mapbox instance into 3D mode', async () => {
    const map = await renderLoadedMap()

    fireEvent.click(screen.getByRole('button', { name: 'Switch GapFinder map to 3D mode' }))

    await waitFor(() => {
      expect(map.setTerrain).toHaveBeenCalledWith({ source: 'mapbox-dem', exaggeration: 1.2 })
      expect(map.addLayer).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'gapfinder-3d-buildings' }),
        'road-label'
      )
      expect(map.easeTo).toHaveBeenCalledWith(expect.objectContaining({ pitch: 60 }))
    })
  })

  it('returns the existing Mapbox instance to 2D mode', async () => {
    const map = await renderLoadedMap()

    fireEvent.click(screen.getByRole('button', { name: 'Switch GapFinder map to 3D mode' }))
    await waitFor(() => {
      expect(map.easeTo).toHaveBeenCalledWith(expect.objectContaining({ pitch: 60 }))
    })

    fireEvent.click(screen.getByRole('button', { name: 'Switch GapFinder map to 2D mode' }))

    await waitFor(() => {
      expect(map.setTerrain).toHaveBeenCalledWith(null)
      expect(map.easeTo).toHaveBeenCalledWith(expect.objectContaining({ pitch: 0, bearing: 0 }))
    })
  })
})

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

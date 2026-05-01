import { generateNearbyStoresCSV } from '@/lib/export-utils'
import { calculateDistance } from '@/lib/distance-utils'
import type { Store } from '@/lib/stores'
import type { TravelTimeData } from '@/types/travel-time'

function createStore(overrides: Partial<Store> = {}): Store {
  return {
    id: 'store-1',
    store_id: 'external-1',
    brand_id: 'brand-1',
    fascia_id: 'fascia-1',
    name: 'Example Store',
    lon: -0.13,
    lat: 51.51,
    location: '',
    postcode: 'SW1A 1AA',
    town: 'London',
    suburb: null,
    county: 'Greater London',
    address_line_1: '1 High Street',
    address_line_2: 'Unit 2',
    pqi: null,
    open_date: null,
    size_band: null,
    created_at: '2026-01-01T00:00:00.000Z',
    ...overrides
  }
}

describe('generateNearbyStoresCSV', () => {
  const selectedPoint = { lat: 51.5, lng: -0.12 }

  it('includes metadata rows and the data header', () => {
    const csv = generateNearbyStoresCSV({
      stores: [createStore()],
      selectedPoint,
      radiusMeters: 5000,
      filterSummary: 'None',
      travelTimes: {}
    })

    expect(csv.split('\n').slice(0, 5)).toEqual([
      '# Selected Point,"51.5, -0.12"',
      '# Radius,"5 km"',
      '# Filters,"None"',
      '',
      'Store Name,Distance (mi),Walking Time (min),Driving Time (min)'
    ])
  })

  it.each([
    'None',
    'Brands: Tesco, Sainsbury\'s',
    'Categories: Supermarkets',
    'Brands: Tesco AND Categories: Supermarkets'
  ])('writes filter summary metadata: %s', (filterSummary) => {
    const csv = generateNearbyStoresCSV({
      stores: [],
      selectedPoint,
      radiusMeters: 1000,
      filterSummary,
      travelTimes: {}
    })

    expect(csv).toContain(`# Filters,"${filterSummary}"`)
  })

  it('escapes commas and quotes in store names', () => {
    const csv = generateNearbyStoresCSV({
      stores: [
        createStore({
          name: 'Bob\'s "Flagship", Store'
        })
      ],
      selectedPoint,
      radiusMeters: 500,
      filterSummary: 'None',
      travelTimes: {}
    })

    expect(csv).toContain('"Bob\'s ""Flagship"", Store"')
  })

  it('matches sidebar distance calculation', () => {
    const store = createStore({ lat: 51.52, lon: -0.14 })
    const csv = generateNearbyStoresCSV({
      stores: [store],
      selectedPoint,
      radiusMeters: 5000,
      filterSummary: 'None',
      travelTimes: {}
    })
    const expectedDistance = calculateDistance(
      selectedPoint.lat,
      selectedPoint.lng,
      store.lat,
      store.lon
    )

    expect(csv).toContain(`"${expectedDistance}"`)
  })

  it('writes rounded travel time minutes and leaves missing values blank', () => {
    const travelTimes: Record<string, TravelTimeData> = {
      'store-1': {
        walking: { duration: 745, distance: 1000 },
        driving: { duration: 295, distance: 1200 }
      },
      'store-2': {
        walking: { duration: 360, distance: 700 }
      }
    }

    const csv = generateNearbyStoresCSV({
      stores: [
        createStore({ id: 'store-1', name: 'Both Times' }),
        createStore({ id: 'store-2', name: 'Walking Only' }),
        createStore({ id: 'store-3', name: 'No Times' })
      ],
      selectedPoint,
      radiusMeters: 5000,
      filterSummary: 'None',
      travelTimes
    })

    expect(csv).toContain('"Both Times",')
    expect(csv).toContain('"12","5"')
    expect(csv).toContain('"Walking Only",')
    expect(csv).toContain('"6",""')
    expect(csv).toContain('"No Times",')
  })
})

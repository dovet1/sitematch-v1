import { selectPresentStoreSource } from '../present-store-source'
import type { NearbyStore } from '../services/gaps-service'
import type { WorkspaceArea } from '../../types/unified-workspace'

function store(id: string): NearbyStore {
  return {
    id,
    name: `Store ${id}`,
    brand_id: 'brand',
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

const buaArea: WorkspaceArea = {
  id: 'bua-1',
  name: 'Test BUA',
  center: [-0.12, 51.5],
  kind: 'bua',
}

const pointArea: WorkspaceArea = {
  id: 'point-1',
  name: 'Dropped point',
  center: [-0.12, 51.5],
  kind: 'point',
}

const retailCentreArea: WorkspaceArea = {
  id: 'rc-1',
  name: 'Test Retail Park',
  center: [-0.12, 51.5],
  kind: 'retail_centre',
  classification: 'Large Retail Park',
}

describe('selectPresentStoreSource', () => {
  it('uses BUA polygon pins when a BUA is selected', () => {
    const landscapeStores = [store('radius-store')]
    const buaPins = [store('bua-store-1'), store('bua-store-2')]

    const result = selectPresentStoreSource(buaArea, landscapeStores, buaPins)

    expect(result).toBe(buaPins)
  })

  it('keeps using landscape stores outside selected BUAs', () => {
    const landscapeStores = [store('radius-store')]
    const buaPins = [store('bua-store')]

    expect(selectPresentStoreSource(pointArea, landscapeStores, buaPins)).toBe(
      landscapeStores
    )
    expect(selectPresentStoreSource(null, landscapeStores, buaPins)).toBe(
      landscapeStores
    )
  })

  it('uses exact polygon pins when a retail centre is selected', () => {
    const landscapeStores = [store('radius-store')]
    const polygonPins = [store('retail-centre-store')]

    expect(
      selectPresentStoreSource(retailCentreArea, landscapeStores, polygonPins)
    ).toBe(polygonPins)
  })
})

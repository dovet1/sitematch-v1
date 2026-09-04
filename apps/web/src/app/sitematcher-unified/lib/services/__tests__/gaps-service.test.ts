import { findGaps } from '../gaps-service'
import type { GapRule } from '../../../types/unified-workspace'

const rule: GapRule = {
  id: 'missing:test',
  kind: 'presence',
  type: 'fascia',
  value: 'Test fascia',
  targetIds: ['00000000-0000-0000-0000-000000000001'],
  op: 'lacks',
}

describe('findGaps geography contract', () => {
  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ results: [], total: 0, matchingIds: [] }),
    }) as jest.Mock
  })

  it('keeps the existing population contract for towns', async () => {
    await findGaps([rule], {
      geography: 'town',
      populationRange: [5001, 1200000],
    })

    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body)
    expect(body).toMatchObject({ geography: 'town', minPop: 5001, maxPop: 1200000 })
  })

  it('omits population and sends GeoDS type filters for retail centres', async () => {
    await findGaps([rule], {
      geography: 'retail_centre',
      populationRange: [5001, 1200000],
      retailForms: ['retail_park'],
      retailClassifications: ['Large Retail Park'],
    })

    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body)
    expect(body).toMatchObject({
      geography: 'retail_centre',
      retailForms: ['retail_park'],
      retailClassifications: ['Large Retail Park'],
    })
    expect(body).not.toHaveProperty('minPop')
    expect(body).not.toHaveProperty('maxPop')
  })
})

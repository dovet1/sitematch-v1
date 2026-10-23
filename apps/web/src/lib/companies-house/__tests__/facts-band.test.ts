import { turnoverBand } from '../facts'

describe('turnoverBand', () => {
  it('puts small and micro accounts under the size limit of their year', () => {
    expect(turnoverBand('total-exemption-full', '2025-03-31')).toEqual({ size: 'small', limit: 10.2e6, limitLabel: '£10.2m' })
    expect(turnoverBand('small', '2026-06-30')).toEqual({ size: 'small', limit: 15e6, limitLabel: '£15m' })
    expect(turnoverBand('micro-entity', '2025-12-31')).toEqual({ size: 'micro', limit: 632e3, limitLabel: '£632k' })
    expect(turnoverBand('micro-entity', '2026-04-30')).toEqual({ size: 'micro', limit: 1e6, limitLabel: '£1m' })
  })
  it('gives no band where the accounts type says nothing about size', () => {
    for (const t of ['full', 'group', 'dormant', 'audit-exemption-subsidiary', null]) expect(turnoverBand(t, '2025-03-31')).toBeNull()
  })
})

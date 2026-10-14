import {
  hash01,
  runBacktest,
  type PresenceRow,
  type SignalRow,
} from '../brand-matcher-demographics-backtest'

// 1,000 towns in five size bands of 200. Affluence rises with size, plus a part that does not:
// the trap the size bands exist for.
const towns = Array.from({ length: 1000 }, (_, i) => `E${String(i + 1).padStart(8, '0')}`)
const population = (t: string) => Math.round(1_000 + 300_000 * hash01(`pop|${t}`))
const sizeShare = (t: string) => population(t) / 301_000
const ownAffluence = (t: string) => hash01(`aff|${t}`)
const affluence = (t: string) => 50 + 100 * sizeShare(t) + 50 * ownAffluence(t)

const signalRows: SignalRow[] = towns.flatMap((t) => [
  { buaGsscode: t, signalName: 'affluence_high', signalCategory: 'affluence', value: affluence(t) },
  { buaGsscode: t, signalName: 'population', signalCategory: 'population', value: population(t) },
])

const bySize = [...towns].sort((a, z) => population(z) - population(a))
const store = (brandId: string, fasciaId: string | null) => (t: string): PresenceRow => ({
  brandId,
  fasciaId,
  buaGsscode: t,
  storeCount: 1,
})
const presence: PresenceRow[] = [
  // Posh: towns more affluent than their size explains, at every size.
  ...towns.filter((t) => ownAffluence(t) > 0.75).map(store('posh', 'posh-main')),
  // Big: the 150 largest towns, whatever their affluence. Affluent on paper, because big.
  ...bySize.slice(0, 150).map(store('big', 'big-main')),
  // Tiny: too few towns to test.
  ...towns.slice(0, 5).map(store('tiny', 'tiny-main')),
  // A store in a town with no demographics is ignored.
  { brandId: 'posh', fasciaId: 'posh-main', buaGsscode: 'S00000001', storeCount: 3 },
]

const options = { level: 'fascia' as const, holdout: 0.2, negativesPerUnit: 300, minTowns: 12 }

describe('hash01', () => {
  it('spreads near-identical codes evenly', () => {
    const share = towns.filter((t) => hash01(`unit|${t}`) < 0.2).length / towns.length
    expect(share).toBeGreaterThan(0.15)
    expect(share).toBeLessThan(0.25)
  })
})

describe('runBacktest', () => {
  const result = runBacktest(presence, signalRows, options)
  const unit = (key: string) => result.units.find((u) => u.key === key)!

  it('counts what the method can see', () => {
    expect(result.towns).toBe(1000)
    expect(result.storesInScoredTowns).toBe(presence.filter((p) => p.buaGsscode !== 'S00000001').length)
    expect(result.skipped).toBe(1)
    expect(result.units.map((u) => u.key).sort()).toEqual(['big/big-main', 'posh/posh-main'])
  })

  it('finds a brand that really is defined by demographics, whatever the town size', () => {
    const posh = unit('posh/posh-main')
    expect(posh.broad).toBe(false)
    expect(posh.auc.demographics).toBeGreaterThan(0.85)
    expect(posh.topSignals[0]).toBe('affluence_high')
    expect(Math.abs((posh.auc.size as number) - 0.5)).toBeLessThan(0.2)
  })

  it('does not credit demographics for what is only town size', () => {
    const big = unit('big/big-main')
    expect(big.broad || Math.abs((big.auc.demographics as number) - 0.5) < 0.15).toBe(true)
    expect(big.auc.size).toBeGreaterThan(0.9)
  })

  it('splits the same way on every run', () => {
    expect(runBacktest(presence, signalRows, options)).toEqual(result)
  })

  it('can run per brand', () => {
    const byBrand = runBacktest(presence, signalRows, { ...options, level: 'brand' })
    expect(byBrand.units.map((u) => u.key).sort()).toEqual(['big', 'posh'])
  })
})

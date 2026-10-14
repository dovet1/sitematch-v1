import {
  hash01,
  runBacktest,
  type PresenceRow,
  type SignalRow,
} from '../brand-matcher-demographics-backtest'

// 200 towns. Affluence and size are unrelated to each other.
const towns = Array.from({ length: 200 }, (_, i) => `E${String(i + 1).padStart(8, '0')}`)
const affluence = (t: string) => 50 + 150 * hash01(`aff|${t}`)
const population = (t: string) => Math.round(5_000 + 500_000 * hash01(`pop|${t}`))

const signalRows: SignalRow[] = towns.flatMap((t) => [
  { buaGsscode: t, signalName: 'affluence_high', signalCategory: 'affluence', value: affluence(t) },
  { buaGsscode: t, signalName: 'population', signalCategory: 'population', value: population(t) },
])

const byAffluence = [...towns].sort((a, z) => affluence(z) - affluence(a))
const presence: PresenceRow[] = [
  // Posh trades in the 50 most affluent towns.
  ...byAffluence.slice(0, 50).map((t) => ({ brandId: 'posh', fasciaId: 'posh-main', buaGsscode: t, storeCount: 1 })),
  // Random trades in an arbitrary 60.
  ...towns
    .filter((t) => hash01(`rand|${t}`) < 0.3)
    .map((t) => ({ brandId: 'random', fasciaId: 'random-main', buaGsscode: t, storeCount: 1 })),
  // Tiny is in too few towns to test.
  ...towns.slice(0, 5).map((t) => ({ brandId: 'tiny', fasciaId: 'tiny-main', buaGsscode: t, storeCount: 1 })),
  // A store in a town with no demographics is ignored.
  { brandId: 'posh', fasciaId: 'posh-main', buaGsscode: 'S00000001', storeCount: 3 },
  // Every town has some store, so all 200 are retail towns.
  ...towns.map((t) => ({ brandId: 'filler', fasciaId: null, buaGsscode: t, storeCount: 1 })),
]

const options = { level: 'fascia' as const, holdout: 0.2, negativesPerUnit: 300, minTowns: 12 }

describe('hash01', () => {
  it('spreads near-identical codes evenly', () => {
    const share = towns.filter((t) => hash01(`unit|${t}`) < 0.2).length / towns.length
    expect(share).toBeGreaterThan(0.12)
    expect(share).toBeLessThan(0.28)
  })
})

describe('runBacktest', () => {
  const result = runBacktest(presence, signalRows, options)
  const unit = (key: string) => result.units.find((u) => u.key === key)

  it('counts what the method can see', () => {
    expect(result.retailTowns).toBe(200)
    // Scottish stores are left out.
    expect(result.storesInScoredTowns).toBe(presence.filter((p) => p.buaGsscode !== 'S00000001').length)
    // Tiny is skipped; the fascia-less filler brand is not a fascia unit.
    expect(result.skipped).toBe(1)
    expect(result.units.map((u) => u.key).sort()).toEqual(['posh/posh-main', 'random/random-main'])
  })

  it('separates a brand that really is defined by demographics', () => {
    const posh = unit('posh/posh-main')!
    expect(posh.auc.all).toBeGreaterThan(0.9)
    expect(posh.auc.demographics).toBeGreaterThan(0.9)
    expect(posh.topSignals[0]).toBe('affluence_high')
    expect(posh.bandsHeldOut.good).toBeGreaterThan(posh.bandsHeldOut.weak)
    expect(posh.bandsOther.weak).toBeGreaterThan(posh.bandsOther.good)
  })

  it('shows a brand with no demographic character as broad or a coin toss', () => {
    const random = unit('random/random-main')!
    for (const v of ['all', 'population', 'demographics'] as const) {
      expect(random.broad[v] || Math.abs((random.auc[v] as number) - 0.5) < 0.2).toBe(true)
    }
  })

  it('splits the same way on every run', () => {
    expect(runBacktest(presence, signalRows, options)).toEqual(result)
  })

  it('can run per brand', () => {
    const byBrand = runBacktest(presence, signalRows, { ...options, level: 'brand' })
    expect(byBrand.units.map((u) => u.key).sort()).toEqual(['filler', 'posh', 'random'])
    expect(byBrand.units.find((u) => u.key === 'filler')?.broad.all).toBe(true)
  })
})

import {
  auc,
  buildProfile,
  buildSignalTable,
  demographicFit,
  midRanks,
  percentileCont,
  signalFit,
  type DemographicSignalProfile,
} from '../brand-matcher-demographics'

const signal = (over: Partial<DemographicSignalProfile>): DemographicSignalProfile => ({
  signalName: 'affluence_high',
  category: 'affluence',
  buaCount: 20,
  p10: 100,
  p25: 110,
  median: 120,
  p75: 130,
  p90: 140,
  medianRank: 0.8,
  distinctiveness: 0.6,
  ...over,
})

describe('signalFit', () => {
  const p = signal({})

  it('is a full fit across the middle half', () => {
    expect(signalFit(110, p)).toEqual({ fit: 1, position: 'typical' })
    expect(signalFit(130, p)).toEqual({ fit: 1, position: 'typical' })
  })

  it('eases to half at p10 / p90', () => {
    expect(signalFit(105, p)).toEqual({ fit: 0.75, position: 'low' })
    expect(signalFit(100, p)).toEqual({ fit: 0.5, position: 'low' })
    expect(signalFit(140, p)).toEqual({ fit: 0.5, position: 'high' })
  })

  it('falls to nothing the same distance again beyond', () => {
    expect(signalFit(95, p)).toEqual({ fit: 0.25, position: 'below' })
    expect(signalFit(90, p)).toEqual({ fit: 0, position: 'below' })
    expect(signalFit(60, p)).toEqual({ fit: 0, position: 'below' })
    expect(signalFit(145, p)).toEqual({ fit: 0.25, position: 'above' })
  })

  it('treats a collapsed tail as a hard edge', () => {
    const flat = signal({ p10: 110, p25: 110 })
    expect(signalFit(109, flat)).toEqual({ fit: 0, position: 'below' })
  })
})

describe('demographicFit', () => {
  it('is null with nothing to compare — a data gap is not a poor fit', () => {
    expect(demographicFit(null, [signal({})])).toBeNull()
    expect(demographicFit({ affluence_high: 120 }, [])).toBeNull()
    expect(demographicFit({ population: 50000 }, [signal({})])).toBeNull()
  })

  it('calls a brand with no distinctive signals a good fit anywhere', () => {
    const fit = demographicFit({ affluence_high: 60 }, [signal({ distinctiveness: 0.1 })])
    expect(fit).toEqual({ band: 'good', basis: 'broad', score: 1, signals: [] })
  })

  it('reads one signal per category — the most distinctive', () => {
    const fit = demographicFit({ affluence_high: 120, affluence_low: 40 }, [
      signal({}),
      signal({ signalName: 'affluence_low', distinctiveness: 0.5, p10: 60, p25: 70, median: 80, p75: 90, p90: 100 }),
    ])
    expect(fit?.signals.map((s) => s.signalName)).toEqual(['affluence_high'])
    expect(fit?.band).toBe('good')
  })

  it('weights signals by distinctiveness and bands the result', () => {
    const profile = [
      signal({ distinctiveness: 0.9 }),
      signal({ signalName: 'population', category: 'population', distinctiveness: 0.3, p10: 2e5, p25: 3e5, median: 3.5e5, p75: 4e5, p90: 5e5 }),
    ]
    // Affluent enough, far too small: (0.9 * 1 + 0.3 * 0) / 1.2 = 0.75
    const smallTown = demographicFit({ affluence_high: 120, population: 50_000 }, profile)
    expect(smallTown?.score).toBeCloseTo(0.75)
    expect(smallTown?.band).toBe('good')
    expect(smallTown?.signals[0].signalName).toBe('affluence_high')
    expect(smallTown?.signals[1].position).toBe('below')

    // Right size, not affluent: 0.3 / 1.2 = 0.25
    expect(demographicFit({ affluence_high: 70, population: 3.5e5 }, profile)?.band).toBe('weak')
    // Low end on both: 0.5
    expect(demographicFit({ affluence_high: 100, population: 2e5 }, profile)?.band).toBe('partial')
  })

  it('reads at most four signals', () => {
    const profile = ['a', 'b', 'c', 'd', 'e'].map((c, i) =>
      signal({ signalName: c, category: c, distinctiveness: 0.9 - i * 0.1 })
    )
    const site = Object.fromEntries(profile.map((p) => [p.signalName, 120]))
    expect(demographicFit(site, profile)?.signals.map((s) => s.signalName)).toEqual(['a', 'b', 'c', 'd'])
  })
})

describe('profile building mirrors rebuild_brand_demographic_profiles', () => {
  it('interpolates percentiles like percentile_cont', () => {
    expect(percentileCont([1, 2, 3, 4], 0.5)).toBe(2.5)
    expect(percentileCont([10, 20, 30, 40, 50], 0.1)).toBe(14)
    expect(percentileCont([7], 0.9)).toBe(7)
  })

  it('mid-ranks ties', () => {
    const ranks = midRanks(new Map([['a', 1], ['b', 2], ['c', 2], ['d', 3]]))
    expect(ranks.get('a')).toBe(0.125)
    expect(ranks.get('b')).toBe(0.5)
    expect(ranks.get('d')).toBe(0.875)
  })

  // The same towns as supabase/tests/brand-demographics/fixtures.sql: 30 towns, affluence
  // 50 + 5i, urbanity three-valued; Posh trades in towns 21..30.
  const towns = Array.from({ length: 30 }, (_, k) => k + 1)
  const code = (i: number) => `E${String(i).padStart(8, '0')}`
  const signals = new Map([
    ['affluence_high', buildSignalTable('affluence', new Map(towns.map((i) => [code(i), 50 + i * 5])))],
    ['urbanity_rural', buildSignalTable('urbanity', new Map(towns.map((i) => [code(i), 100 + (i % 3) * 5])))],
  ])

  it('reproduces the SQL fixture figures', () => {
    const posh = buildProfile(towns.slice(20).map(code), signals)
    const affluence = posh.find((p) => p.signalName === 'affluence_high')!
    expect(affluence.buaCount).toBe(10)
    expect(affluence.median).toBe(177.5)
    expect(affluence.p10).toBeCloseTo(159.5)
    expect(affluence.p90).toBeCloseTo(195.5)
    expect(affluence.medianRank).toBeCloseTo(25 / 30)
    expect(affluence.distinctiveness).toBeCloseTo(2 / 3)
    const urbanity = posh.find((p) => p.signalName === 'urbanity_rural')!
    expect(urbanity.distinctiveness).toBeCloseTo(0)
  })

  it('drops signals with fewer than eight towns', () => {
    expect(buildProfile(towns.slice(23).map(code), signals)).toEqual([])
  })
})

describe('auc', () => {
  it('is 1 when every positive outscores every negative, 0.5 for no signal', () => {
    expect(auc([3, 4], [1, 2])).toBe(1)
    expect(auc([1, 1], [1, 1])).toBe(0.5)
    expect(auc([1, 3], [2])).toBe(0.5)
    expect(auc([], [1])).toBeNaN()
  })
})

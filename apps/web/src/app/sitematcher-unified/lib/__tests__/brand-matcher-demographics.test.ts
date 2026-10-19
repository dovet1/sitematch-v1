import {
  auc,
  buildProfile,
  buildSignalTables,
  demographicFit,
  demographicMatch,
  describeDemographic,
  explainDemographic,
  possessive,
  sharePoints,
  midRanks,
  percentileCont,
  signalFit,
  siteTown,
  sizeBands,
  type DemographicSignalProfile,
  type SiteTown,
} from '../brand-matcher-demographics'

// Rank spread 0.6..0.9 around a median of 0.75: the brand's towns sit high for their size.
const signal = (over: Partial<DemographicSignalProfile>): DemographicSignalProfile => ({
  signalName: 'affluence_high',
  category: 'affluence',
  buaCount: 20,
  p10: 100,
  p25: 110,
  median: 120,
  p75: 130,
  p90: 140,
  rankP10: 0.6,
  rankP25: 0.7,
  medianRank: 0.75,
  rankP75: 0.8,
  rankP90: 0.9,
  distinctiveness: 0.5,
  ...over,
})

const site = (ranks: Record<string, number>): SiteTown => ({
  ranks,
  values: Object.fromEntries(Object.keys(ranks).map((k) => [k, 100])),
})

describe('signalFit', () => {
  const p = { p10: 100, p25: 110, p75: 130, p90: 140 }

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
    expect(signalFit(109, { ...p, p10: 110 })).toEqual({ fit: 0, position: 'below' })
  })
})

describe('demographicFit', () => {
  it('is null with nothing to compare — a data gap is not a poor fit', () => {
    expect(demographicFit(null, [signal({})])).toBeNull()
    expect(demographicFit(site({ affluence_high: 0.75 }), [])).toBeNull()
    expect(demographicFit(site({ population: 0.5 }), [signal({})])).toBeNull()
  })

  it('scores on the size-adjusted rank, not the raw value', () => {
    const fit = demographicFit({ values: { affluence_high: 60 }, ranks: { affluence_high: 0.75 } }, [signal({})])
    expect(fit?.band).toBe('good')
    expect(fit?.signals[0]).toMatchObject({ siteValue: 60, siteRank: 0.75, position: 'typical' })
  })

  it('calls a brand with no distinctive signals a good fit anywhere', () => {
    const fit = demographicFit(site({ affluence_high: 0.1 }), [signal({ distinctiveness: 0.1 })])
    expect(fit).toMatchObject({ band: 'good', basis: 'broad', score: 1, signals: [] })
  })

  it('reports town size separately and never scores it, judged on population not rank', () => {
    const profile = [
      signal({}),
      signal({ signalName: 'population', category: 'population', distinctiveness: 0.9 }),
    ]
    // A middling rank among towns its size, but far fewer people than the brand's towns.
    const fit = demographicFit(
      { ranks: { affluence_high: 0.75, population: 0.75 }, values: { affluence_high: 100, population: 50 } },
      profile
    )
    expect(fit?.score).toBe(1)
    expect(fit?.signals.map((s) => s.signalName)).toEqual(['affluence_high'])
    expect(fit?.size).toMatchObject({ signalName: 'population', position: 'below', fit: 0 })
  })

  it('a brand distinctive only by size is broad on demographics', () => {
    const fit = demographicFit({ ranks: { affluence_high: 0.2, population: 0.75 }, values: { affluence_high: 100, population: 120 } }, [
      signal({ distinctiveness: 0.1 }),
      signal({ signalName: 'population', category: 'population', distinctiveness: 0.9 }),
    ])
    expect(fit?.basis).toBe('broad')
    expect(fit?.size?.position).toBe('typical')
  })

  it('reads one signal per category — the most distinctive', () => {
    const fit = demographicFit(site({ affluence_high: 0.75, affluence_low: 0.1 }), [
      signal({}),
      signal({ signalName: 'affluence_low', distinctiveness: 0.4 }),
    ])
    expect(fit?.signals.map((s) => s.signalName)).toEqual(['affluence_high'])
  })

  it('weights signals by distinctiveness and bands the result', () => {
    const profile = [
      signal({ distinctiveness: 0.9 }),
      signal({ signalName: 'retirement_market', category: 'life_stage', distinctiveness: 0.3 }),
    ]
    // (0.9 * 1 + 0.3 * 0) / 1.2 = 0.75
    const fit = demographicFit(site({ affluence_high: 0.75, retirement_market: 0.1 }), profile)
    expect(fit?.score).toBeCloseTo(0.75)
    expect(fit?.band).toBe('good')
    expect(fit?.signals[1].position).toBe('below')
    // 0.3 / 1.2 = 0.25
    expect(demographicFit(site({ affluence_high: 0.3, retirement_market: 0.75 }), profile)?.band).toBe('weak')
    // Low end on both: 0.5
    expect(demographicFit(site({ affluence_high: 0.6, retirement_market: 0.6 }), profile)?.band).toBe('partial')
  })

  it('reads at most four signals', () => {
    const profile = ['a', 'b', 'c', 'd', 'e'].map((c, i) =>
      signal({ signalName: c, category: c, distinctiveness: 0.9 - i * 0.1 })
    )
    const s = site(Object.fromEntries(profile.map((p) => [p.signalName, 0.75])))
    expect(demographicFit(s, profile)?.signals.map((x) => x.signalName)).toEqual(['a', 'b', 'c', 'd'])
  })
})

describe('ranks and profiles mirror the SQL rebuilds', () => {
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

  // Same towns and rules as the size-band checks in supabase/tests/brand-demographics/fixtures.sql.
  const pop30 = new Map(Array.from({ length: 30 }, (_, k) => [`E${String(k + 1).padStart(8, '0')}`, (k + 1) * 10000]))
  const bandSizes = (bands: Map<string, number>) =>
    Array.from(bands.values()).reduce<Record<number, number>>((acc, b) => ({ ...acc, [b]: (acc[b] ?? 0) + 1 }), {})

  it('fills bands up to the band size, smallest towns first', () => {
    const bands = sizeBands(pop30, { bandSize: 10, minBand: 5, maxRatio: Infinity })
    expect(bandSizes(bands)).toEqual({ 1: 10, 2: 10, 3: 10 })
    expect(bands.get('E00000001')).toBe(1)
    expect(bands.get('E00000030')).toBe(3)
  })

  it('closes a band once towns more than double in size, and folds a small last band down', () => {
    // 10k-50k | 60k-120k | 130k-260k, then 270k-300k (4 towns < 5) joins the band below.
    expect(bandSizes(sizeBands(pop30, { bandSize: 200, minBand: 5, maxRatio: 2 }))).toEqual({ 1: 5, 2: 7, 3: 18 })
  })

  it('breaks population ties by code', () => {
    const tied = new Map([['b', 0], ['a', 0], ['c', 0], ['d', 5]])
    const bands = sizeBands(tied, { bandSize: 2, minBand: 1, maxRatio: Infinity })
    expect(['a', 'b', 'c', 'd'].map((t) => bands.get(t))).toEqual([1, 1, 2, 2])
  })

  // The same towns as supabase/tests/brand-demographics/fixtures.sql: 30 towns, affluence
  // 50 + 5i and population 10,000i (both rise with i), urbanity three-valued; Posh trades in
  // towns 21..30.
  const towns = Array.from({ length: 30 }, (_, k) => k + 1)
  const code = (i: number) => `E${String(i).padStart(8, '0')}`
  const raw = new Map([
    ['affluence_high', { category: 'affluence', values: new Map(towns.map((i) => [code(i), 50 + i * 5])) }],
    ['urbanity_rural', { category: 'urbanity', values: new Map(towns.map((i) => [code(i), 100 + (i % 3) * 5])) }],
    ['population', { category: 'population', values: new Map(towns.map((i) => [code(i), i * 10000])) }],
  ])
  const posh = towns.slice(20).map(code)

  it('reproduces the SQL fixture figures with one size band', () => {
    const profile = buildProfile(posh, buildSignalTables(raw))
    const affluence = profile.find((p) => p.signalName === 'affluence_high')!
    expect(affluence.buaCount).toBe(10)
    expect(affluence.median).toBe(177.5)
    expect(affluence.p10).toBeCloseTo(159.5)
    expect(affluence.p90).toBeCloseTo(195.5)
    expect(affluence.medianRank).toBeCloseTo(25 / 30)
    expect(affluence.rankP10).toBeCloseTo(21.4 / 30)
    expect(affluence.rankP90).toBeCloseTo(28.6 / 30)
    expect(affluence.distinctiveness).toBeCloseTo(2 / 3)
    expect(profile.find((p) => p.signalName === 'urbanity_rural')!.distinctiveness).toBeCloseTo(0)
  })

  it('reproduces the SQL fixture figures with bands of ten', () => {
    const profile = buildProfile(posh, buildSignalTables(raw, { bandSize: 10, minBand: 5, maxRatio: Infinity }))
    expect(profile.find((p) => p.signalName === 'affluence_high')!.distinctiveness).toBeCloseTo(0)
    expect(profile.find((p) => p.signalName === 'population')!.distinctiveness).toBeCloseTo(2 / 3)
  })

  it('gives a site its values and ranks', () => {
    const s = siteTown(code(25), buildSignalTables(raw))
    expect(s?.values.affluence_high).toBe(175)
    expect(s?.ranks.affluence_high).toBeCloseTo(24.5 / 30)
    expect(siteTown('S00000031', buildSignalTables(raw))).toBeNull()
  })

  it('drops signals with fewer than eight towns', () => {
    expect(buildProfile(towns.slice(23).map(code), buildSignalTables(raw))).toEqual([])
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

describe('demographicMatch', () => {
  const town = (ranks: Record<string, number>) => ({ ...site(ranks), townName: 'Reading' })
  const affluent = [
    signal({ distinctiveness: 0.6 }),
    signal({ signalName: 'population', category: 'population', p10: 10_000, p25: 20_000, p75: 60_000, p90: 80_000, distinctiveness: 0.8 }),
  ]
  const validated = { broad: false, aucDemographics: 0.8 }

  it('uses the fascia profile when it has one', () => {
    const d = demographicMatch({
      site: { ...town({ affluence_high: 0.75, population: 0.75 }), values: { affluence_high: 100, population: 40_000 } },
      fasciaProfile: affluent,
      fasciaScore: validated,
      brandProfile: null,
      brandScore: null,
    })
    expect(d).toMatchObject({ band: 'good', basis: 'fascia', townName: 'Reading' })
    expect(d?.reasons).toEqual([{ signalName: 'affluence_high', direction: 'higher', sitePosition: 'typical' }])
    expect(d?.size).toMatchObject({ position: 'typical', typicalMin: 20_000, typicalMax: 60_000 })
    expect(d?.breakdown).toEqual({
      score: 1,
      townCount: 20,
      backtestAuc: 0.8,
      signals: [
        {
          signalName: 'affluence_high',
          direction: 'higher',
          position: 'typical',
          siteRank: 0.75,
          median: 0.75,
          typical: [0.7, 0.8],
          range: [0.6, 0.9],
          fit: 1,
          weight: 1,
        },
      ],
    })
  })

  it('falls back to the whole brand when the fascia has no profile', () => {
    const d = demographicMatch({
      site: town({ affluence_high: 0.2 }),
      fasciaProfile: null,
      fasciaScore: null,
      brandProfile: affluent,
      brandScore: validated,
    })
    expect(d).toMatchObject({ band: 'weak', basis: 'brand' })
  })

  it('shows nothing where the backtest did not back the profile', () => {
    const base = { site: town({ affluence_high: 0.75 }), fasciaProfile: affluent, brandProfile: null, brandScore: null }
    expect(demographicMatch({ ...base, fasciaScore: { broad: false, aucDemographics: 0.6 } })).toBeNull()
    expect(demographicMatch({ ...base, fasciaScore: null })).toBeNull()
    expect(demographicMatch({ ...base, fasciaScore: { broad: false, aucDemographics: 0.65 } })).not.toBeNull()
  })

  it('says "any town" for a brand typical everywhere, with or without a backtest', () => {
    const d = demographicMatch({
      site: town({ affluence_high: 0.1 }),
      fasciaProfile: [signal({ distinctiveness: 0.1 })],
      fasciaScore: null,
      brandProfile: null,
      brandScore: null,
    })
    expect(d).toMatchObject({ band: 'any', reasons: [] })
  })

  it('shows nothing without a town or a profile', () => {
    expect(
      demographicMatch({ site: null, fasciaProfile: affluent, fasciaScore: validated, brandProfile: null, brandScore: null })
    ).toBeNull()
    expect(
      demographicMatch({ site: town({ affluence_high: 0.5 }), fasciaProfile: null, fasciaScore: null, brandProfile: null, brandScore: null })
    ).toBeNull()
  })
})

describe('describeDemographic', () => {
  it('says how the brand leans and where the town sits', () => {
    const lines = describeDemographic(
      {
        band: 'partial',
        basis: 'fascia',
        townName: 'Reading',
        reasons: [
          { signalName: 'affluence_high', direction: 'higher', sitePosition: 'typical' },
          { signalName: 'car_dependency_walkable', direction: 'lower', sitePosition: 'above' },
        ],
        size: { position: 'below', sitePopulation: 8_400, typicalMin: 20_000, typicalMax: 61_000 },
      },
      'Waitrose'
    )
    expect(lines).toEqual([
      "Compared with towns of a similar size, Waitrose's towns are more affluent and more car-dependent.",
      'Reading is in line with them on affluence, but not on walkability.',
      'Town size: Reading (8.4k people) is smaller than most of their towns; their towns are usually 20k–61k.',
    ])
  })

  it('names the whole brand when its estate stood in, and handles "any town"', () => {
    const lines = describeDemographic({ band: 'any', basis: 'brand', townName: 'Leeds', reasons: [], size: null }, 'Greggs')
    expect(lines).toEqual(["Greggs' towns (across the whole brand) are typical for their size on every measure, so Leeds fits as well as most."])
  })
})

describe('possessive', () => {
  it("does not double up a name that already ends in 's or s", () => {
    expect(possessive("Gail's")).toBe("Gail's")
    expect(possessive('Greggs')).toBe("Greggs'")
    expect(possessive('Waitrose')).toBe("Waitrose's")
  })
})

describe('sharePoints', () => {
  it('splits 100 points by weight, always adding up to 100', () => {
    expect(sharePoints([1])).toEqual([100])
    expect(sharePoints([1 / 3, 1 / 3, 1 / 3])).toEqual([34, 33, 33])
    expect(sharePoints([0.456, 0.344, 0.2])).toEqual([46, 34, 20])
  })
})

describe('explainDemographic', () => {
  // Two measures: affluence worth 0.6, walkability 0.4. Reading is typical on the first and
  // well above the brand's towns on the second.
  const profile = [
    signal({ distinctiveness: 0.6, buaCount: 34 }),
    signal({
      signalName: 'car_dependency_walkable',
      category: 'car_dependency',
      medianRank: 0.25,
      rankP10: 0.05,
      rankP25: 0.15,
      rankP75: 0.35,
      rankP90: 0.45,
      distinctiveness: 0.4,
      buaCount: 34,
    }),
  ]
  const match = () =>
    demographicMatch({
      site: { ...site({ affluence_high: 0.75, car_dependency_walkable: 0.9 }), townName: 'Reading' },
      fasciaProfile: profile,
      fasciaScore: { broad: false, aucDemographics: 0.71 },
      brandProfile: null,
      brandScore: null,
    })

  it('lists every measure with its points, where the town sits and why', () => {
    const d = match()
    expect(d?.band).toBe('partial')
    const e = explainDemographic(d!, 'Waitrose')
    expect(e.heading).toBe('Partial fit')
    expect(e.summary).toMatch(/^Reading looks partly like the kind of town Waitrose opens in\. It scores 60 out of 100 /)
    expect(e.why.map((w) => w.title)).toEqual(['Why these 2 measures', 'Why it matters', 'Why compare towns of the same size'])
    expect(e.why[0].text).toContain('These are the 2 ways their towns stand out most: more affluent and more car-dependent.')
    expect(e.why[1].text).toContain('picked the real one 71% of the time')
    expect(e.rows.map((r) => [r.topic, r.points, r.maxPoints, r.inLine])).toEqual([
      ['Affluence', 60, 60, true],
      ['Walkability', 0, 40, false],
    ])
    expect(e.rows[1]).toMatchObject({
      lean: 'Their towns: more car-dependent than most towns their size',
      // Worded the way the brand leans, so both numbers count the same way.
      site: 'Reading: more car-dependent than 10 in 100 towns its size',
      theirs: 'Their typical town: more car-dependent than 75 in 100',
      verdict: 'Does not match: more walkable than 9 in 10 of their towns',
      ends: ['more car-dependent', 'more walkable'],
    })
    expect(e.rows[0]).toMatchObject({
      site: 'Reading: more affluent than 75 in 100 towns its size',
      theirs: 'Their typical town: more affluent than 75 in 100',
      verdict: 'Matches their towns',
    })
    expect(e.basis).toBe("Built from 34 of Waitrose's towns.")
  })

  it('explains "any town" without rows or a backtest', () => {
    const d = demographicMatch({
      site: { ...site({ affluence_high: 0.1 }), townName: 'Leeds' },
      fasciaProfile: [signal({ distinctiveness: 0.1 })],
      fasciaScore: null,
      brandProfile: null,
      brandScore: null,
    })
    const e = explainDemographic(d!, 'Greggs')
    expect(e).toMatchObject({ heading: 'Any town', rows: [], why: [] })
    expect(e.summary).toContain('no pattern for Leeds to match or miss')
  })
})

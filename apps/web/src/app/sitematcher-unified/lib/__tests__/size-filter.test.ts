import {
  SIZE_BANDS,
  bandById,
  bandFitCounts,
  classify,
  distributionGeometry,
  effectiveRanges,
  entrySampleCount,
  fitFor,
  formatRequirement,
  formatSqFt,
  formatSqFtRange,
  matchingProfiles,
  near,
  overlaps,
  partitionBySize,
  sampleFootnote,
  selectProfiles,
  spreadWord,
  sqFtFromM2,
  unknownCount,
  type FloorAreaProfile,
  type SizeEntry,
} from '../size-filter'

const band = (id: string) => {
  const b = SIZE_BANDS.find((x) => x.id === id)
  if (!b) throw new Error(`no band ${id}`)
  return b
}

function profile(over: Partial<FloorAreaProfile> = {}): FloorAreaProfile {
  return {
    brandId: 'b1',
    fasciaId: null,
    fasciaName: null,
    minSqFt: 900,
    p25SqFt: 1300,
    medianSqFt: 1700,
    p75SqFt: 2200,
    maxSqFt: 3400,
    sampleCount: 300,
    coefficientOfVariation: 0.31,
    ...over,
  }
}

function entry(over: Partial<SizeEntry> = {}): SizeEntry {
  return {
    key: 'k',
    hasRequirement: false,
    requirement: null,
    profiles: [],
    sampleCount: 0,
    name: 'Brand',
    ...over,
  }
}

describe('sqFtFromM2', () => {
  it('converts and rounds to whole square feet', () => {
    expect(sqFtFromM2(100)).toBe(1076)
    expect(sqFtFromM2(1455)).toBe(15661)
  })
})

describe('selectProfiles', () => {
  it('reads a multi-format brand at fascia level and drops the brand-level row', () => {
    const rows = [
      profile({ fasciaId: null }),
      profile({ fasciaId: 'f1', fasciaName: 'Tesco Express' }),
      profile({ fasciaId: 'f2', fasciaName: 'Tesco Extra' }),
    ]
    const selected = selectProfiles(rows)
    expect(selected.map((p) => p.fasciaName)).toEqual([
      'Tesco Express',
      'Tesco Extra',
    ])
  })

  it('falls back to the brand-level row when there are no fascia rows', () => {
    const rows = [profile({ fasciaId: null })]
    expect(selectProfiles(rows)).toHaveLength(1)
    expect(selectProfiles(rows)[0].fasciaId).toBeNull()
  })

  it('returns nothing for a brand with no rows at all', () => {
    expect(selectProfiles([])).toEqual([])
  })
})

describe('overlaps / near', () => {
  const b = band('1-3') // 1,000–3,000

  it('overlaps when the ranges touch at all', () => {
    expect(overlaps(2000, 2500, b)).toBe(true)
    expect(overlaps(500, 1000, b)).toBe(true)
    expect(overlaps(3000, 9000, b)).toBe(true)
    expect(overlaps(200, 900, b)).toBe(false)
  })

  it('treats a quarter above or below the band as a near miss', () => {
    expect(near(3500, 5000, b)).toBe(true) // 3,500 <= 3,000 * 1.25
    expect(near(3800, 5000, b)).toBe(false)
    expect(near(400, 800, b)).toBe(true) // 800 >= 1,000 * 0.75
    expect(near(400, 700, b)).toBe(false)
  })

  it('is never a near miss when it already overlaps', () => {
    expect(near(2000, 2500, b)).toBe(false)
  })

  it('has no "above" near miss for the open-ended top band', () => {
    expect(near(80000, 90000, band('50+'))).toBe(false)
    expect(near(40000, 45000, band('50+'))).toBe(true) // just below
  })
})

describe('effectiveRanges', () => {
  it('matches on the requirement when there is one, ignoring the observed estate', () => {
    expect(
      effectiveRanges({ min: 1200, max: 2500 }, [profile({ p25SqFt: 40000, p75SqFt: 60000 })])
    ).toEqual([[1200, 2500]])
  })

  it('leaves an open bound open rather than inventing one', () => {
    expect(effectiveRanges({ min: 5000, max: null }, [])).toEqual([[5000, Infinity]])
    expect(effectiveRanges({ min: null, max: 5000 }, [])).toEqual([[0, 5000]])
  })

  it('falls back to each profile IQR', () => {
    expect(
      effectiveRanges(null, [
        profile({ p25SqFt: 3270, p75SqFt: 4610 }),
        profile({ p25SqFt: 95000, p75SqFt: 118000 }),
      ])
    ).toEqual([
      [3270, 4610],
      [95000, 118000],
    ])
  })

  it('is null when nothing is known — a requirement with no sq ft is not a size', () => {
    expect(effectiveRanges({ min: null, max: null }, [])).toBeNull()
    expect(effectiveRanges(null, [])).toBeNull()
  })
})

describe('fitFor', () => {
  it('grades fit, near, outside and unknown', () => {
    const b = band('3-10')
    expect(fitFor([[3000, 7000]], b)).toBe('fit')
    expect(fitFor([[11000, 12000]], b)).toBe('near')
    expect(fitFor([[40000, 60000]], b)).toBe('outside')
    expect(fitFor(null, b)).toBe('unknown')
  })

  it('lets any one fascia carry the brand', () => {
    const b = band('1-3')
    expect(
      fitFor(
        [
          [3270, 4610],
          [95000, 118000],
        ],
        b
      )
    ).toBe('near') // Express is within 25% of the band top
    expect(
      fitFor(
        [
          [2600, 4610],
          [95000, 118000],
        ],
        b
      )
    ).toBe('fit')
  })
})

describe('matchingProfiles', () => {
  const express = profile({ fasciaId: 'f1', fasciaName: 'Express', p25SqFt: 3270, p75SqFt: 4610 })
  const extra = profile({ fasciaId: 'f2', fasciaName: 'Extra', p25SqFt: 95000, p75SqFt: 118000 })

  it('shows only the formats that answer the question', () => {
    expect(matchingProfiles([express, extra], band('3-10'))).toEqual([express])
  })

  it('shows every format when no band is set', () => {
    expect(matchingProfiles([express, extra], null)).toHaveLength(2)
  })

  it('never blanks the block when nothing matches', () => {
    expect(matchingProfiles([express, extra], band('10-50'))).toHaveLength(2)
  })
})

describe('partitionBySize', () => {
  const items = [
    entry({ key: 'fit-no-req', name: 'Nando’s', profiles: [profile({ p25SqFt: 3100, p75SqFt: 4700 })], sampleCount: 210 }),
    entry({ key: 'fit-req', name: 'Jollyes', hasRequirement: true, requirement: { min: 3000, max: 7000 }, sampleCount: 61 }),
    entry({ key: 'near', name: 'PureGym', profiles: [profile({ p25SqFt: 11000, p75SqFt: 17500 })], sampleCount: 44 }),
    entry({ key: 'outside', name: 'The Range', profiles: [profile({ p25SqFt: 32000, p75SqFt: 55000 })], sampleCount: 90 }),
    entry({ key: 'unknown', name: 'Alley Cats Pizza' }),
    entry({ key: 'fit-small-sample', name: 'Zed', profiles: [profile({ p25SqFt: 3900, p75SqFt: 6600 })], sampleCount: 8 }),
  ]

  const part = partitionBySize(items, (e) => e, band('3-10'))

  it('keeps fits and near misses in the main list', () => {
    expect(part.main.map((e) => e.key)).toEqual([
      'fit-req',
      'fit-no-req',
      'fit-small-sample',
      'near',
    ])
  })

  it('separates "we do not know" from "does not fit"', () => {
    expect(part.unknown.map((e) => e.key)).toEqual(['unknown'])
    expect(part.outside.map((e) => e.key)).toEqual(['outside'])
  })

  it('never drops anything', () => {
    expect(part.main.length + part.unknown.length + part.outside.length).toBe(
      items.length
    )
  })

  it('puts a stated requirement ahead of an inferred size within the same tier', () => {
    const fitKeys = part.main.slice(0, 3)
    expect(fitKeys[0].key).toBe('fit-req')
    // then by sample count
    expect(fitKeys[1].key).toBe('fit-no-req')
  })
})

describe('bandFitCounts / unknownCount', () => {
  const entries = [
    entry({ key: 'a', profiles: [profile({ p25SqFt: 820, p75SqFt: 1380 })] }), // u1 + 1-3
    entry({ key: 'b', profiles: [profile({ p25SqFt: 3100, p75SqFt: 4700 })] }), // 3-10
    entry({ key: 'c', hasRequirement: true, requirement: { min: 8000, max: 18000 } }), // 3-10 + 10-50
    entry({ key: 'd' }),
    entry({ key: 'e', requirement: { min: null, max: null } }),
  ]

  it('counts fits per band over what is on screen', () => {
    const counts = bandFitCounts(entries)
    expect(counts.u1).toBe(1)
    expect(counts['1-3']).toBe(1)
    expect(counts['3-10']).toBe(2)
    expect(counts['10-50']).toBe(1)
    expect(counts['50+']).toBe(0)
  })

  it('counts the brands whose size is simply unknown', () => {
    expect(unknownCount(entries)).toBe(2)
  })
})

describe('number formatting', () => {
  it('rounds to the precision the data can carry', () => {
    expect(formatSqFt(842)).toBe(840)
    expect(formatSqFt(3271)).toBe(3250)
    expect(formatSqFt(47_812)).toBe(48_000)
    expect(formatSqFt(105_400)).toBe(105_000)
  })

  it('renders a range with an en dash and thousands separators', () => {
    expect(formatSqFtRange(3270, 4610)).toBe('3,250–4,600')
  })

  it('collapses a range that rounds to a single figure', () => {
    expect(formatSqFtRange(1010, 1020)).toBe('1,000')
  })

  it('keeps an open requirement bound open', () => {
    expect(formatRequirement({ min: 1200, max: 2500 })).toBe('1,200–2,500')
    expect(formatRequirement({ min: 5000, max: null })).toBe('From 5,000')
    expect(formatRequirement({ min: null, max: 5000 })).toBe('Up to 5,000')
    expect(formatRequirement({ min: null, max: null })).toBeNull()
  })
})

describe('spread and footnote', () => {
  it('says spread as a word, or says nothing', () => {
    expect(spreadWord(0.18)).toBe('tight')
    expect(spreadWord(0.41)).toBe('wide spread')
    expect(spreadWord(0.3)).toBe('')
    expect(spreadWord(null)).toBe('')
  })

  it('never emits a confidence number', () => {
    expect(sampleFootnote(profile({ sampleCount: 1240, coefficientOfVariation: 0.22 }))).toBe(
      '1,240 stores'
    )
    expect(sampleFootnote(profile({ sampleCount: 1, coefficientOfVariation: 0.18 }))).toBe(
      '1 store · tight'
    )
  })
})

describe('distributionGeometry', () => {
  it('places the IQR box and median tick as percentages of min→max', () => {
    const g = distributionGeometry(
      profile({ minSqFt: 1000, p25SqFt: 2000, medianSqFt: 3000, p75SqFt: 4000, maxSqFt: 5000 })
    )
    expect(g).toEqual({ boxLeft: 25, boxWidth: 50, medianLeft: 50 })
  })

  it('keeps a very tight distribution visible and inside the track', () => {
    const g = distributionGeometry(
      profile({ minSqFt: 1000, p25SqFt: 4980, medianSqFt: 4990, p75SqFt: 5000, maxSqFt: 5000 })
    )
    expect(g.boxWidth).toBeGreaterThanOrEqual(3)
    expect(g.boxLeft + g.boxWidth).toBeLessThanOrEqual(100)
  })

  it('does not divide by zero when every store measures the same', () => {
    const g = distributionGeometry(
      profile({ minSqFt: 2000, p25SqFt: 2000, medianSqFt: 2000, p75SqFt: 2000, maxSqFt: 2000 })
    )
    expect(Number.isFinite(g.boxLeft)).toBe(true)
    expect(Number.isFinite(g.medianLeft)).toBe(true)
  })
})

describe('misc helpers', () => {
  it('takes the largest sample behind a brand', () => {
    expect(
      entrySampleCount([profile({ sampleCount: 12 }), profile({ sampleCount: 480 })])
    ).toBe(480)
    expect(entrySampleCount([])).toBe(0)
  })

  it('resolves bands by id', () => {
    expect(bandById('3-10')?.lo).toBe(3000)
    expect(bandById(null)).toBeNull()
  })

  it('classifies an entry end to end', () => {
    expect(
      classify(
        entry({ profiles: [profile({ p25SqFt: 3270, p75SqFt: 4610 })] }),
        band('3-10')
      )
    ).toBe('fit')
  })
})

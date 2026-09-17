import { groupHighlights, highlightMeta, weekRangeLabel } from '../digest-groups'
import type { DigestHighlight } from '../types'

const h = (overrides: Partial<DigestHighlight>): DigestHighlight => ({
  applicationId: 'a', developmentId: null, reference: '26/1', authorityName: 'Kirklees', address: 'Fieldhead Lane',
  headline: 'New application · Residential', sourceUrl: null, approximateLocation: false,
  categories: ['new'], isResidential: true, isCommercial: false, dwellings: 88, stage: 'pending',
  dateReceived: '2026-09-10', dateValidated: '2026-09-12', dateDecided: null,
  ...overrides,
})

describe('groupHighlights', () => {
  it('groups new applications by use and puts decisions after them', () => {
    const groups = groupHighlights([
      h({ applicationId: 'd', categories: ['approved'], stage: 'approved', dateDecided: '2026-09-11' }),
      h({ applicationId: 'c', isResidential: false, isCommercial: true }),
      h({ applicationId: 'm', isCommercial: true }),
      h({ applicationId: 'r1', dateValidated: '2026-09-08' }),
      h({ applicationId: 'r2' }),
    ])
    expect(groups.map((g) => g.id)).toEqual(['residential', 'commercial', 'mixed', 'decided'])
    // Newest first.
    expect(groups[0].items.map((i) => i.applicationId)).toEqual(['r2', 'r1'])
  })

  it('keeps reports that predate categories in one flat group', () => {
    const groups = groupHighlights([h({ categories: undefined })])
    expect(groups).toHaveLength(1)
    expect(groups[0].id).toBe('changes')
  })
})

describe('labels', () => {
  it('writes the meta line the panel and email share', () => {
    expect(highlightMeta(h({}))).toBe('88 dwellings · Validated 12 Sep · Kirklees')
    expect(highlightMeta(h({ stage: 'approved', dateDecided: '2026-09-14' }))).toBe('88 dwellings · Approved 14 Sep · Kirklees')
  })

  it('names a week in UK dates, across a month end too', () => {
    // 7–13 September 2026: Monday 00:00 BST is Sunday 23:00 UTC.
    expect(weekRangeLabel('2026-09-06T23:00:00Z', '2026-09-13T23:00:00Z')).toBe('7–13 September 2026')
    expect(weekRangeLabel('2026-08-30T23:00:00Z', '2026-09-06T23:00:00Z', false)).toBe('31 Aug – 6 September')
  })
})

import { categoriseChanges, countChanges, evidencePacket, rankChanges, type ChangeEvent } from '../digest-select'
import { deterministicSummary, validateSummary } from '../digest-summary'
import type { MonitorRow } from '../types'

const PERIOD = { periodStart: '2026-09-13T23:00:00.000Z', periodEnd: '2026-09-20T23:00:00.000Z' }

function row(overrides: Partial<MonitorRow>): MonitorRow {
  return {
    key: overrides.applicationId ?? 'a',
    sortDate: null,
    applicationId: 'a',
    developmentId: null,
    developmentRole: null,
    familyState: null,
    matchedApplications: 1,
    providerId: 'p',
    authorityName: 'Leeds',
    reference: '26/001',
    address: '1 High Street',
    description: 'Erection of 20 homes',
    status: 'Pending',
    stage: 'pending',
    procedure: 'full',
    planningRoute: null,
    commercialWork: null,
    sourceUrl: 'https://council.example/1',
    lng: -1.5,
    lat: 53.8,
    locationProvenance: 'source_exact',
    locationUncertaintyM: 0,
    inside: true,
    nearConfirmed: null,
    dwellings: 20,
    dwellingsReviewed: false,
    isResidential: true,
    isCommercial: false,
    dateReceived: '2026-09-15',
    dateValidated: null,
    dateDecided: null,
    watched: false,
    ...overrides,
  }
}

const event = (kind: ChangeEvent['kind'], applicationId: string | null, after: Record<string, unknown> | null = null, developmentId: string | null = null): ChangeEvent => ({
  kind, applicationId, developmentId, before: null, after, observedAt: '2026-09-16T10:00:00Z',
})

describe('categoriseChanges', () => {
  it('reports an old application approved this week as a decision, not a new submission', () => {
    const old = row({ applicationId: 'old', dateReceived: '2025-02-01', stage: 'approved', dateDecided: '2026-09-16', dwellings: 120 })
    const [change] = categoriseChanges({ ...PERIOD, kind: 'scheduled', rows: [old], events: [event('stage_changed', 'old', { stage: 'approved' })] })
    expect(change.categories).toEqual(['approved'])
  })

  it('labels a late-arriving old record as newly found', () => {
    const late = row({ applicationId: 'late', dateReceived: '2026-06-01' })
    const [change] = categoriseChanges({ ...PERIOD, kind: 'scheduled', rows: [late], events: [event('observed', 'late')] })
    expect(change.categories).toEqual(['late_discovery'])
  })

  it('treats a recent record first seen this week as new', () => {
    const fresh = row({ applicationId: 'fresh', dateReceived: '2026-09-10' })
    expect(categoriseChanges({ ...PERIOD, kind: 'scheduled', rows: [fresh], events: [event('observed', 'fresh')] })[0].categories).toEqual(['new'])
  })

  it('ignores council status wording without a stage change', () => {
    const r = row({ applicationId: 'x', dateReceived: '2026-01-01' })
    expect(categoriseChanges({ ...PERIOD, kind: 'scheduled', rows: [r], events: [event('status_changed', 'x', { status: 'Under consultation' })] })).toEqual([])
  })

  it('picks up a decision dated in the period when the ledger has no event yet', () => {
    const r = row({ applicationId: 'y', dateReceived: '2026-01-01', stage: 'refused', dateDecided: '2026-09-17' })
    expect(categoriseChanges({ ...PERIOD, kind: 'scheduled', rows: [r], events: [] })[0].categories).toEqual(['refused'])
  })

  it('reads a summer week as UK calendar dates, not the UTC day before', () => {
    // Local midnight 14 Sep is 23:00 UTC on 13 Sep; the week runs 14–20 Sep inclusive.
    const sundayBefore = row({ applicationId: 'sun13', dateReceived: '2026-01-01', stage: 'approved', dateDecided: '2026-09-13' })
    const lastDay = row({ applicationId: 'sun20', dateReceived: '2026-01-01', stage: 'approved', dateDecided: '2026-09-20' })
    const changes = categoriseChanges({ ...PERIOD, kind: 'scheduled', rows: [sundayBefore, lastDay], events: [] })
    expect(changes.map((c) => c.row.applicationId)).toEqual(['sun20'])
  })

  it('treats the new-application grace window in UK dates', () => {
    // Grace starts 14 days before 14 Sep, on 31 Aug; 30 Aug is a late discovery.
    const edge = row({ applicationId: 'edge', dateReceived: '2026-08-31' })
    const before = row({ applicationId: 'before', dateReceived: '2026-08-30' })
    const changes = categoriseChanges({ ...PERIOD, kind: 'scheduled', rows: [edge, before], events: [event('observed', 'edge'), event('observed', 'before')] })
    expect(changes.map((c) => [c.row.applicationId, c.categories])).toEqual([['edge', ['new']], ['before', ['late_discovery']]])
  })

  it('maps development-level dwelling reviews to the development’s rows', () => {
    const r = row({ applicationId: 'z', developmentId: 'dev', dateReceived: '2026-01-01' })
    expect(categoriseChanges({ ...PERIOD, kind: 'scheduled', rows: [r], events: [event('dwellings_reviewed', null, null, 'dev')] })[0].categories).toEqual(['dwellings_changed'])
  })
})

describe('countChanges', () => {
  it('counts a parent permission and five follow-ons as one development of 300 homes', () => {
    const family = ['parent', 'rm1', 'rm2', 'd1', 'd2', 'd3'].map((id, i) =>
      row({ applicationId: id, developmentId: 'dev1', developmentRole: i === 0 ? 'principal' : i < 3 ? 'member' : 'condition', stage: 'approved', dateDecided: '2026-09-16', dateReceived: '2025-01-01', dwellings: 300 })
    )
    const changes = categoriseChanges({ ...PERIOD, kind: 'scheduled', rows: family, events: family.map((r) => event('decided', r.applicationId, { stage: 'approved' })) })
    const counts = countChanges(changes)
    expect(counts.approvals).toBe(6)
    expect(counts.knownNewDwellings).toBe(300)
    expect(rankChanges(changes)).toHaveLength(1)
    expect(rankChanges(changes)[0].row.applicationId).toBe('parent')
  })

  it('adds no homes when only paperwork on an existing scheme is approved', () => {
    // The 300-home permission was granted weeks ago; this week a condition and reserved matters are approved.
    const followOns = [
      row({ applicationId: 'cond', developmentId: 'dev3', developmentRole: 'condition', stage: 'approved', dateDecided: '2026-09-16', dateReceived: '2026-07-01', dwellings: 300 }),
      row({ applicationId: 'rm', developmentId: 'dev3', developmentRole: 'member', stage: 'approved', dateDecided: '2026-09-17', dateReceived: '2026-06-01', dwellings: 300 }),
      row({ applicationId: 'var', developmentId: 'dev3', developmentRole: 'amendment', stage: 'approved', dateDecided: '2026-09-18', dateReceived: '2026-06-01', dwellings: 300 }),
    ]
    const counts = countChanges(categoriseChanges({ ...PERIOD, kind: 'scheduled', rows: followOns, events: followOns.map((r) => event('decided', r.applicationId, { stage: 'approved' })) }))
    expect(counts.approvals).toBe(3)
    expect(counts.knownNewDwellings).toBe(0)
  })

  it('counts a standalone approval that belongs to no development', () => {
    const r = row({ applicationId: 'solo', stage: 'approved', dateDecided: '2026-09-16', dwellings: 40 })
    expect(countChanges(categoriseChanges({ ...PERIOD, kind: 'scheduled', rows: [r], events: [] })).knownNewDwellings).toBe(40)
  })

  it('keeps a family awaiting its original out of confident totals', () => {
    const r = row({ applicationId: 'u', developmentId: 'dev2', familyState: 'awaiting_original', stage: 'approved', dateDecided: '2026-09-16', dwellings: 80 })
    const counts = countChanges(categoriseChanges({ ...PERIOD, kind: 'scheduled', rows: [r], events: [event('decided', 'u', { stage: 'approved' })] }))
    expect(counts.knownNewDwellings).toBe(0)
    expect(counts.unresolvedFamilies).toBe(1)
  })

  it('never invents a home count for an unknown figure', () => {
    const commercial = row({ applicationId: 'c', isResidential: false, isCommercial: true, dwellings: null, stage: 'approved', dateDecided: '2026-09-16' })
    const counts = countChanges(categoriseChanges({ ...PERIOD, kind: 'scheduled', rows: [commercial], events: [event('decided', 'c', { stage: 'approved' })] }))
    expect(counts.knownNewDwellings).toBe(0)
  })
})

describe('evidencePacket', () => {
  it('never passes store proximity for an approximate location', () => {
    const approx = row({ applicationId: 'q', locationProvenance: 'source_centroid', nearConfirmed: true })
    const { items } = evidencePacket(rankChanges(categoriseChanges({ ...PERIOD, kind: 'scheduled', rows: [approx], events: [event('observed', 'q')] })))
    expect(items[0]).toMatchObject({ approximateLocation: true, nearSelectedStores: null })
  })
})

describe('validateSummary', () => {
  const items = evidencePacket(rankChanges(categoriseChanges({
    ...PERIOD,
    kind: 'scheduled',
    rows: [row({ applicationId: 'k', stage: 'approved', dateDecided: '2026-09-16', dwellings: 320, reference: '26/0042', watched: true })],
    events: [event('decided', 'k', { stage: 'approved' })],
  }))).items
  const counts = { newApplications: 0, newDevelopments: 0, decisions: 1, approvals: 1, refusals: 0, withdrawals: 0, lateDiscoveries: 0, knownNewDwellings: 320, unresolvedFamilies: 0, watchedChanges: 1 }
  const context = { items, counts, periodLabel: '14 Sept – 20 Sept 2026', patchName: 'Leeds' }
  const good = {
    overview: 'One scheme was approved this week: 320 homes at 1 High Street (26/0042).',
    keyChanges: [{ text: 'Approval of 320 homes at 1 High Street.', evidence: ['E1'] }],
    residentialTheme: null,
    commercialTheme: null,
    watchedChanges: [{ text: 'A development you watch was approved.', evidence: ['E1'] }],
    caveats: [],
  }

  it('accepts a grounded summary', () => {
    expect(validateSummary(good, context).ok).toBe(true)
  })

  it('rejects unknown evidence ids', () => {
    expect(validateSummary({ ...good, keyChanges: [{ text: 'Something else.', evidence: ['E9'] }] }, context)).toMatchObject({ ok: false })
  })

  it('rejects numbers that are not in the evidence', () => {
    expect(validateSummary({ ...good, overview: 'Approved 350 homes, adding about 700 people.' }, context)).toMatchObject({ ok: false })
  })

  it('rejects population and spend claims', () => {
    const result = validateSummary({ ...good, overview: 'Approval of 320 homes will bring new residents and grocery spend.' }, context)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reasons.join()).toMatch(/residents|spending/)
  })

  it('rejects operator claims the description does not make', () => {
    expect(validateSummary({ ...good, commercialTheme: 'The operator is likely a discounter.' }, context)).toMatchObject({ ok: false })
  })

  it('rejects a completion claim', () => {
    expect(validateSummary({ ...good, overview: 'The 320 homes have been built at 1 High Street.' }, context)).toMatchObject({ ok: false })
  })

  it('rejects extra fields (structured output is not trusted to be strict)', () => {
    expect(validateSummary({ ...good, growthForecast: 'x' }, context).ok).toBe(false)
  })
})

describe('deterministicSummary', () => {
  it('writes a quiet-week report without a model', () => {
    const counts = { newApplications: 0, newDevelopments: 0, decisions: 0, approvals: 0, refusals: 0, withdrawals: 0, lateDiscoveries: 0, knownNewDwellings: 0, unresolvedFamilies: 0, watchedChanges: 0 }
    expect(deterministicSummary({ counts, kind: 'scheduled', reason: 'no_changes', coverageNote: null }).overview).toBe('No matching changes this week.')
  })

  it('states plainly when the AI summary is unavailable', () => {
    const counts = { newApplications: 3, newDevelopments: 2, decisions: 1, approvals: 1, refusals: 0, withdrawals: 0, lateDiscoveries: 0, knownNewDwellings: 40, unresolvedFamilies: 0, watchedChanges: 0 }
    const summary = deterministicSummary({ counts, kind: 'scheduled', reason: 'model_unavailable', coverageNote: null })
    expect(summary.overview).toBe('This week: 3 new matching applications (2 developments); 1 decision (1 approved). Approved schemes with a known count total 40 homes; approval is permission, not completion.')
    expect(summary.caveats[0]).toMatch(/AI summary is unavailable/)
  })
})

import {
  adminFactValue,
  attemptOutcome,
  chosenFactValue,
  findingsFromDescription,
  findingsFromResearch,
  refreshFactRows,
  nextFactRows,
  publicFacts,
  toSquareMetres,
  type FactAttempt,
  type FactRow,
} from '../facts'
import type { PlanningResearchResult } from '../types'

const FORM = 'https://council.test/form.pdf'
const at = '2026-09-14T20:00:00.000Z'

function result(overrides: Partial<PlanningResearchResult> = {}): PlanningResearchResult {
  return {
    signals: [], commercialFloorspace: [], useClasses: [], siteAreas: [], partyClues: [],
    noOperatorReason: '', researchMemo: '', webCitations: [], webSearchRequests: 1,
    model: 'test', inputTokens: null, outputTokens: null, costUsd: null,
    ...overrides,
  }
}

function floor(scope: 'existing' | 'lost' | 'proposed' | 'net', sqm: number, extra: Record<string, unknown> = {}) {
  return {
    scope, sqm, measurementBasis: 'gross_internal' as const, evidenceSource: 'document' as const,
    evidenceUrl: FORM, evidenceExcerpt: `${scope} gross internal floorspace ${sqm}`, evidencePage: '10',
    confidence: 1, ...extra,
  }
}

const attempt = (outcome: FactAttempt['outcome'] = 'documents_silent', runId = 'run-1'): FactAttempt => ({
  runId, at, outcome, documentsRetrieved: 1, retrievalWarnings: [], webSearches: 1,
})

function rows(research: PlanningResearchResult, stored: FactRow[] = [], outcome: FactAttempt['outcome'] = 'documents_silent') {
  const next = nextFactRows({ stored, incoming: findingsFromResearch(research, { runId: 'run-1', at }), attempt: attempt(outcome) })
  return Object.fromEntries(next.map(row => [row.fact, row]))
}

describe('fact completeness', () => {
  it('never lets the existing area answer the proposed one', () => {
    const facts = rows(result({ commercialFloorspace: [floor('existing', 347)] }))
    expect(facts.existing_floorspace).toMatchObject({ state: 'found', value: { sqm: 347, basis: 'gross_internal' } })
    expect(facts.proposed_floorspace).toMatchObject({ state: 'not_found_after_research', reason: 'documents_silent' })
  })

  it('does not complete a whole-development fact from a unit or phase figure', () => {
    const facts = rows(result({ commercialFloorspace: [floor('proposed', 120, { extent: 'unit' })] }))
    expect(facts.proposed_floorspace.state).toBe('not_found_after_research')
    expect(facts.proposed_floorspace.findings).toHaveLength(1)
    expect(facts.proposed_floorspace.findings[0]).toMatchObject({ completes: false, extent: 'unit' })
  })

  it('keeps floor area lost as context, not as the existing area', () => {
    const facts = rows(result({ commercialFloorspace: [floor('lost', 200)] }))
    expect(facts.existing_floorspace.state).toBe('not_found_after_research')
    expect(facts.existing_floorspace.findings[0].completes).toBe(false)
  })

  it('never counts an applicant, developer or agent as the operator', () => {
    const facts = rows(result({
      signals: [{ name: 'Acme Developments Ltd', role: 'applicant_developer', evidenceSource: 'document', evidenceUrl: FORM, evidenceExcerpt: 'Applicant: Acme Developments Ltd', confidence: 0.9 }],
      partyClues: [{ name: 'Squires Planning', role: 'agent', evidenceSource: 'document', evidenceUrl: FORM, evidenceExcerpt: 'Agent Squires Planning', evidencePage: '2', confidence: 1 }],
    }))
    expect(facts.operator.state).toBe('not_found_after_research')
    expect(facts.operator.findings).toHaveLength(2)
  })

  it('finds a named proposed occupier', () => {
    const facts = rows(result({
      signals: [{ name: 'Costco', role: 'proposed_occupier', evidenceSource: 'web', evidenceUrl: 'https://news.test/costco', evidenceExcerpt: 'Costco will occupy the warehouse club', confidence: 0.9 }],
    }))
    expect(facts.operator).toMatchObject({ state: 'found', value: { names: ['Costco'] } })
  })

  it('derives net only from existing and proposed figures with the same basis and extent', () => {
    const same = rows(result({ commercialFloorspace: [floor('existing', 347), floor('proposed', 500)] }))
    expect(same.net_floorspace).toMatchObject({ state: 'found', value: { sqm: 153 } })
    expect(same.net_floorspace.findings[0].source.kind).toBe('derived')

    const unlike = rows(result({ commercialFloorspace: [floor('existing', 347), floor('proposed', 500, { measurementBasis: 'gross_external' })] }))
    expect(unlike.net_floorspace.state).toBe('not_found_after_research')
  })

  it('marks different figures for the same basis as conflicting, but not different bases', () => {
    const conflict = rows(result({ commercialFloorspace: [floor('proposed', 500), floor('proposed', 800, { evidenceUrl: 'https://council.test/statement.pdf' })] }))
    expect(conflict.proposed_floorspace.state).toBe('conflicting')

    const bases = rows(result({ commercialFloorspace: [floor('proposed', 500), floor('proposed', 540, { measurementBasis: 'gross_external' })] }))
    expect(bases.proposed_floorspace).toMatchObject({ state: 'found', value: { sqm: 500, basis: 'gross_internal' } })
  })

  it('keeps site area separate and converts it while retaining the original unit', () => {
    const facts = rows(result({
      siteAreas: [{ phase: 'unspecified', value: 0.5, unit: 'hectares', evidenceSource: 'document', evidenceUrl: FORM, evidenceExcerpt: 'Site area 0.5 hectares', evidencePage: '4', confidence: 1 }],
    }))
    expect(facts.site_area).toMatchObject({ state: 'found', value: { sqm: 5000, original: { value: 0.5, unit: 'hectares' } } })
    expect(facts.proposed_floorspace.state).toBe('not_found_after_research')
    expect(toSquareMetres(6792, 'sqft')).toBeCloseTo(631, 0)
  })

  it('keeps an earlier finding when a later run returns nothing', () => {
    const first = nextFactRows({
      stored: [], incoming: findingsFromResearch(result({ commercialFloorspace: [floor('proposed', 500)] }), { runId: 'run-1', at }), attempt: attempt(),
    })
    const second = nextFactRows({
      stored: first, incoming: findingsFromResearch(result(), { runId: 'run-2', at }), attempt: attempt('documents_inaccessible', 'run-2'),
    })
    const proposed = second.find(row => row.fact === 'proposed_floorspace')!
    expect(proposed).toMatchObject({ state: 'found', value: { sqm: 500 } })
    expect(proposed.attempts).toHaveLength(2)
  })

  it('stores a repeated finding once', () => {
    const research = result({ commercialFloorspace: [floor('proposed', 500)] })
    const first = nextFactRows({ stored: [], incoming: findingsFromResearch(research, { runId: 'run-1', at }), attempt: attempt() })
    const second = nextFactRows({ stored: first, incoming: findingsFromResearch(research, { runId: 'run-2', at }), attempt: attempt() })
    expect(second.find(row => row.fact === 'proposed_floorspace')!.findings).toHaveLength(1)
  })

  it('never overwrites an admin decision, but attaches the new evidence', () => {
    const unavailable: FactRow = {
      fact: 'operator', state: 'unavailable', reason: null, value: null, findings: [], attempts: [],
      decided_by: 'admin-1', decided_at: at,
    }
    const facts = rows(result({
      signals: [{ name: 'Costco', role: 'proposed_occupier', evidenceSource: 'web', evidenceUrl: 'https://news.test/costco', evidenceExcerpt: 'Costco will occupy the site', confidence: 0.9 }],
    }), [unavailable])
    expect(facts.operator).toMatchObject({ state: 'unavailable', decided_by: 'admin-1' })
    expect(facts.operator.findings).toHaveLength(1)
  })

  it('keeps an admin rejection of a finding across a repeat run', () => {
    const research = result({ commercialFloorspace: [floor('proposed', 500), floor('proposed', 800, { evidenceUrl: 'https://council.test/statement.pdf' })] })
    const first = nextFactRows({ stored: [], incoming: findingsFromResearch(research, { runId: 'run-1', at }), attempt: attempt() })
    const proposed = first.find(row => row.fact === 'proposed_floorspace')!
    proposed.findings = proposed.findings.map(f => f.sqm === 800 ? { ...f, rejected: true } : f)
    const second = nextFactRows({ stored: first, incoming: findingsFromResearch(research, { runId: 'run-2', at }), attempt: attempt() })
    expect(second.find(row => row.fact === 'proposed_floorspace')).toMatchObject({ state: 'found', value: { sqm: 500 } })
  })

  it('names why an attempt ended without facts', () => {
    expect(attemptOutcome({ documentsRetrieved: 0, councilPageRetrieved: false, failed: false, attemptLimitReached: false })).toBe('documents_inaccessible')
    expect(attemptOutcome({ documentsRetrieved: 2, councilPageRetrieved: true, failed: false, attemptLimitReached: false })).toBe('documents_silent')
    expect(attemptOutcome({ documentsRetrieved: 0, councilPageRetrieved: false, failed: true, attemptLimitReached: true })).toBe('attempt_limit')
    expect(attemptOutcome({ documentsRetrieved: 1, councilPageRetrieved: true, failed: false, attemptLimitReached: false,
      warnings: ['Document portal is disallowed by robots.txt: planning2.wandsworth.gov.uk', 'No application PDF retrieved; floor area and site area may be missing'] })).toBe('documents_inaccessible')
    const blocked = rows(result(), [], 'documents_inaccessible')
    expect(blocked.proposed_floorspace).toMatchObject({ state: 'not_found_after_research', reason: 'documents_inaccessible' })
  })
})

describe('admin fact entry', () => {
  it('requires evidence and refuses a unit figure as a whole-development area', () => {
    expect(() => adminFactValue({ fact: 'proposed_floorspace', area: { value: 500, unit: 'sqm', extent: 'unspecified', basis: 'gross_internal' }, source: { url: null, excerpt: '', page: null } }, 'admin-1', at))
      .toThrow('source')
    expect(() => adminFactValue({ fact: 'proposed_floorspace', area: { value: 500, unit: 'sqm', extent: 'unit', basis: 'gross_internal' }, source: { url: FORM, excerpt: null, page: null } }, 'admin-1', at))
      .toThrow('cannot complete')
  })

  it('converts an entered area and keeps the original unit', () => {
    const { value, finding } = adminFactValue({ fact: 'site_area', area: { value: 1.5, unit: 'acres', extent: 'whole_development', basis: 'unspecified' }, source: { url: FORM, excerpt: null, page: '4' } }, 'admin-1', at)
    expect(value).toMatchObject({ sqm: 6070.28, original: { value: 1.5, unit: 'acres' } })
    expect(finding).toMatchObject({ origin: 'admin', completes: true, source: { kind: 'manual', page: '4' } })
  })

  it('chooses one conflicting figure and rejects the rest', () => {
    const research = result({ commercialFloorspace: [floor('proposed', 500), floor('proposed', 800, { evidenceUrl: 'https://council.test/statement.pdf' })] })
    const row = rows(research).proposed_floorspace
    const keep = row.findings.find(f => f.sqm === 800)!
    const { value, rejectKeys } = chosenFactValue(row, keep.key)
    expect(value).toMatchObject({ sqm: 800 })
    expect(rejectKeys).toEqual([row.findings.find(f => f.sqm === 500)!.key])
  })
})

describe('publicFacts', () => {
  it('publishes found facts with their sources and never an applicant or agent', () => {
    const facts = rows(result({
      commercialFloorspace: [floor('proposed', 500)],
      partyClues: [{ name: 'Mr Private Person', role: 'applicant', evidenceSource: 'document', evidenceUrl: FORM, evidenceExcerpt: 'Applicant Mr Private Person', evidencePage: '2', confidence: 1 }],
    }))
    const published = publicFacts(Object.values(facts))
    expect(published.find(f => f.fact === 'proposed_floorspace')).toMatchObject({ state: 'found', value: '500 m², gross internal', sources: [{ url: FORM, page: '10' }] })
    expect(published.find(f => f.fact === 'operator')).toMatchObject({ state: 'not_established', value: null, sources: [] })
    expect(JSON.stringify(published)).not.toContain('Private Person')
  })

  it('shows nothing before anyone has looked at the scheme', () => {
    expect(publicFacts([{ fact: 'operator', state: 'not_checked', value: null, findings: [], decided_by: null }])).toEqual([])
  })
})

describe('use classes from the description', () => {
  const read = (description: string) => {
    const found = findingsFromDescription(description, { councilUrl: 'https://council.test/app', at })
    return { existing: found.existing_use_class.map(f => f.useClass), proposed: found.proposed_use_class.map(f => f.useClass) }
  }

  it.each([
    ['Change of use from former garage (Class B2 General Industry) to indoor parkour facility (Class E(d) Indoor sport, recreation and fitness)', ['B2'], ['E(d)']],
    ['Change of use from B8 (storage and distribution) use to a flexible employment use comprising Classes E(g)(iii), B2 and B8', ['B8'], ['E(g)(iii)', 'B2', 'B8']],
    ['Use of lower ground premises as public house (Sui Generis).', [], ['Sui Generis']],
    ['Use of ground floor office (Class 4) as restaurant (Class 3), external alterations', [], ['4', '3']],
    ['Change of use of former garage site to a self-storage facility including the siting of 11 storage containers', [], []],
    ['Erection of a building to form an indoor padel facility for three padel courts', [], []],
  ])('reads "%s"', (description, existing, proposed) => {
    expect(read(description)).toEqual({ existing, proposed })
  })

  it('marks use classes from two sources with nothing in common as conflicting, and lets an admin choose a source', () => {
    const research = result({ useClasses: [
      { phase: 'proposed', useClass: 'A2', evidenceSource: 'council_page', evidenceUrl: 'https://council.test/app', evidenceExcerpt: 'Proposed Land Use A2, C3', evidencePage: null, confidence: 0.9 },
      { phase: 'proposed', useClass: 'C3', evidenceSource: 'council_page', evidenceUrl: 'https://council.test/app', evidenceExcerpt: 'Proposed Land Use A2, C3', evidencePage: null, confidence: 0.9 },
    ] })
    const incoming = findingsFromResearch(research, { runId: 'run-1', at })
    incoming.proposed_use_class.push(...findingsFromDescription('use of basement for flexible office (Class E(g)(i)) / gallery (Class F1) uses', { councilUrl: 'https://council.test/app', at }).proposed_use_class)
    const [row] = nextFactRows({ stored: [], incoming, attempt: attempt() }).filter(r => r.fact === 'proposed_use_class')
    expect(row.state).toBe('conflicting')
    const office = row.findings.find(f => f.useClass === 'E(g)(i)')!
    const { value, rejectKeys } = chosenFactValue(row, office.key)
    expect(value).toEqual({ useClasses: ['E(g)(i)', 'F1'] })
    expect(rejectKeys).toHaveLength(2)
  })

  it('agrees when the description and the council page name the same class', () => {
    const research = result({ useClasses: [{ phase: 'proposed', useClass: 'E(d)', evidenceSource: 'council_page', evidenceUrl: 'https://council.test/app', evidenceExcerpt: 'to indoor parkour facility (Class E(d))', evidencePage: null, confidence: 0.9 }] })
    const stored = nextFactRows({ stored: [], incoming: findingsFromResearch(research, { runId: 'run-1', at }), attempt: attempt() })
    const refreshed = refreshFactRows(stored, findingsFromDescription('Change of use from former garage (Class B2) to indoor parkour facility (Class E(d))', { councilUrl: 'https://council.test/app', at }))
    expect(refreshed.find(r => r.fact === 'proposed_use_class')).toMatchObject({ state: 'found', value: { useClasses: ['E(d)'] } })
    expect(refreshed.find(r => r.fact === 'existing_use_class')).toMatchObject({ state: 'found', value: { useClasses: ['B2'] } })
  })
})

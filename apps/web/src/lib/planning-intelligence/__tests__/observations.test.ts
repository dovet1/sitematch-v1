import { developmentSummary, partitionObservations, shouldEscalate } from '../classify'
import { planningClassificationJsonSchema, planningClassificationSchema } from '../openrouter'
import type { PlanningClassification } from '../types'

type Observation = PlanningClassification['observations'][number]

const observation = (overrides: Partial<Observation> = {}): Observation => ({
  metric: 'commercial_floorspace',
  scope: 'stated_unspecified',
  action: 'create',
  value: 250,
  unit: 'sqm',
  evidence: 'a 250 sqm retail unit',
  confidence: 0.9,
  ...overrides,
})

const classification = (observations: Observation[], unansweredQuestions: string[] = []) =>
  ({ observations, unansweredQuestions } as PlanningClassification)

describe('partitionObservations', () => {
  it('stores an observation the source actually quantifies', () => {
    const { storable, gaps } = partitionObservations(classification([observation()]))
    expect(storable).toHaveLength(1)
    expect(gaps).toEqual([])
  })

  // The live failure: evidence described a health centre, a pharmacy and two commercial
  // units, while the stored value asserted zero floorspace at 0.85 confidence.
  it('never stores an unquantified figure as zero', () => {
    const { storable, gaps } = partitionObservations(classification([
      observation({
        value: null,
        confidence: 0.85,
        evidence: 'new health centre (Class E), pharmacy (Class E), and two commercial units',
      }),
    ]))
    expect(storable).toEqual([])
    expect(gaps).toEqual([
      'commercial_floorspace (stated_unspecified) is referred to but not quantified in the application text.',
    ])
  })

  it('drops an unknown action, which carries no usable measurement', () => {
    const { storable, gaps } = partitionObservations(classification([
      observation({ action: 'unknown', value: 0 }),
    ]))
    expect(storable).toEqual([])
    expect(gaps).toHaveLength(1)
  })

  it('keeps a genuine stated zero, which is a real measurement', () => {
    const { storable, gaps } = partitionObservations(classification([
      observation({ value: 0, action: 'remove', evidence: 'no commercial floorspace is proposed' }),
    ]))
    expect(storable).toHaveLength(1)
    expect(storable[0].value).toBe(0)
    expect(gaps).toEqual([])
  })

  it('surfaces gaps alongside the model’s own unanswered questions, without duplicates', () => {
    const { storable, gaps } = partitionObservations(classification(
      [
        observation({ value: null }),
        observation({ value: null }),
        observation({ value: 113, action: 'create' }),
      ],
      ['What is the net change in floor area?']
    ))
    expect(storable).toHaveLength(1)
    expect(gaps).toHaveLength(1)
    expect([...['What is the net change in floor area?'], ...gaps]).toHaveLength(2)
  })
})

describe('classification schema', () => {
  const valid = {
    relevance: 'high',
    confidence: 0.8,
    substantiveProposal: 'New retail unit',
    commercialSpace: { creates: 'yes', useClasses: ['E'], evidence: 'new retail unit', confidence: 0.9 },
    dwellings: { count: null, basis: 'not_stated', evidence: '', confidence: 0.8 },
    brandMentions: [],
    observations: [],
    reasons: [],
    uncertainties: [],
    unansweredQuestions: [],
  }

  it('accepts a null observation value so the model can decline to guess', () => {
    const parsed = planningClassificationSchema.parse({
      ...valid,
      observations: [{ ...observation(), value: null }],
    })
    expect(parsed.observations[0].value).toBeNull()
  })

  it('requires an overall confidence, so developments.confidence is never null', () => {
    const { confidence, ...withoutConfidence } = valid
    expect(() => planningClassificationSchema.parse(withoutConfidence)).toThrow()
    expect(planningClassificationSchema.parse({ ...valid, confidence: 0 }).confidence).toBe(0)
    expect(planningClassificationSchema.parse({ ...valid, confidence: 1 }).confidence).toBe(1)
    expect(() => planningClassificationSchema.parse({ ...valid, confidence: 1.5 })).toThrow()
  })

  it('rejects a bare enum echoed into substantiveProposal at the schema level', () => {
    expect(() => planningClassificationSchema.parse({ ...valid, substantiveProposal: 'mixed_use' }))
      .not.toThrow() // zod allows it; the minLength guard lives in the JSON schema
    expect(planningClassificationJsonSchema.properties.substantiveProposal.minLength).toBe(12)
  })

  it('still rejects a negative quantity', () => {
    expect(() => planningClassificationSchema.parse({
      ...valid,
      observations: [{ ...observation(), value: -5 }],
    })).toThrow()
  })

  // The distinction the whole calibration exercise turns on. A null count means the
  // application does not say; a zero asserts it says none, and would be summed as one.
  it('keeps a null dwelling count distinct from a stated zero', () => {
    const notStated = planningClassificationSchema.parse({
      ...valid,
      dwellings: { count: null, basis: 'not_stated', evidence: '', confidence: 0.6 },
    })
    expect(notStated.dwellings.count).toBeNull()

    const statedNone = planningClassificationSchema.parse({
      ...valid,
      dwellings: { count: 0, basis: 'stated', evidence: 'no residential units proposed', confidence: 0.9 },
    })
    expect(statedNone.dwellings.count).toBe(0)
  })

  it('rejects a negative dwelling count', () => {
    expect(() => planningClassificationSchema.parse({
      ...valid,
      dwellings: { count: -1, basis: 'stated', evidence: 'x', confidence: 0.5 },
    })).toThrow()
  })

  // The two questions are orthogonal on purpose: a block of flats over a shop answers both,
  // and nothing has to decide which half of the scheme dominates.
  it('accepts a scheme that both creates commercial space and creates homes', () => {
    const parsed = planningClassificationSchema.parse({
      ...valid,
      commercialSpace: { creates: 'yes', useClasses: ['E'], evidence: 'two class E shops', confidence: 0.9 },
      dwellings: { count: 3, basis: 'counted_from_description', evidence: 'three flats', confidence: 0.9 },
    })
    expect(parsed.commercialSpace.creates).toBe('yes')
    expect(parsed.dwellings.count).toBe(3)
  })

  it('no longer carries the retired fields', () => {
    for (const retired of ['opportunityType', 'developmentType', 'needsDetail', 'needsDocuments', 'needsWebResearch']) {
      expect(planningClassificationJsonSchema.required).not.toContain(retired)
      expect(Object.keys(planningClassificationJsonSchema.properties)).not.toContain(retired)
    }
  })

  // Dwellings became a first-class field, so the observation list is floorspace only.
  it('rejects a dwellings observation, which is superseded by the dwellings field', () => {
    expect(() => planningClassificationSchema.parse({
      ...valid,
      observations: [{ ...observation(), metric: 'dwellings', unit: 'count' }],
    })).toThrow()
  })
})

describe('shouldEscalate', () => {
  const at = (relevance: string, creates: string) =>
    ({ relevance, commercialSpace: { creates } } as unknown as PlanningClassification)

  // The gate that decides what we pay a more expensive model to research. High relevance
  // alone is not enough: without a unit changing hands there is no operator to find.
  it('escalates only a high-relevance record that creates or changes commercial space', () => {
    expect(shouldEscalate(at('high', 'yes'))).toBe(true)
    expect(shouldEscalate(at('high', 'no'))).toBe(false)
    expect(shouldEscalate(at('high', 'unclear'))).toBe(false)
    expect(shouldEscalate(at('medium', 'yes'))).toBe(false)
    expect(shouldEscalate(at('low', 'yes'))).toBe(false)
  })
})

describe('developmentSummary', () => {
  const description =
    'Details of Cycle Parking pursuant to planning permission dated 02/10/2024 ref 2023/4840'

  // Both values below are exactly what the live model returned on 8 Sep 2026.
  it('keeps a real prose summary', () => {
    expect(developmentSummary(
      'Replacement of existing floodlit clay tennis courts with five covered padel courts',
      description
    )).toBe('Replacement of existing floodlit clay tennis courts with five covered padel courts')
  })

  it('rejects a bare enum echoed into the summary', () => {
    expect(developmentSummary('mixed_use', description)).toBe(description)
  })

  it('rejects any bare snake_case token, not just the known enum values', () => {
    expect(developmentSummary('some_new_category', description)).toBe(description)
  })

  it('falls back when the model returns nothing usable', () => {
    expect(developmentSummary('', description)).toBe(description)
    expect(developmentSummary('   ', description)).toBe(description)
    expect(developmentSummary(null, description)).toBe(description)
  })

  it('returns null rather than an empty string when there is no description either', () => {
    expect(developmentSummary('mixed_use', null)).toBeNull()
    expect(developmentSummary(null, '')).toBeNull()
  })

  it('keeps prose that merely contains an enum-like word', () => {
    const prose = 'A mixed_use scheme of flats above retail'
    expect(developmentSummary(prose, description)).toBe(prose)
  })

  it('caps a very long fallback', () => {
    const long = 'x'.repeat(900)
    expect(developmentSummary('mixed_use', long)).toHaveLength(400)
  })
})

import { buildAliasIndex } from '@/lib/epc/aliases'
import { MAJOR_HOUSING_DWELLINGS, classificationInputHash, decideEligibility, isDetailSubmission } from '../eligibility'
import type { PlotaApplication } from '../types'

const aliases = buildAliasIndex(
  [
    { id: 'aldi', name: 'Aldi' },
    { id: 'next', name: 'Next' },
  ],
  []
)

function application(overrides: Partial<PlotaApplication> = {}): PlotaApplication {
  return {
    id: 'p1',
    reference: '26/00001/FUL',
    authority: { slug: 'test', name: 'Test Council' },
    description: 'Minor alterations',
    ...overrides,
  }
}

describe('planning intelligence eligibility', () => {
  it.each(['new', 'to-commercial', 'between'] as const)(
    'promotes commercial supply limb A: %s',
    (commercial_work) => {
      expect(decideEligibility(application({ commercial_work }), aliases).limbs).toEqual(['A'])
    }
  )

  // The boundary moved from 16 to 15 on the domain expert's own wording: not interested
  // "below 15 dwellings" puts a 15-unit scheme inside the net. Asserted against the shared
  // constant rather than a literal, so the filter and the evaluation scripts cannot drift apart.
  it('promotes a scheme at the major-housing threshold but not one below it', () => {
    expect(decideEligibility(application({ dwelling_count: MAJOR_HOUSING_DWELLINGS - 1 }), aliases).intelligenceTier).toBe(false)
    expect(decideEligibility(application({ dwelling_count: MAJOR_HOUSING_DWELLINGS }), aliases).limbs).toEqual(['B'])
  })

  it('keeps commercial loss as its own limb', () => {
    expect(decideEligibility(application({ commercial_work: 'loss' }), aliases).limbs).toEqual(['D'])
  })

  it('records brand hits before enabling limb C', () => {
    const result = decideEligibility(application({ description: 'New Aldi foodstore' }), aliases)
    expect(result.intelligenceTier).toBe(false)
    expect(result.brandHits).toContainEqual({
      brandId: 'aldi', observedAlias: 'ALDI', source: 'description', ambiguous: false,
    })
  })

  it('allows a distinctive description hit to activate limb C after the feature gate', () => {
    const result = decideEligibility(
      application({ description: 'New Aldi foodstore' }),
      aliases,
      { brandLimbEnabled: true }
    )
    expect(result.limbs).toEqual(['C'])
  })

  it('never promotes an address-only or ambiguous alias hit', () => {
    const address = decideEligibility(
      application({ address: 'Former Aldi, High Street' }), aliases, { brandLimbEnabled: true }
    )
    const ambiguous = decideEligibility(
      application({ description: 'Alterations at Next' }), aliases, { brandLimbEnabled: true }
    )
    expect(address.intelligenceTier).toBe(false)
    expect(ambiguous.intelligenceTier).toBe(false)
  })

  it('changes the input hash only when classification inputs change', () => {
    const base = application({ status: 'Awaiting decision', stage: 'pending' })
    expect(classificationInputHash({ ...base, documents_count: 10 }))
      .toBe(classificationInputHash({ ...base, documents_count: 99 }))
    expect(classificationInputHash({ ...base, stage: 'approved' }))
      .not.toBe(classificationInputHash(base))
  })
})


describe('detail submissions against an existing consent', () => {
  const app = (description: string, extra: Record<string, unknown> = {}) =>
    ({
      id: 'x', reference: 'R/1', authority: { slug: 'a', name: 'A' },
      description, ...extra,
    } as never)

  // Both descriptions are taken verbatim from live Plota records (Wandsworth, Sep 2026).
  it('excludes a details submission that inherits the parent dwelling count', () => {
    const decision = decideEligibility(app(
      'Details of Cycle Parking pursuant to planning permission dated 02/10/2024 ref 2023/4840 ' +
      '(Demolition of all existing buildings/structures and erection of residential dwellings (Class C3), ' +
      'a new health centre (Class E), phased development providing a total of 113 residential units)',
      { commercial_work: 'new', dwelling_count: 113 }
    ))
    expect(decision.detailSubmission).toBe(true)
    expect(decision.intelligenceTier).toBe(false)
    // The limbs are retained as the audit trail of what it would have qualified under.
    expect(decision.limbs).toEqual(['A', 'B'])
  })

  it('excludes a condition-numbered details submission', () => {
    const decision = decideEligibility(app(
      'Details of refuse storage pursuant to condition 31 of planning permission dated 02/10/2024 ref 2023/4840',
      { commercial_work: 'new', dwelling_count: 113 }
    ))
    expect(decision.intelligenceTier).toBe(false)
  })

  it('excludes an explicit discharge of conditions', () => {
    expect(isDetailSubmission(app('Discharge of conditions 4 and 7 of planning permission ref 2024/1234'))).toBe(true)
  })

  // The trap: this real record shares procedure="reserved-matters" with both records above,
  // so any rule keyed on procedure would silently drop a genuine commercial opportunity.
  it('keeps a genuine change of use that shares the same procedure code', () => {
    const decision = decideEligibility(app(
      'Alterations in connection with change of use of retail warehouse (Use Class A1/B8) to gymnasium ' +
      'with an ancillary function (Use Class D2)',
      { commercial_work: 'between', procedure: 'reserved-matters' }
    ))
    expect(decision.detailSubmission).toBe(false)
    expect(decision.intelligenceTier).toBe(true)
  })

  it('keeps a section 73 variation, which can change what gets built', () => {
    const decision = decideEligibility(app(
      'Variation of condition 2 of planning permission 2023/1111 to increase the retail floorspace',
      { commercial_work: 'new' }
    ))
    expect(decision.intelligenceTier).toBe(true)
  })

  it('keeps a substantive application that merely mentions details of a shopfront', () => {
    const decision = decideEligibility(app(
      'Erection of a new retail unit including details of shopfront and associated parking',
      { commercial_work: 'new' }
    ))
    expect(decision.intelligenceTier).toBe(true)
  })

  it('does not exclude a leading "Details" with no reference to an existing consent', () => {
    expect(isDetailSubmission(app('Details of proposed external materials and landscaping'))).toBe(false)
  })

  it('never promotes a detail submission even when it would meet several limbs', () => {
    const decision = decideEligibility(app(
      'Submission of details pursuant to condition 12 of planning permission ref 2022/9999',
      { commercial_work: 'loss', dwelling_count: 400 }
    ))
    expect(decision.limbs).toEqual(['B', 'D'])
    expect(decision.intelligenceTier).toBe(false)
  })
})

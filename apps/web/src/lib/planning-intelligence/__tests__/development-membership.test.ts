import {
  planFamilyMemberships,
  type CurrentMembership,
  type DevelopmentGuard,
  type FamilyPlan,
  type MembershipApplication,
  type MembershipInput,
} from '../development-membership'
import { linkCouncilApplications } from '../linking'

let sequence = 0
function application(reference: string, description: string, overrides: Partial<MembershipApplication> = {}): MembershipApplication {
  sequence += 1
  return {
    id: overrides.id ?? `a${sequence}`, reference, description, procedure: 'full',
    intelligence_tier: true, classification_state: 'classified', ...overrides,
  }
}
function council(applications: MembershipApplication[]): MembershipApplication[] {
  const fillers = Array.from({ length: 6 }, (_, n) =>
    application(`2026/${String(n + 900).padStart(4, '0')}`, 'Single storey rear extension', { intelligence_tier: false }))
  return [...applications, ...fillers]
}
function development(id: string, overrides: Partial<DevelopmentGuard> = {}): DevelopmentGuard {
  return {
    id, reviewState: 'pending', researchState: 'not_eligible', decidedFacts: false,
    principalApplicationId: null, familyState: 'single', firstSeenAt: `2026-01-0${id.slice(-1)}`, ...overrides,
  }
}
function input(
  applications: MembershipApplication[],
  memberships: CurrentMembership[],
  developments: DevelopmentGuard[],
  conflictedParentKeys: string[] = []
): MembershipInput {
  const { links } = linkCouncilApplications(applications)
  return {
    applications,
    links: links.map((link, index) => ({ ...link, id: `l${index}` })),
    memberships,
    developments,
    conflictedParentKeys: new Set(conflictedParentKeys),
  }
}
const primary = (applicationId: string, developmentId: string): CurrentMembership => ({ applicationId, developmentId, role: 'primary' })
function only(plans: FamilyPlan[]): FamilyPlan {
  expect(plans).toHaveLength(1)
  return plans[0]
}

// Broadland Business Park, as stored before its original is fetched.
const warehouseClub = 'Erection of a Warehouse Club (Sui Generis) including tyre installation and sales, a petrol filling station'
function broadlandPaperwork() {
  return [
    application('2026/0994', 'Details for condition 9 - Travel Plan of permission 2024/3141', { procedure: 'discharge' }),
    application('2026/1998', 'Discharge of condition 14- PFS delivery times, of existing application 2024/3141.', { procedure: 'discharge' }),
    application('2026/2652', 'Non material amendment of 2024/3141 - minor amendments to mezzanine sizes', { procedure: 'amendment' }),
  ]
}

describe('planFamilyMemberships', () => {
  it('puts a stored original, its section 73 and its paperwork in the original\'s Development', () => {
    const original = application('2024/3141', warehouseClub)
    const s73 = application('2026/0301', 'Variation of condition 2 of 2024/3141 to alter the approved layout', { procedure: 'amendment' })
    const condition = application('2026/0994', 'Details for condition 9 - Travel Plan of permission 2024/3141', { procedure: 'discharge', intelligence_tier: false, classification_state: 'not_eligible' })
    const plan = only(planFamilyMemberships(input(
      council([original, s73, condition]),
      [primary(original.id, 'd1'), primary(s73.id, 'd2')],
      [development('d1'), development('d2')],
    )))

    expect(plan).toMatchObject({
      action: 'apply', targetDevelopmentId: 'd1', principalApplicationId: original.id, familyState: 'family',
      clearMachineGrade: false, queueClassification: [], admitByFamily: [], missingParentKeys: [],
    })
    if (plan.action !== 'apply') throw new Error('expected apply')
    expect(plan.members.map(m => [m.applicationId, m.role]).sort()).toEqual([
      [s73.id, 'amendment'], [condition.id, 'condition'],
    ].sort())
    expect(plan.members.every(m => m.linkIds.length > 0)).toBe(true)
  })

  it('groups paperwork whose original is missing into one Development awaiting it, and clears the paperwork grade', () => {
    const [a, b, c] = broadlandPaperwork()
    const plan = only(planFamilyMemberships(input(
      council([a, b, c]),
      [primary(a.id, 'd3'), primary(b.id, 'd1'), primary(c.id, 'd2')],
      [development('d3'), development('d1'), development('d2')],
    )))
    expect(plan).toMatchObject({
      action: 'apply', targetDevelopmentId: 'd1', principalApplicationId: null, familyState: 'awaiting_original',
      clearMachineGrade: true, queueClassification: [], missingParentKeys: ['2024/3141'],
    })
    if (plan.action !== 'apply') throw new Error('expected apply')
    expect(plan.members.map(m => m.role).sort()).toEqual(['condition', 'condition', 'related'])
  })

  it('changes nothing once a family is already grouped', () => {
    const [a, b, c] = broadlandPaperwork()
    const plan = only(planFamilyMemberships(input(
      council([a, b, c]),
      [
        { applicationId: a.id, developmentId: 'd1', role: 'condition' },
        { applicationId: b.id, developmentId: 'd1', role: 'condition' },
        { applicationId: c.id, developmentId: 'd1', role: 'related' },
      ],
      [development('d1', { familyState: 'awaiting_original' })],
    )))
    expect(plan.action).toBe('unchanged')
  })

  it('makes a newly stored original the principal of the waiting family and queues it for classification', () => {
    const [a, b, c] = broadlandPaperwork()
    const original = application('2024/3141', warehouseClub, { intelligence_tier: false, classification_state: 'not_eligible' })
    const plan = only(planFamilyMemberships(input(
      council([original, a, b, c]),
      [
        { applicationId: a.id, developmentId: 'd1', role: 'condition' },
        { applicationId: b.id, developmentId: 'd1', role: 'condition' },
        { applicationId: c.id, developmentId: 'd1', role: 'related' },
      ],
      [development('d1', { familyState: 'awaiting_original' })],
    )))
    expect(plan).toMatchObject({
      action: 'apply', targetDevelopmentId: 'd1', principalApplicationId: original.id, familyState: 'family',
      clearMachineGrade: false, queueClassification: [original.id], admitByFamily: [original.id],
      members: [expect.objectContaining({ applicationId: original.id, role: 'principal' })],
    })
  })

  it('lets a clear section 73 lead while the original is missing, without reclassifying it', () => {
    const s73 = application('2026/0301', 'Variation of condition 2 of 2024/3141 to allow a 9,000 sqm warehouse club', { procedure: 'amendment' })
    const condition = application('2026/0994', 'Details for condition 9 - Travel Plan of permission 2024/3141', { procedure: 'discharge' })
    const plan = only(planFamilyMemberships(input(
      council([s73, condition]),
      [primary(s73.id, 'd1'), primary(condition.id, 'd2')],
      [development('d1'), development('d2')],
    )))
    expect(plan).toMatchObject({
      action: 'apply', targetDevelopmentId: 'd1', principalApplicationId: s73.id, familyState: 'awaiting_original',
      queueClassification: [], clearMachineGrade: false,
      members: [expect.objectContaining({ applicationId: condition.id, role: 'condition' })],
    })
  })

  it('never merges a reviewed Development away, and holds the family for review', () => {
    const original = application('2024/3141', warehouseClub)
    const s73 = application('2026/0301', 'Variation of condition 2 of 2024/3141 to alter the approved layout', { procedure: 'amendment' })
    const plan = only(planFamilyMemberships(input(
      council([original, s73]),
      [primary(original.id, 'd1'), primary(s73.id, 'd2')],
      [development('d1'), development('d2', { reviewState: 'corrected' })],
    )))
    expect(plan).toMatchObject({ action: 'hold', reason: 'protected_development' })
  })

  it('still lets paperwork join a Development a person has reviewed', () => {
    const original = application('2024/3141', warehouseClub)
    const condition = application('2026/0994', 'Details for condition 9 - Travel Plan of permission 2024/3141', { procedure: 'discharge' })
    const plan = only(planFamilyMemberships(input(
      council([original, condition]),
      [primary(original.id, 'd1'), primary(condition.id, 'd2')],
      [development('d1', { reviewState: 'approved', researchState: 'complete' }), development('d2')],
    )))
    expect(plan).toMatchObject({
      action: 'apply', targetDevelopmentId: 'd1',
      members: [expect.objectContaining({ applicationId: condition.id, role: 'condition' })],
    })
  })

  it('holds a family citing several missing permissions', () => {
    const plan = only(planFamilyMemberships(input(
      council([
        // No member quotes both permissions, so this is not one scheme's quoted chain.
        application('2026/0401', 'Reserved matters for phase 2 pursuant to outline permission 2019/1111', { procedure: 'reserved_matters' }),
        application('2019/1111/COND', 'Discharge of condition 5 of 2020/2222', { procedure: 'discharge' }),
      ]),
      [], [],
    )))
    expect(plan).toMatchObject({ action: 'hold', reason: 'several_missing_originals' })
  })

  it('holds a family whose Plota family disagrees with local links', () => {
    const [a, b, c] = broadlandPaperwork()
    const plan = only(planFamilyMemberships(input(council([a, b, c]), [], [], ['2024/3141'])))
    expect(plan).toMatchObject({ action: 'hold', reason: 'plota_conflict' })
  })

  it('leaves a single application citing a missing original alone', () => {
    const condition = application('24/01118/DOC01', 'Discharge of condition 3 of 24/01118', { procedure: 'discharge' })
    expect(planFamilyMemberships(input(council([condition]), [primary(condition.id, 'd1')], [development('d1')]))).toEqual([])
  })

  it('creates a Development for a family that has none yet', () => {
    const original = application('2024/3141', warehouseClub, { intelligence_tier: false, classification_state: 'not_eligible' })
    const condition = application('2026/0994', 'Details for condition 9 - Travel Plan of permission 2024/3141', { procedure: 'discharge' })
    const plan = only(planFamilyMemberships(input(council([original, condition]), [], [])))
    expect(plan).toMatchObject({
      action: 'apply', targetDevelopmentId: null, principalApplicationId: original.id,
      queueClassification: [original.id], admitByFamily: [original.id],
    })
  })
})

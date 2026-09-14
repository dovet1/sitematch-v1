import { countAssessments, planCouncilAssessments, type AssessableApplication } from '../assessment-groups'

let sequence = 0
function application(reference: string, description: string, overrides: Partial<AssessableApplication> = {}): AssessableApplication {
  sequence += 1
  return { id: overrides.id ?? `a${sequence}`, reference, description, procedure: 'full', intelligence_tier: true, ...overrides }
}
const broadland = (n: number) => `2026/${String(n).padStart(4, '0')}`
function council(applications: AssessableApplication[]): AssessableApplication[] {
  const fillers = Array.from({ length: 6 }, (_, n) => application(broadland(n + 900), 'Single storey rear extension', { intelligence_tier: false }))
  return [...applications, ...fillers]
}

describe('planCouncilAssessments', () => {
  it('assesses a held original once, reading its section 73 with it and putting paperwork on the timeline', () => {
    const original = application('2024/3141', 'Erection of a warehouse club with petrol filling station', { procedure: 'full' })
    const s73 = application('2026/0301', 'Variation of condition 2 of 2024/3141 to alter the approved layout', { procedure: 'amendment' })
    const condition = application('2026/0994', 'Details for condition 9 - Travel Plan of permission 2024/3141', { procedure: 'discharge' })
    const nma = application('2026/2652', 'Non material amendment of 2024/3141 - minor amendments to mezzanine sizes', { procedure: 'amendment' })
    const apps = council([original, s73, condition, nma])
    const plan = planCouncilAssessments(apps)

    expect(plan.units).toEqual([expect.objectContaining({
      headId: original.id, memberIds: [original.id, s73.id], missingParentReferences: [], uncertain: false,
    })])
    expect(plan.units[0].timelineIds.sort()).toEqual([condition.id, nma.id].sort())
    expect(countAssessments(apps, plan)).toMatchObject({
      tierApplications: 4, assessments: 1, tierReadInsideAnotherAssessment: 1, tierPaperworkOnTimeline: 2, tierAwaitingParent: 0,
    })
  })

  it('flags paperwork whose original is missing for parent retrieval instead of assessing it', () => {
    const apps = council([
      application('2026/0994', 'Details for condition 9 - Travel Plan of permission 2024/3141', { procedure: 'discharge' }),
      application('2026/1998', 'Discharge of condition 14- PFS delivery times, of existing application 2024/3141.', { procedure: 'discharge' }),
      application('2026/2652', 'Non material amendment of 2024/3141 - minor amendments to mezzanine sizes', { procedure: 'amendment' }),
    ])
    const plan = planCouncilAssessments(apps)
    expect(plan.units).toEqual([])
    expect(plan.awaitingParent).toEqual([expect.objectContaining({ missingParentReferences: ['2024/3141'] })])
    expect(countAssessments(apps, plan)).toMatchObject({ assessments: 0, tierAwaitingParent: 3 })
  })

  it('still assesses a clear section 73 when the original is missing, and requests the original', () => {
    const s73 = application('2026/0301', 'Variation of condition 2 of 2024/3141 to allow a 9,000 sqm warehouse club', { procedure: 'amendment' })
    const condition = application('2026/0994', 'Details for condition 9 - Travel Plan of permission 2024/3141', { procedure: 'discharge' })
    const plan = planCouncilAssessments(council([s73, condition]))
    expect(plan.units).toEqual([expect.objectContaining({ headId: s73.id, timelineIds: [condition.id], missingParentReferences: ['2024/3141'] })])
  })

  it('keeps a weakly linked application as its own, uncertain assessment', () => {
    const neighbour = application('2025/1234', 'Erection of 12 dwellings', { intelligence_tier: false })
    const child = application('2026/0101', 'Details of condition 3 for land adjacent to the site approved under 2025/1234')
    const plan = planCouncilAssessments(council([neighbour, child]))
    expect(plan.units).toEqual([expect.objectContaining({ headId: child.id, uncertain: true })])
  })

  it('assesses unlinked tier applications individually and ignores the rest of the council', () => {
    const apps = council([application('2026/0500', 'Change of use from B8 to gym (Class E(d))')])
    const plan = planCouncilAssessments(apps)
    expect(countAssessments(apps, plan)).toMatchObject({ tierApplications: 1, assessments: 1 })
  })
})

import type { PlanningApplication } from '../../types/unified-workspace'
import { groupPlanningApplications, latestPlanningApplication, planningPaperworkLabel } from '../planning-groups'

function app(name: string, overrides: Partial<PlanningApplication> = {}): PlanningApplication {
  return {
    name,
    uid: name,
    address: `${name} address`,
    appSize: '',
    appState: 'Undecided',
    appType: '',
    description: '',
    url: '',
    lat: 51.28,
    lng: 1.08,
    decidedDate: null,
    dateValidated: null,
    nDwellings: null,
    applicantAddress: null,
    agentAddress: null,
    ...overrides,
  }
}

describe('groupPlanningApplications', () => {
  it('groups applications by development, placing each group at its best-ranked member', () => {
    const groups = groupPlanningApplications([
      app('A', { developmentId: 'd1' }),
      app('B', { developmentId: 'd2' }),
      app('C', { developmentId: 'd1' }),
      app('D', { developmentId: 'd2' }),
    ])
    expect(groups.map(g => g.key)).toEqual(['d1', 'd2'])
    expect(groups[0].applications.map(a => a.name)).toEqual(['A', 'C'])
    expect(groups[1].applications.map(a => a.name)).toEqual(['B', 'D'])
  })

  it('keeps each application without a development as its own group', () => {
    const groups = groupPlanningApplications([
      app('A'),
      app('B', { developmentId: null }),
      app('C', { developmentId: 'd1' }),
    ])
    expect(groups.map(g => [g.key, g.developmentId, g.applications.length])).toEqual([
      ['A', null, 1],
      ['B', null, 1],
      ['d1', 'd1', 1],
    ])
  })

  it('leads each group with the application that describes the development', () => {
    const groups = groupPlanningApplications([
      app('amendment', { developmentId: 'd1', developmentRole: 'amendment' }),
      app('original', { developmentId: 'd1', developmentRole: 'principal' }),
      app('condition', { developmentId: 'd1', developmentRole: 'condition' }),
    ])
    expect(groups[0].applications.map(a => a.name)).toEqual(['original', 'amendment', 'condition'])
  })

  it('labels paperwork and nothing else', () => {
    expect(planningPaperworkLabel(app('a', { developmentRole: 'condition' }))).toBe('Condition details')
    expect(planningPaperworkLabel(app('b', { developmentRole: 'related' }))).toBe('Paperwork')
    expect(planningPaperworkLabel(app('c', { developmentRole: 'amendment' }))).toBeNull()
    expect(planningPaperworkLabel(app('d'))).toBeNull()
  })

  it('returns no groups for no applications', () => {
    expect(groupPlanningApplications([])).toEqual([])
  })

  it('accounts for every application exactly once', () => {
    const input = [app('A', { developmentId: 'd1' }), app('B'), app('C', { developmentId: 'd1' })]
    const flattened = groupPlanningApplications(input).flatMap(g => g.applications)
    expect(flattened).toHaveLength(input.length)
    expect(new Set(flattened)).toEqual(new Set(input))
  })
})

describe('latestPlanningApplication', () => {
  it('picks the most recent decision, falling back to validation date', () => {
    const latest = latestPlanningApplication([
      app('old', { decidedDate: '2021-01-01' }),
      app('validated', { dateValidated: '2024-05-01' }),
      app('decided', { decidedDate: '2023-02-01' }),
    ])
    expect(latest?.name).toBe('validated')
  })

  it('still returns a member when none are dated', () => {
    expect(latestPlanningApplication([app('A'), app('B')])?.name).toBe('A')
  })

  it('returns null for an empty list', () => {
    expect(latestPlanningApplication([])).toBeNull()
  })
})

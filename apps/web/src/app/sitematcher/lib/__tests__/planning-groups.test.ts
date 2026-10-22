import type { PlanningApplication } from '../../types/unified-workspace'
import {
  mergeDevelopmentHistory,
  planningCountLabel,
  planningPins,
  groupPlanningApplications,
  latestPlanningApplication,
  planningKindLabel,
  planningPaperworkLabel,
  planningTimeline,
} from '../planning-groups'

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
    expect(planningPaperworkLabel(app('b', { developmentRole: 'related' }))).toBe('Minor amendment')
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

describe('planningTimeline', () => {
  it('orders a history oldest first, undated first, main application ahead on a tie', () => {
    const order = planningTimeline([
      app('condition', { developmentRole: 'condition', dateReceived: '2026-07-01' }),
      app('amendment', { developmentRole: 'amendment', dateValidated: '2026-03-01' }),
      app('original', { developmentRole: 'principal' }),
      app('same-day paperwork', { developmentRole: 'related', dateReceived: '2026-07-01' }),
      app('same-day main', { developmentRole: 'primary', dateReceived: '2026-07-01' }),
    ]).map(a => a.name)
    expect(order).toEqual(['original', 'amendment', 'same-day main', 'condition', 'same-day paperwork'])
  })

  it('names each kind of application in plain words', () => {
    expect(planningKindLabel(app('a', { developmentRole: 'principal' }))).toBe('Main application')
    expect(planningKindLabel(app('b', { developmentRole: 'amendment' }))).toBe('Amendment')
    expect(planningKindLabel(app('c', { developmentRole: 'member' }))).toBe('Linked consent')
    expect(planningKindLabel(app('d', { developmentRole: 'condition' }))).toBe('Condition details')
    expect(planningKindLabel(app('e'))).toBeNull()
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

describe('development counts, pins and history', () => {
  const ram = [
    app('Wandsworth/2025/3189', { developmentId: 'ram', developmentRole: 'principal', developmentApplicationCount: 11, lat: 51.456, lng: -0.19 }),
    app('Wandsworth/2026/2824', { developmentId: 'ram', developmentRole: 'condition', developmentApplicationCount: 11, lat: 51.457, lng: -0.191 }),
  ]
  const single = app('Wandsworth/2026/0001', { developmentId: 'solo', developmentRole: 'primary', developmentApplicationCount: 1, lat: 51.4, lng: -0.2 })

  it('says how many applications a development holds, and how many of them this search lists', () => {
    const [group] = groupPlanningApplications(ram)
    expect(planningCountLabel(group)).toBe('11 applications · 2 in this area')
    expect(planningCountLabel({ ...group, applications: group.applications.map(a => ({ ...a, developmentApplicationCount: 2 })) })).toBe('2 applications')
    expect(planningCountLabel({ ...group, applications: group.applications.map(a => ({ ...a, developmentApplicationCount: null })) })).toBe('2 applications')
  })

  it('draws one pin per development at its lead application, and one per application otherwise', () => {
    expect(planningPins([...ram, single], 'developments')).toEqual([
      { name: 'Wandsworth/2025/3189', lng: -0.19, lat: 51.456, developmentKey: 'ram', count: 11 },
      { name: 'Wandsworth/2026/0001', lng: -0.2, lat: 51.4, developmentKey: null, count: 1 },
    ])
    expect(planningPins([...ram, single], 'applications')).toHaveLength(3)
  })

  it('joins the full history with the list, marking what the search did not list', () => {
    const history = [
      { ...ram[0], lat: 0, lng: 0 },
      app('Wandsworth/2026/0627', { developmentId: 'ram', developmentRole: 'related' }),
    ]
    const merged = mergeDevelopmentHistory(ram, history)
    expect(merged.map(e => [e.name, e.inList])).toEqual([
      ['Wandsworth/2025/3189', true], ['Wandsworth/2026/2824', true], ['Wandsworth/2026/0627', false],
    ])
    // The listed record wins, so its position and classification are kept.
    expect(merged[0].lat).toBe(51.456)
    expect(mergeDevelopmentHistory(ram, null)).toHaveLength(2)
  })
})

describe('history wording', () => {
  // Ten discharged conditions do not prove a building is going up, so no label may imply it.
  it('never claims construction has started', () => {
    const roles = ['principal', 'primary', 'amendment', 'member', 'condition', 'related', null]
    const labels = roles.map(role => planningKindLabel(app('x', { developmentRole: role })) ?? '')
    for (const label of labels) {
      expect(label).not.toMatch(/construct|commenc|start|underway|built|build|progress|complete/i)
    }
  })
})

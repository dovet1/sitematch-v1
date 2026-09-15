import { historyApplication, type HistoryRow } from '../history'

const row = (overrides: Partial<NonNullable<HistoryRow['planning_applications']>> = {}): HistoryRow => ({
  role: 'condition',
  planning_applications: {
    provider_id: 'p1', authority_name: 'Wandsworth', reference: '2026/2824', address: 'The RAM Brewery Site',
    status: 'Registered', stage: 'pending', planning_route: 'Reserved matters (following outline)', procedure: null,
    commercial_work: null, stated_floorspace_sqm: null, description: 'Details pursuant to condition 14',
    links: { council: 'https://council.example/2026-2824' },
    date_received: '2026-08-07', date_validated: null, date_decided: null, ...overrides,
  },
})

describe('historyApplication', () => {
  it('names an application exactly as the tab does, so the timeline can tell what is already listed', () => {
    const app = historyApplication(row(), 'dev-1')!
    expect(app.name).toBe('Wandsworth/2026/2824')
    expect(app).toMatchObject({ developmentId: 'dev-1', developmentRole: 'condition', dateReceived: '2026-08-07', url: 'https://council.example/2026-2824' })
  })

  it('carries only public record fields, never applicant details or the development\'s figures', () => {
    const app = historyApplication(row(), 'dev-1')!
    expect(app.applicantAddress).toBeNull()
    expect(app.agentAddress).toBeNull()
    expect(app.nDwellings).toBeNull()
    expect(app.relevance).toBeUndefined()
    expect(app.summary).toBeUndefined()
  })

  it('skips a membership whose application is gone', () => {
    expect(historyApplication({ role: 'condition', planning_applications: null }, 'dev-1')).toBeNull()
  })
})

import type { EvidenceItem } from '../digest-select'
import { summariseWithModel, validateSummary } from '../digest-summary'

const item: EvidenceItem = {
  id: 'E1',
  applicationId: 'k',
  reference: '26/0042',
  authority: 'Leeds',
  address: '1 High Street',
  description: 'Erection of 320 homes',
  changes: ['approved'],
  stage: 'approved',
  councilStatus: 'Granted',
  dateReceived: '2026-05-01',
  dateDecided: '2026-09-16',
  type: 'full',
  knownDwellings: 320,
  dwellingCountReviewedByPerson: false,
  familyAwaitingOriginal: false,
  approximateLocation: false,
  nearSelectedStores: null,
  watched: false,
  sourceUrl: null,
}
const counts = { newApplications: 0, newDevelopments: 0, decisions: 1, approvals: 1, refusals: 0, withdrawals: 0, lateDiscoveries: 0, knownNewDwellings: 320, unresolvedFamilies: 0, watchedChanges: 0 }
const context = { items: [item], counts, periodLabel: '14 Sept – 20 Sept 2026', patchName: 'Leeds' }
const good = {
  overview: 'One scheme was approved this week: 320 homes at 1 High Street (26/0042).',
  keyChanges: [{ text: 'Approval of 320 homes at 1 High Street.', evidence: ['E1'] }],
  residentialTheme: null,
  commercialTheme: null,
  watchedChanges: [],
  caveats: [] as string[],
}

describe('validateSummary caveats', () => {
  it('keeps the first four caveats instead of rejecting a longer list', () => {
    const caveats = ['First note.', 'Second note.', 'Third note.', 'Fourth note.', 'Fifth note.']
    const result = validateSummary({ ...good, caveats }, context)
    expect(result).toMatchObject({ ok: true })
    if (result.ok) expect(result.summary.caveats).toEqual(caveats.slice(0, 4))
  })

  it.each([
    'Array must contain at most 4 element(s).',
    'The previous reply was rejected.',
    'unsupported claim: residents',
  ])('rejects a reply that repeats validation feedback: %s', (caveat) => {
    const result = validateSummary({ ...good, caveats: [caveat] }, context)
    expect(result).toMatchObject({ ok: false })
    if (!result.ok) expect(result.reasons).toContain('the reply repeats validation feedback')
  })

  it('still accepts ordinary planning wording', () => {
    const caveat = 'An earlier scheme on this site was rejected, and the layout must contain a service yard.'
    expect(validateSummary({ ...good, caveats: [caveat] }, context)).toMatchObject({ ok: true })
  })
})

describe('summariseWithModel retry', () => {
  function reply(content: object) {
    return { ok: true, json: async () => ({ model: 'test-model', choices: [{ message: { content: JSON.stringify(content) } }], usage: {} }) }
  }

  it('asks for a correction without restating the problems in the reply', async () => {
    const bodies: Array<{ messages: Array<{ role: string; content: string }> }> = []
    const replies = [reply({ ...good, overview: 'Approved 999 homes at 1 High Street.' }), reply(good)]
    const fetchImpl = jest.fn(async (_url: string, init: { body: string }) => {
      bodies.push(JSON.parse(init.body))
      return replies.shift()
    }) as unknown as typeof fetch

    const result = await summariseWithModel({
      apiKey: 'key',
      model: 'test-model',
      userPrompt: '{}',
      validate: (value) => validateSummary(value, context),
      fetchImpl,
    })

    expect(result.usage.attempts).toBe(2)
    const retry = bodies[1].messages.at(-1)!.content
    expect(retry).toContain('number 999 is not in the evidence')
    expect(retry).toContain('Do not mention these problems')
  })
})

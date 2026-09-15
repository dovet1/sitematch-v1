import { buildFamilyInput, FAMILY_MAX_CHANGES, familyInputHash, type FamilyMember } from '../family-input'
import type { PlotaApplication } from '../types'

const raw = (reference: string, description: string, overrides: Partial<PlotaApplication> = {}): PlotaApplication => ({
  id: reference, reference, authority: { slug: 'wandsworth', name: 'Wandsworth' }, description, ...overrides,
})
const member = (role: string, reference: string, description: string, date: string): FamilyMember =>
  ({ role, raw: raw(reference, description, { date_received: date, procedure: role === 'condition' ? 'discharge' : 'amendment' }) })

const main = { reference: '2025/3189', description: 'Proposed changes to the RAM Brewery permission' }

describe('buildFamilyInput', () => {
  it('sends significant changes newest first and paperwork only as counts', () => {
    const input = buildFamilyInput({
      mainInput: main, originalHeld: true,
      members: [
        member('principal', '2025/3189', 'Proposed changes', '2025-07-01'),
        member('amendment', '2025/4000', 'Variation of condition 2 to add a hotel', '2025-09-01'),
        member('member', '2026/0100', 'Listed building consent for the clock tower', '2026-01-10'),
        member('condition', '2026/2824', 'Details of external ventilation pursuant to condition 14', '2026-08-07'),
        member('related', '2026/0627', 'Non-material amendment to the approved drawings', '2026-02-13'),
      ],
    })
    expect(input.changes.map(change => [change.reference, change.kind])).toEqual([['2026/0100', 'linked_consent'], ['2025/4000', 'amendment']])
    expect(input.paperwork).toEqual({ conditionSubmissions: 1, minorAmendments: 1, latestDate: '2026-08-07' })
    expect(JSON.stringify(input)).not.toContain('ventilation')
    expect(JSON.stringify(input)).not.toContain('approved drawings')
  })

  it('caps the changes and says how many are not shown, trimming long descriptions', () => {
    const members = Array.from({ length: FAMILY_MAX_CHANGES + 3 }, (_, n) =>
      member('amendment', `2026/${1000 + n}`, 'x'.repeat(5000), `2026-01-${String(n + 1).padStart(2, '0')}`))
    const input = buildFamilyInput({ mainInput: main, originalHeld: true, members })
    expect(input.changes).toHaveLength(FAMILY_MAX_CHANGES)
    expect(input.earlierChangesNotShown).toBe(3)
    expect(input.changes[0].description.length).toBeLessThanOrEqual(1201)
  })

  it('says when the original is missing and which references stand in for it', () => {
    const input = buildFamilyInput({ mainInput: main, originalHeld: false, citedOriginals: ['2021/4900'], members: [] })
    expect(input).toMatchObject({ originalHeld: false, citedOriginals: ['2021/4900'] })
  })
})

describe('familyInputHash', () => {
  const base = [member('amendment', '2025/4000', 'Variation of condition 2', '2025-09-01')]

  it('does not change when only paperwork arrives, so a condition submission never makes a grade stale', () => {
    const before = buildFamilyInput({ mainInput: main, originalHeld: true, members: base })
    const after = buildFamilyInput({ mainInput: main, originalHeld: true, members: [...base, member('condition', '2026/2824', 'Details', '2026-08-07')] })
    expect(familyInputHash(after)).toBe(familyInputHash(before))
  })

  it('changes when a significant change joins or the main application changes', () => {
    const before = familyInputHash(buildFamilyInput({ mainInput: main, originalHeld: true, members: base }))
    const joined = familyInputHash(buildFamilyInput({ mainInput: main, originalHeld: true, members: [...base, member('amendment', '2026/0500', 'Reserved matters for phase 2', '2026-05-01')] }))
    const newMain = familyInputHash(buildFamilyInput({ mainInput: { ...main, description: 'Revised' }, originalHeld: true, members: base }))
    expect(joined).not.toBe(before)
    expect(newMain).not.toBe(before)
  })
})

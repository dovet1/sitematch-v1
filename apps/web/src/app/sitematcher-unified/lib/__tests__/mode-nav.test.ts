import { availableModes, initialMode, shouldOpenChooserOnLoad, MODE_NAV } from '../mode-nav'

describe('availableModes', () => {
  it('keeps rail order and offers all six modes when both flags are on', () => {
    expect(availableModes({ planning: true, brandMatcher: true }).map((m) => m.railLabel)).toEqual([
      'Assess',
      'Gaps',
      'Sketch',
      'Planning',
      'Match',
      'Directory',
    ])
  })

  it('drops flagged-off modes', () => {
    const ids = availableModes({ planning: false, brandMatcher: false }).map((m) => m.id)
    expect(ids).toEqual(['assess', 'find', 'sketch', 'directory'])
  })
})

describe('shouldOpenChooserOnLoad', () => {
  const base = { dontShow: false, hasDeepLink: false }

  it('opens for a user who has not opted out', () => {
    expect(shouldOpenChooserOnLoad(base)).toBe(true)
  })

  it.each([
    ['opted out', { dontShow: true }],
    ['arrived on a deep link', { hasDeepLink: true }],
  ])('stays closed when %s', (_label, override) => {
    expect(shouldOpenChooserOnLoad({ ...base, ...override })).toBe(false)
  })
})

describe('initialMode', () => {
  it('returns the last-used mode when it is still offered', () => {
    expect(initialMode('directory', MODE_NAV)).toBe('directory')
  })

  it('falls back to Assess when the last mode is gone or unknown', () => {
    const offered = availableModes({ planning: false, brandMatcher: false })
    expect(initialMode('planning', offered)).toBe('assess')
    expect(initialMode(null, offered)).toBe('assess')
  })
})

import {
  BACKTEST_BATCH,
  PROFILE_BATCH,
  START,
  STEP_BUDGET_MS,
  parseCursor,
  refreshStep,
  type RefreshCursor,
  type RefreshDeps,
} from '../brand-matcher-demographics-refresh'

// 60 brands; 14 fascias and 9 brands can be backtested. Each call "takes" callMs.
function fakeDb(callMs = 1000) {
  let clock = 0
  const profileCalls: string[][] = []
  const backtestCalls: [string, number, number][] = []
  const units = { fascia: 14, brand: 9 }
  const deps: RefreshDeps = {
    listBrandIds: async () => Array.from({ length: 60 }, (_, i) => `b${String(i).padStart(2, '0')}`),
    rebuildProfiles: async (ids) => {
      clock += callMs
      profileCalls.push(ids)
      return ids.length * 10
    },
    recordBacktest: async (level, from, to) => {
      clock += callMs
      backtestCalls.push([level, from, to])
      return Math.max(0, Math.min(to, units[level]) - from + 1)
    },
    now: () => clock,
  }
  return { deps, profileCalls, backtestCalls }
}

async function runToEnd(deps: RefreshDeps) {
  const messages: string[] = []
  let cursor: RefreshCursor = START
  for (let i = 0; i < 50; i++) {
    const r = await refreshStep(cursor, deps)
    messages.push(r.message)
    if (r.done) return messages
    cursor = r
  }
  throw new Error('did not finish')
}

describe('refreshStep', () => {
  it('rebuilds every brand, then records fascia then brand scores', async () => {
    const { deps, profileCalls, backtestCalls } = fakeDb()
    const messages = await runToEnd(deps)
    expect(profileCalls.flat()).toHaveLength(60)
    expect(profileCalls.every((ids) => ids.length <= PROFILE_BATCH)).toBe(true)
    expect(backtestCalls.filter(([l]) => l === 'fascia').map(([, f]) => f)).toEqual([1, 7, 13])
    expect(backtestCalls.filter(([l]) => l === 'brand').map(([, f]) => f)).toEqual([1, 7])
    expect(backtestCalls.every(([, f, t]) => t - f + 1 === BACKTEST_BATCH)).toBe(true)
    expect(messages).toContain('Backtest scores recorded for 14 fascias')
    expect(messages[messages.length - 1]).toBe('Backtest scores recorded for 9 brands — refresh complete')
  })

  it('stops a step when the time budget is spent and resumes where it stopped', async () => {
    const slow = fakeDb(STEP_BUDGET_MS / 2 + 1)
    const first = await refreshStep(START, slow.deps)
    expect(first).toMatchObject({ stage: 'profiles', next: 2 * PROFILE_BATCH, done: false })
    const second = await refreshStep(first, slow.deps)
    expect(second).toMatchObject({ stage: 'fascia', next: 1 })
    expect(slow.profileCalls.flat()).toHaveLength(60)

    const fascia = await refreshStep({ stage: 'fascia', next: 1 }, slow.deps)
    expect(fascia).toMatchObject({ stage: 'fascia', next: 1 + 2 * BACKTEST_BATCH, done: false })
  })
})

describe('parseCursor', () => {
  it('starts from the beginning on an empty body', () => {
    expect(parseCursor({})).toEqual(START)
    expect(parseCursor(null)).toEqual(START)
  })
  it('accepts a cursor the route returned and rejects anything else', () => {
    expect(parseCursor({ stage: 'brand', next: 7 })).toEqual({ stage: 'brand', next: 7 })
    expect(parseCursor({ stage: 'fascia', next: 0 })).toBeNull()
    expect(parseCursor({ stage: 'done', next: 0 })).toBeNull()
    expect(parseCursor({ stage: 'profiles', next: -1 })).toBeNull()
    expect(parseCursor('x')).toBeNull()
  })
})

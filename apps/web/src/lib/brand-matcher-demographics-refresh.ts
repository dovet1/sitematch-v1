// Refreshing Brand Matcher demographics after a store import, in steps the admin button calls one
// after another until done. Each database call stays well inside PostgREST's 8-second statement
// cap, and each step inside one request.
//
//   profiles — rebuild_brand_demographic_profiles() for 25 brands at a time (every brand, so a
//              brand that lost its stores loses its stale profile too)
//   fascia   — record_brand_demographic_backtest('fascia', …) a few units at a time
//   brand    — the same per whole brand
//
// Scores are cleared when a level starts (unit 1), so while a refresh runs some cards may show no
// demographic pill; they come back as the scores are recorded.

export type RefreshStage = 'profiles' | 'fascia' | 'brand' | 'done'

export interface RefreshCursor {
  stage: RefreshStage
  // profiles: index into the brand list; fascia / brand: the next unit number (from 1).
  next: number
}

export interface RefreshDeps {
  listBrandIds: () => Promise<string[]>
  rebuildProfiles: (brandIds: string[]) => Promise<number>
  recordBacktest: (level: 'fascia' | 'brand', from: number, to: number) => Promise<number>
  now: () => number
}

export interface RefreshStepResult extends RefreshCursor {
  done: boolean
  // What this step did, for the button to show.
  message: string
}

export const PROFILE_BATCH = 25
export const BACKTEST_BATCH = 6
// Leaves room inside a 60-second request for one more call after the budget is checked.
export const STEP_BUDGET_MS = 40_000

export const START: RefreshCursor = { stage: 'profiles', next: 0 }

export function parseCursor(body: unknown): RefreshCursor | null {
  if (body == null || (typeof body === 'object' && Object.keys(body as object).length === 0)) return START
  if (typeof body !== 'object') return null
  const b = body as Record<string, unknown>
  if (!['profiles', 'fascia', 'brand'].includes(b.stage as string)) return null
  const next = Number(b.next)
  if (!Number.isInteger(next) || next < 0 || (b.stage !== 'profiles' && next < 1)) return null
  return { stage: b.stage as RefreshStage, next }
}

// Runs from the cursor until the stage ends or the time budget is spent, and says where to resume.
export async function refreshStep(cursor: RefreshCursor, deps: RefreshDeps): Promise<RefreshStepResult> {
  const started = deps.now()
  const inBudget = () => deps.now() - started < STEP_BUDGET_MS

  if (cursor.stage === 'profiles') {
    const ids = await deps.listBrandIds()
    let i = cursor.next
    let rows = 0
    while (i < ids.length && inBudget()) {
      rows += await deps.rebuildProfiles(ids.slice(i, i + PROFILE_BATCH))
      i += PROFILE_BATCH
    }
    if (i >= ids.length) {
      return { stage: 'fascia', next: 1, done: false, message: `Profiles rebuilt for all ${ids.length} brands` }
    }
    return { stage: 'profiles', next: i, done: false, message: `Profiles: ${i} of ${ids.length} brands (${rows} rows this step)` }
  }

  if (cursor.stage === 'fascia' || cursor.stage === 'brand') {
    const level = cursor.stage
    let from = cursor.next
    let recorded = 0
    while (inBudget()) {
      const saved = await deps.recordBacktest(level, from, from + BACKTEST_BATCH - 1)
      recorded += saved
      from += BACKTEST_BATCH
      if (saved < BACKTEST_BATCH) {
        const total = from - BACKTEST_BATCH - 1 + saved
        if (level === 'fascia') {
          return { stage: 'brand', next: 1, done: false, message: `Backtest scores recorded for ${total} fascias` }
        }
        return { stage: 'done', next: 0, done: true, message: `Backtest scores recorded for ${total} brands — refresh complete` }
      }
    }
    return {
      stage: level,
      next: from,
      done: false,
      message: `${level === 'fascia' ? 'Fascia' : 'Brand'} scores: ${from - 1} recorded so far (${recorded} this step)`,
    }
  }

  return { stage: 'done', next: 0, done: true, message: 'Nothing to do' }
}

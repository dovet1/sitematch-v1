import { PLOTA_REQUEST_RESERVE } from './plota'

/**
 * Month-end top-up of Plota family lookups (user, 15 September 2026).
 *
 * The allowance resets each calendar month and anything unused is lost. From the 26th, the worker
 * checks what is left, holds back what the scheduled workers are expected to need until the month
 * ends (with a margin), never goes below the discovery reserve, and spends the rest on the
 * highest-priority family lookups. It runs hourly until the month ends, so each run decides again
 * from the latest remaining figure instead of committing to one estimate on the 26th.
 */

/** The first day of the month the top-up may spend. */
export const TOPUP_FROM_DAY = 26

/**
 * What the scheduled workers can spend in a day at most: discovery 8 runs, refresh 4, the late lane
 * 4 and the deep lane 2, each capped at 20 requests (package-planning-workers.mjs). Update this
 * with the schedule.
 */
export const SCHEDULED_DAILY_REQUESTS = (8 + 4 + 4 + 2) * 20

/** Held back on top of the expected need, for backlog pages and anything the estimate misses. */
export const TOPUP_MARGIN = 1.25

export interface TopUpInput {
  now: Date
  /** Plota's latest reported remaining allowance this month; null when none has been seen. */
  monthlyRemaining: number | null
  /** Requests per day the scheduled workers are expected to use. */
  dailyNeed: number
  perRunCap: number
  reserve?: number
  margin?: number
  fromDay?: number
}

export interface TopUpBudget {
  eligible: boolean
  reason: 'before_top_up_window' | 'allowance_unknown' | 'nothing_spare' | null
  /** Days until the allowance resets, counting the rest of today as a whole day. */
  daysLeft: number
  heldForSchedule: number
  spendable: number
  thisRun: number
}

export function familyTopUpBudget(input: TopUpInput): TopUpBudget {
  const reserve = input.reserve ?? PLOTA_REQUEST_RESERVE
  const margin = input.margin ?? TOPUP_MARGIN
  const now = input.now
  const monthEnd = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)
  const daysLeft = Math.ceil((monthEnd - now.getTime()) / 86_400_000)
  const heldForSchedule = Math.ceil(Math.max(0, input.dailyNeed) * daysLeft * margin)
  const none = (reason: TopUpBudget['reason']): TopUpBudget =>
    ({ eligible: false, reason, daysLeft, heldForSchedule, spendable: 0, thisRun: 0 })

  if (now.getUTCDate() < (input.fromDay ?? TOPUP_FROM_DAY)) return none('before_top_up_window')
  if (input.monthlyRemaining === null || !Number.isFinite(input.monthlyRemaining)) return none('allowance_unknown')
  const spendable = Math.max(0, Math.floor(input.monthlyRemaining - reserve - heldForSchedule))
  if (spendable === 0) return none('nothing_spare')
  return {
    eligible: true, reason: null, daysLeft, heldForSchedule, spendable,
    thisRun: Math.min(spendable, Math.max(0, Math.floor(input.perRunCap))),
  }
}

/**
 * The scheduled workers' expected daily need: whichever is higher of their schedule's ceiling and
 * what they actually spent per day over the last three days. A backlog run makes the measured
 * figure high, which only makes the top-up spend less.
 */
export function expectedDailyNeed(recentNonLookupRequests: number, days = 3, scheduled = SCHEDULED_DAILY_REQUESTS): number {
  return Math.max(scheduled, Math.ceil(recentNonLookupRequests / days))
}

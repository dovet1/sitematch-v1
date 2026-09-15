/**
 * Weekly briefing schedule: Monday 08:00 in the subscriber's time zone (Europe/London by default),
 * covering the previous Monday 00:00 to this Monday 00:00 local time. Boundaries are stored as the
 * actual UTC instants, so a daylight-saving change moves the UTC hour, never the local one.
 *
 * The database computes `next_due_at` with the same rule (planning_monitor_next_weekly_due); the
 * tests pin both to the same fixtures.
 */

export const DEFAULT_TIMEZONE = 'Europe/London'
export const SEND_HOUR_LOCAL = 8

interface LocalParts {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
  weekday: number // 1 = Monday … 7 = Sunday
}

const WEEKDAYS: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 }

function localParts(instant: Date, timeZone: string): LocalParts {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    weekday: 'short',
  }).formatToParts(instant)
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
  return {
    year: Number(get('year')),
    month: Number(get('month')),
    day: Number(get('day')),
    hour: Number(get('hour')),
    minute: Number(get('minute')),
    second: Number(get('second')),
    weekday: WEEKDAYS[get('weekday')],
  }
}

/** The UTC instant at which the zone's wall clock reads the given local time. */
export function zonedTimeToUtc(
  local: { year: number; month: number; day: number; hour?: number; minute?: number },
  timeZone: string
): Date {
  const wallAsUtc = Date.UTC(local.year, local.month - 1, local.day, local.hour ?? 0, local.minute ?? 0)
  // Two passes settle the offset either side of a transition.
  let guess = wallAsUtc
  for (let i = 0; i < 2; i++) {
    const p = localParts(new Date(guess), timeZone)
    const shownAsUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second)
    guess += wallAsUtc - shownAsUtc
  }
  return new Date(guess)
}

function addDays(date: { year: number; month: number; day: number }, days: number) {
  const d = new Date(Date.UTC(date.year, date.month - 1, date.day + days))
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() }
}

/** Local Monday (calendar date) of the week containing `instant`. */
function mondayOf(instant: Date, timeZone: string) {
  const p = localParts(instant, timeZone)
  return addDays(p, 1 - p.weekday)
}

export interface WeeklyPeriod {
  /** Inclusive start, UTC. Local Monday 00:00. */
  start: string
  /** Exclusive end, UTC. The following local Monday 00:00. */
  end: string
  /** When the briefing for this period is due, UTC. Local Monday 08:00 at `end`. */
  dueAt: string
  label: string
}

/** The first send time strictly after `after`. */
export function nextWeeklyDue(after: Date, timeZone = DEFAULT_TIMEZONE): Date {
  const monday = mondayOf(after, timeZone)
  const thisWeek = zonedTimeToUtc({ ...monday, hour: SEND_HOUR_LOCAL }, timeZone)
  if (thisWeek.getTime() > after.getTime()) return thisWeek
  return zonedTimeToUtc({ ...addDays(monday, 7), hour: SEND_HOUR_LOCAL }, timeZone)
}

/** The completed Monday–Sunday week reported by the send due at `dueAt`. */
export function periodForDue(dueAt: Date, timeZone = DEFAULT_TIMEZONE): WeeklyPeriod {
  const endMonday = mondayOf(dueAt, timeZone)
  const startMonday = addDays(endMonday, -7)
  const lastSunday = addDays(endMonday, -1)
  const fmt = (d: { year: number; month: number; day: number }, withYear: boolean) =>
    new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', ...(withYear ? { year: 'numeric' } : {}), timeZone: 'UTC' })
      .format(new Date(Date.UTC(d.year, d.month - 1, d.day)))
  return {
    start: zonedTimeToUtc(startMonday, timeZone).toISOString(),
    end: zonedTimeToUtc(endMonday, timeZone).toISOString(),
    dueAt: zonedTimeToUtc({ ...endMonday, hour: SEND_HOUR_LOCAL }, timeZone).toISOString(),
    label: `${fmt(startMonday, startMonday.year !== lastSunday.year)} – ${fmt(lastSunday, true)}`,
  }
}

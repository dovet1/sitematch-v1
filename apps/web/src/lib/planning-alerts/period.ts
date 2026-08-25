export interface MonthlyPeriod {
  start: string
  end: string
  label: string
}

function isoDate(year: number, month: number, day: number): string {
  return new Date(Date.UTC(year, month, day)).toISOString().slice(0, 10)
}

/** Previous complete calendar month, represented as a half-open [start, end) range. */
export function previousCalendarMonth(now = new Date()): MonthlyPeriod {
  const year = now.getUTCFullYear()
  const month = now.getUTCMonth()
  const startDate = new Date(Date.UTC(year, month - 1, 1))
  const endDate = new Date(Date.UTC(year, month, 1))

  return {
    start: isoDate(startDate.getUTCFullYear(), startDate.getUTCMonth(), 1),
    end: isoDate(endDate.getUTCFullYear(), endDate.getUTCMonth(), 1),
    label: new Intl.DateTimeFormat('en-GB', {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(startDate),
  }
}

export function periodFromMonth(month: string): MonthlyPeriod | null {
  if (!/^\d{4}-\d{2}$/.test(month)) return null
  const [year, monthNumber] = month.split('-').map(Number)
  if (monthNumber < 1 || monthNumber > 12) return null
  const start = new Date(Date.UTC(year, monthNumber - 1, 1))
  const end = new Date(Date.UTC(year, monthNumber, 1))
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
    label: new Intl.DateTimeFormat('en-GB', {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(start),
  }
}

export function monthKey(period: Pick<MonthlyPeriod, 'start'>): string {
  return period.start.slice(0, 7)
}

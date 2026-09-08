/**
 * Display helpers for the floor-area admin screens. Presentation only — no thresholds,
 * no rules. The rules live in profile-eligibility.ts and in the SQL.
 */

const INT = new Intl.NumberFormat('en-GB')

export function formatInt(value: number | null | undefined): string {
  return value === null || value === undefined ? '—' : INT.format(value)
}

/**
 * A share, to one decimal place. Returns '—' rather than NaN on an empty base, and
 * '<0.1%' rather than '0%' for a small non-zero count — a bucket holding 16 stores is
 * not the same thing as an empty one, and this page exists to tell them apart.
 */
export function formatShare(part: number | null | undefined, whole: number | null | undefined): string {
  if (part === null || part === undefined) return '—'
  if (!whole) return '—'
  const share = (part / whole) * 100
  if (part > 0 && share < 0.05) return '<0.1%'
  return `${Math.round(share * 10) / 10}%`
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

export function formatDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined) return '—'
  if (seconds < 60) return `${seconds}s`
  const mins = Math.floor(seconds / 60)
  return `${mins}m ${Math.round(seconds - mins * 60)}s`
}

/** The registers publish under codes; nobody reads 'epc_ew' as a name. */
export function registerLabel(source: string): string {
  if (source === 'epc_ew') return 'England & Wales'
  if (source === 'epc_scotland') return 'Scotland'
  return source
}

/**
 * A measurement, in both units, with the units named. Never one without the other: the
 * product speaks sq ft, the register and the database speak m2, and a screen that shows
 * only one of them is where a 10.76x error hides.
 */
export function formatArea(sqft: number | null | undefined, m2: number | null | undefined): string {
  if (sqft === null || sqft === undefined) return '—'
  const m = m2 === null || m2 === undefined ? null : Math.round(Number(m2) * 10) / 10
  return m === null ? `${formatInt(sqft)} sq ft` : `${formatInt(sqft)} sq ft (${INT.format(m)} m²)`
}

/** true/false/unknown, where the unknown is meaningful rather than missing. */
export function formatFlag(value: boolean | null | undefined): string {
  if (value === null || value === undefined) return 'not recorded'
  return value ? 'yes' : 'no'
}

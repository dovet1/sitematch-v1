/** Absolute cutoff remains enforced even if a scheduled batch crosses the month boundary. */
export function backfillDeadlineReached(stopAt: string | undefined, now = Date.now()): boolean {
  if (!stopAt) return false
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(stopAt) || !Number.isFinite(Date.parse(stopAt))) {
    throw new Error('stop-at must be a valid UTC timestamp, for example 2026-09-30T23:00:00Z')
  }
  return now >= Date.parse(stopAt)
}

import type { PlanningApplication } from '../types/unified-workspace'

export type PlanningGrouping = 'developments' | 'applications'

export interface PlanningDevelopmentGroup {
  /** The development id, or the application's own name when it has none. */
  key: string
  developmentId: string | null
  /** Members in the tab's ranked order; the first is the group's lead. */
  applications: PlanningApplication[]
}

/**
 * Folds the ranked planning list into developments.
 *
 * The list arrives ranked by the database, and relevance and summary already belong to the
 * development rather than the application, so no re-ranking happens here: a group sits where
 * its best-ranked member sat, and members keep their relative order. An application with no
 * development is a group of one rather than being pooled with other unlinked records.
 *
 * Membership is only what the tab was given -- applications outside the drawn area or below
 * the tab's scheme filter are not here -- so a group's size is "in this list", not the
 * development's whole history.
 */
export function groupPlanningApplications(
  applications: PlanningApplication[]
): PlanningDevelopmentGroup[] {
  const groups: PlanningDevelopmentGroup[] = []
  const byDevelopment = new Map<string, PlanningDevelopmentGroup>()
  for (const app of applications) {
    const developmentId = app.developmentId ?? null
    if (developmentId == null) {
      groups.push({ key: app.name, developmentId: null, applications: [app] })
      continue
    }
    const existing = byDevelopment.get(developmentId)
    if (existing) {
      existing.applications.push(app)
      continue
    }
    const group = { key: developmentId, developmentId, applications: [app] }
    byDevelopment.set(developmentId, group)
    groups.push(group)
  }
  return groups
}

function timeOf(iso: string | null): number {
  if (!iso) return Number.NEGATIVE_INFINITY
  const t = new Date(iso).getTime()
  return Number.isNaN(t) ? Number.NEGATIVE_INFINITY : t
}

/** The member with the most recent decision or validation date, which says where the scheme stands now. */
export function latestPlanningApplication(
  applications: PlanningApplication[]
): PlanningApplication | null {
  let latest: PlanningApplication | null = null
  let latestTime = Number.NEGATIVE_INFINITY
  for (const app of applications) {
    const t = timeOf(app.decidedDate ?? app.dateValidated)
    if (latest == null || t > latestTime) {
      latest = app
      latestTime = t
    }
  }
  return latest
}

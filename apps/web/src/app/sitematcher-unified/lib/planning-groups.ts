import type { PlanningApplication } from '../types/unified-workspace'

export type PlanningGrouping = 'developments' | 'applications'

export interface PlanningDevelopmentGroup {
  /** The development id, or the application's own name when it has none. */
  key: string
  developmentId: string | null
  /** The application that describes the development first, then the rest in the tab's ranked order. */
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
  // Paperwork ranks after every scheme, so a group is already placed by its scheme. Within it, the
  // application that describes the development leads, even when a newer amendment outranks it.
  for (const group of groups) {
    const lead = group.applications.findIndex(describesDevelopment)
    if (lead > 0) group.applications.unshift(...group.applications.splice(lead, 1))
  }
  return groups
}

/** The principal of a family, or the sole application of a development that has no family. */
export function describesDevelopment(app: PlanningApplication): boolean {
  return app.developmentRole === 'principal' || app.developmentRole === 'primary'
}

/**
 * A plain label for paperwork on a development's timeline; null for anything that is a scheme.
 * Routine paperwork is either a condition submission or a non-material amendment (including
 * section 96A), which is what the 'related' role holds.
 */
export function planningPaperworkLabel(app: PlanningApplication): string | null {
  if (app.developmentRole === 'condition') return 'Condition details'
  if (app.developmentRole === 'related') return 'Minor amendment'
  return null
}

/**
 * What an application is within its development, in words a reader does not need planning
 * vocabulary for. Null outside a family, where the provider's own type is all we have.
 *
 * For paperwork this deliberately replaces the provider's type: Plota files some condition
 * submissions as "reserved matters", and showing both gives the reader two answers.
 */
export function planningKindLabel(app: PlanningApplication): string | null {
  switch (app.developmentRole) {
    case 'principal':
    case 'primary':
      return 'Main application'
    case 'amendment':
      return 'Amendment'
    case 'member':
      return 'Linked consent'
    default:
      return planningPaperworkLabel(app)
  }
}

/** The date an application entered the history: received, else validated, else decided. */
export function planningTimelineDate(app: PlanningApplication): string | null {
  return app.dateReceived ?? app.dateValidated ?? app.decidedDate ?? null
}

/**
 * A development's applications as a history, oldest first. Undated records go first, because
 * the one most often undated is an original fetched from the archive, and the history starts there.
 * Ties keep the main application ahead of what followed it.
 */
export function planningTimeline(applications: PlanningApplication[]): PlanningApplication[] {
  return [...applications].sort((a, b) => {
    const da = timeOf(planningTimelineDate(a))
    const db = timeOf(planningTimelineDate(b))
    if (da !== db) return da - db
    return Number(describesDevelopment(b)) - Number(describesDevelopment(a))
  })
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

/**
 * "11 applications", or "11 applications · 10 in this area" when the development holds more than
 * the search listed. The full count comes from the tab's read; without it the listed count is all
 * that can honestly be said.
 */
export function planningCountLabel(group: PlanningDevelopmentGroup): string {
  const listed = group.applications.length
  const total = Math.max(listed, group.applications[0]?.developmentApplicationCount ?? listed)
  const noun = total === 1 ? 'application' : 'applications'
  return total > listed ? `${total} ${noun} · ${listed} in this area` : `${total} ${noun}`
}

export interface PlanningPin {
  /** The application the pin opens or stands for. */
  name: string
  lng: number
  lat: number
  /** Set only on a development pin standing for more than one application. */
  developmentKey: string | null
  count: number
}

/**
 * The Planning tab's map pins. Applications view: one per application. Developments view: one per
 * development, at the position of the application that leads its card, so a pin and its row always
 * agree on where a scheme is.
 */
export function planningPins(applications: PlanningApplication[], grouping: PlanningGrouping): PlanningPin[] {
  if (grouping === 'applications') {
    return applications.map((app) => ({ name: app.name, lng: app.lng, lat: app.lat, developmentKey: null, count: 1 }))
  }
  return groupPlanningApplications(applications).map((group) => {
    const lead = group.applications[0]
    const count = Math.max(group.applications.length, lead.developmentApplicationCount ?? 0)
    return {
      name: lead.name,
      lng: lead.lng,
      lat: lead.lat,
      developmentKey: group.applications.length > 1 ? group.key : null,
      count: group.applications.length > 1 ? count : 1,
    }
  })
}

export type PlanningHistoryEntry = PlanningApplication & { inList: boolean }

/**
 * A development's full history joined with the applications the tab already listed. A listed
 * application keeps the tab's own record; one only in the history is marked as outside this list.
 * Before the history arrives, or if it fails, the listed applications are the whole timeline.
 */
export function mergeDevelopmentHistory(
  listed: PlanningApplication[],
  history: PlanningApplication[] | null
): PlanningHistoryEntry[] {
  const byName = new Map<string, PlanningHistoryEntry>(listed.map((app) => [app.name, { ...app, inList: true }]))
  for (const app of history ?? []) {
    if (!byName.has(app.name)) byName.set(app.name, { ...app, inList: false })
  }
  return [...byName.values()]
}

import {
  familyKey,
  followOnKind,
  linkCouncilApplications,
  type ApplicationFamily,
  type ApplicationLink,
  type LinkableApplication,
} from './linking'

/**
 * Group before classifying. See docs/planning-pilot-completion-plan.md, step 3a.
 *
 * Related applications are grouped from stored links, with no provider requests, and each
 * development is assessed once:
 * - the original proposal is assessed together with its significant amendments (section 73
 *   variations, material amendments, reserved matters);
 * - routine paperwork (condition submissions, non-material amendments) joins the timeline and is
 *   never classified on its own;
 * - where the original is missing, a family with a significant member is still assessed from that
 *   member and its parent is requested; a family of routine paperwork only waits for its parent
 *   instead of being graded low;
 * - uncertain links (weak only, or a family citing several missing permissions) stay separate.
 */
export type AssessmentRole =
  | 'assess'                 // heads its own assessment
  | 'assess_with_family'     // read inside another application's assessment
  | 'timeline'               // routine paperwork on a development's timeline, never classified
  | 'await_parent'           // unclear without its missing original: flagged for parent retrieval

export interface AssessableApplication extends LinkableApplication {
  intelligence_tier: boolean
}

export interface AssessmentUnit {
  /** The application whose development carries the assessment. */
  headId: string
  /** Every application read together in the assessment, head first. */
  memberIds: string[]
  /** Routine paperwork attached to the same development's timeline. */
  timelineIds: string[]
  /** Parent references to request before or alongside the assessment. */
  missingParentReferences: string[]
  /** True when the unit is kept separate because its links were uncertain. */
  uncertain: boolean
}

export interface AssessmentPlan {
  units: AssessmentUnit[]
  roles: Map<string, AssessmentRole>
  /** Families of routine paperwork whose original is missing: requested, not assessed. */
  awaitingParent: Array<{ applicationIds: string[]; missingParentReferences: string[] }>
}

// A section 96A application is a non-material amendment by law, whether or not the description says
// so: "Application under s96a ... for amendments to Condition 2 (Approved drawings)" at Nine Elms.
const NON_MATERIAL = /\bnon[\s-]*material\b|\bs(?:ection)?\.?\s*96\s*a\b/i

/** Paperwork that does not change what is built. */
export function isRoutineFollowOn(application: Pick<LinkableApplication, 'description' | 'procedure'>): boolean {
  const kind = followOnKind(application)
  if (kind === 'condition') return true
  return kind === 'amendment' && NON_MATERIAL.test(application.description ?? '')
}

/** A follow-on that changes the scheme and belongs in its assessment. */
export function isSignificantFollowOn(application: Pick<LinkableApplication, 'description' | 'procedure'>): boolean {
  const kind = followOnKind(application)
  return kind === 'reserved_matters' || (kind === 'amendment' && !NON_MATERIAL.test(application.description ?? ''))
}

function quotedAsOneChain(family: ApplicationFamily, links: ApplicationLink[]): boolean {
  const members = new Set(family.applicationIds)
  const missing = new Set(family.missingParentReferences)
  const cited = new Map<string, Set<string>>()
  for (const link of links) {
    if (link.strength !== 'strong' || link.parentId || !members.has(link.childId)) continue
    cited.set(link.childId, (cited.get(link.childId) ?? new Set()).add(link.parentReference))
  }
  return [...cited.values()].some(references => [...missing].every(reference => references.has(reference)))
}

// The family's own original first, then significant follow-ons oldest reference first.
function headOrder(a: AssessableApplication, b: AssessableApplication): number {
  const rank = (application: AssessableApplication) => followOnKind(application) === null ? 0 : isSignificantFollowOn(application) ? 1 : 2
  return rank(a) - rank(b) || a.reference.localeCompare(b.reference)
}

/**
 * Plan the assessments for one council's applications. Only families that contain an application in
 * the intelligence tier need an assessment; the rest of the council is context for linking.
 */
export function planCouncilAssessments(
  applications: AssessableApplication[],
  linked?: { links: ApplicationLink[]; families: ApplicationFamily[] }
): AssessmentPlan {
  const { links, families } = linked ?? linkCouncilApplications(applications)
  const byId = new Map(applications.map(application => [application.id, application]))
  const roles = new Map<string, AssessmentRole>()
  const units: AssessmentUnit[] = []
  const awaitingParent: AssessmentPlan['awaitingParent'] = []
  const grouped = new Set<string>()
  const weaklyLinked = new Set(links.filter(link => link.strength === 'weak').map(link => link.childId))

  for (const family of families) {
    const members = family.applicationIds.map(id => byId.get(id)!).filter(Boolean)
    if (!members.some(member => member.intelligence_tier)) continue
    members.forEach(member => grouped.add(member.id))

    // A family citing several missing permissions is usually a phased masterplan or a mistake:
    // keep each tier application separate until someone reviews it. The exception is a chain that
    // one member quotes in full ("permission 2019/4915 (as varied by NMA 2025/2720)"): that is one
    // scheme's history, not competing permissions.
    if (family.missingParentReferences.length > 1 && !quotedAsOneChain(family, links)) {
      for (const member of members.filter(m => m.intelligence_tier)) {
        roles.set(member.id, isRoutineFollowOn(member) ? 'await_parent' : 'assess')
        if (isRoutineFollowOn(member)) {
          awaitingParent.push({ applicationIds: [member.id], missingParentReferences: family.missingParentReferences })
        } else {
          units.push({ headId: member.id, memberIds: [member.id], timelineIds: [], missingParentReferences: family.missingParentReferences, uncertain: true })
        }
      }
      for (const member of members.filter(m => !m.intelligence_tier)) roles.set(member.id, 'timeline')
      continue
    }

    const root = family.rootId ? byId.get(family.rootId) ?? null : null
    const readable = members.filter(member => member.id === root?.id || !isRoutineFollowOn(member))
    const routine = members.filter(member => !readable.includes(member))
    if (readable.length === 0) {
      routine.forEach(member => roles.set(member.id, 'await_parent'))
      awaitingParent.push({ applicationIds: routine.map(m => m.id), missingParentReferences: family.missingParentReferences })
      continue
    }
    const ordered = [...readable].sort((a, b) => (a.id === root?.id ? -1 : b.id === root?.id ? 1 : headOrder(a, b)))
    const head = ordered[0]
    roles.set(head.id, 'assess')
    ordered.slice(1).forEach(member => roles.set(member.id, 'assess_with_family'))
    routine.forEach(member => roles.set(member.id, 'timeline'))
    units.push({
      headId: head.id,
      memberIds: ordered.map(member => member.id),
      timelineIds: routine.map(member => member.id),
      missingParentReferences: root ? [] : family.missingParentReferences,
      uncertain: false,
    })
  }

  for (const application of applications) {
    if (grouped.has(application.id) || !application.intelligence_tier) continue
    roles.set(application.id, 'assess')
    units.push({
      headId: application.id, memberIds: [application.id], timelineIds: [], missingParentReferences: [],
      uncertain: weaklyLinked.has(application.id),
    })
  }

  return { units, roles, awaitingParent }
}

export interface AssessmentCounts {
  tierApplications: number
  assessments: number
  /** Permanent savings: tier applications that are never assessed on their own. */
  tierReadInsideAnotherAssessment: number
  tierPaperworkOnTimeline: number
  /** Deferred, not saved: tier applications waiting for their original before any assessment. */
  tierAwaitingParent: number
  assessmentsAlsoRequestingParent: number
  uncertainKeptSeparate: number
  nonTierInTierFamilies: number
  /** Distinct missing originals (one lookup each), by case number within the council. */
  distinctParentsBlockingDeferred: number
  distinctParentsRequestedByAssessments: number
  distinctParentsTotal: number
}

export function countAssessments(applications: AssessableApplication[], plan: AssessmentPlan): AssessmentCounts {
  const tier = new Set(applications.filter(a => a.intelligence_tier).map(a => a.id))
  const tierWithRole = (role: AssessmentRole) => [...plan.roles].filter(([id, r]) => r === role && tier.has(id)).length
  const blocking = new Set(plan.awaitingParent.flatMap(entry => entry.missingParentReferences.map(familyKey)))
  const requested = new Set(plan.units.flatMap(unit => unit.missingParentReferences.map(familyKey)))
  return {
    tierApplications: tier.size,
    assessments: plan.units.length,
    tierReadInsideAnotherAssessment: tierWithRole('assess_with_family'),
    tierPaperworkOnTimeline: tierWithRole('timeline'),
    tierAwaitingParent: tierWithRole('await_parent'),
    assessmentsAlsoRequestingParent: plan.units.filter(unit => unit.missingParentReferences.length > 0 && !unit.uncertain).length,
    uncertainKeptSeparate: plan.units.filter(unit => unit.uncertain).length,
    nonTierInTierFamilies: [...plan.roles].filter(([id]) => !tier.has(id)).length,
    distinctParentsBlockingDeferred: blocking.size,
    distinctParentsRequestedByAssessments: requested.size,
    distinctParentsTotal: new Set([...blocking, ...requested]).size,
  }
}

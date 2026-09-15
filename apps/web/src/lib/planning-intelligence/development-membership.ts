import {
  isSignificantFollowOn,
  planCouncilAssessments,
  type AssessableApplication,
} from './assessment-groups'
import {
  familiesFromLinks,
  familyKey,
  followOnKind,
  type ApplicationLink,
} from './linking'

/**
 * Development linking, step 5: one Development per family. See
 * docs/planning-development-linking-plan.md, "Step 5".
 *
 * Pure. It reads a family's applications, its stored links, current memberships and the guards on
 * the Developments involved, and says what should change. `planning_apply_family_plan` applies one
 * family's plan in a single transaction and re-checks every guard under lock; this module decides,
 * the database protects.
 *
 * The grouping rules are `assessment-groups.ts`'s, so the count report, the classifier and the
 * membership written here cannot disagree about who leads a family or what is paperwork.
 */

export type MembershipRole = 'principal' | 'amendment' | 'member' | 'condition' | 'related'
export type FamilyState = 'family' | 'awaiting_original'

export interface MembershipApplication extends AssessableApplication {
  classification_state: string
  date_received?: string | null
}

/** A row of `planning_application_links` that has not been removed. */
export interface StoredLink extends ApplicationLink {
  id: string
}

export interface CurrentMembership {
  applicationId: string
  developmentId: string
  role: string
}

export interface DevelopmentGuard {
  id: string
  reviewState: string
  researchState: string
  /** True when an admin has decided any of its facts. */
  decidedFacts: boolean
  principalApplicationId: string | null
  familyState: string
  firstSeenAt: string | null
}

export interface MemberChange {
  applicationId: string
  role: MembershipRole
  /** The strong links that justify this application joining; removed together on detach. */
  linkIds: string[]
}

export type HoldReason =
  | 'several_missing_originals'
  | 'plota_conflict'
  | 'protected_development'

export type FamilyPlan =
  | {
      action: 'apply'
      familyKey: string
      /** Null creates a Development for the family. */
      targetDevelopmentId: string | null
      headApplicationId: string
      principalApplicationId: string | null
      familyState: FamilyState
      members: MemberChange[]
      /** Paperwork-only families: a grade read from paperwork is not a grade of the scheme. */
      clearMachineGrade: boolean
      /** The principal must write the Development's description, so it is (re)classified. */
      queueClassification: string[]
      /** A principal outside the tier admitted because a member qualifies (limb 'F'). */
      admitByFamily: string[]
      missingParentKeys: string[]
    }
  | {
      action: 'hold'
      familyKey: string
      reason: HoldReason
      applicationIds: string[]
      missingParentKeys: string[]
      detail: string
    }
  | { action: 'unchanged'; familyKey: string; applicationIds: string[] }

export interface MembershipInput {
  applications: MembershipApplication[]
  links: StoredLink[]
  memberships: CurrentMembership[]
  developments: DevelopmentGuard[]
  /** Parent keys whose Plota family disagrees with local links and awaits review. */
  conflictedParentKeys: Set<string>
}

const PAPERWORK_ROLES = new Set<string>(['condition', 'related'])
const WRITING_ROLES = new Set<string>(['primary', 'principal'])

/** A Development a person has acted on, or paid research has touched, is never merged away automatically. */
export function isProtected(development: DevelopmentGuard): boolean {
  return development.reviewState !== 'pending'
    || development.researchState === 'processing'
    || development.researchState === 'complete'
    || development.decidedFacts
}

function routineRole(application: MembershipApplication): MembershipRole {
  return followOnKind(application) === 'condition' ? 'condition' : 'related'
}

/** The application whose classification currently writes the Development's description. */
function authorOf(development: DevelopmentGuard, memberships: CurrentMembership[]): string | null {
  if (development.principalApplicationId) return development.principalApplicationId
  const writers = memberships.filter(m => m.developmentId === development.id && WRITING_ROLES.has(m.role))
  return writers.length === 1 ? writers[0].applicationId : null
}

export function planFamilyMemberships(input: MembershipInput): FamilyPlan[] {
  const { applications, links, memberships, developments, conflictedParentKeys } = input
  const byId = new Map(applications.map(application => [application.id, application]))
  const membershipOf = new Map(memberships.map(m => [m.applicationId, m]))
  const developmentById = new Map(developments.map(d => [d.id, d]))
  const families = familiesFromLinks(applications, links)
  const assessment = planCouncilAssessments(applications, { links, families })
  const plans: FamilyPlan[] = []

  for (const family of families) {
    const ids = family.applicationIds
    const members = ids.map(id => byId.get(id)!).filter(Boolean)
    if (!members.some(member => member.intelligence_tier)) continue
    // One stored application citing a missing original is not a family yet: there is nothing to
    // group, and clearing a lone application's grade or jumping its lookup ahead would be a
    // national change to single applications, not step 5's.
    if (members.length < 2) continue
    const missingParentKeys = [...new Set(family.missingParentReferences.map(familyKey))]
    const hold = (reason: HoldReason, detail: string): FamilyPlan =>
      ({ action: 'hold', familyKey: family.key, reason, applicationIds: ids, missingParentKeys, detail })

    const familyKeys = new Set([...missingParentKeys, ...members.map(member => familyKey(member.reference))])
    const conflict = [...familyKeys].find(key => conflictedParentKeys.has(key))
    if (conflict) { plans.push(hold('plota_conflict', `Plota's family for ${conflict} disagrees with local links`)); continue }

    // The assessment plan already decided lead, read-with and paperwork for this family.
    // A family the assessment plan split up (several missing permissions, not one quoted chain)
    // comes back as more than one unit or waiting entry; it is not grouped automatically.
    const units = assessment.units.filter(candidate => ids.includes(candidate.headId))
    const waiting = assessment.awaitingParent.filter(entry => entry.applicationIds.some(id => ids.includes(id)))
    const unit = units[0]
    const awaiting = waiting[0]
    if (units.some(candidate => candidate.uncertain) || units.length + waiting.length !== 1) {
      plans.push(hold('several_missing_originals', `cites ${family.missingParentReferences.join(', ')}`))
      continue
    }

    let headApplicationId: string
    let principalApplicationId: string | null
    let familyState: FamilyState
    const roles = new Map<string, MembershipRole>()
    if (unit) {
      headApplicationId = unit.headId
      principalApplicationId = unit.headId
      familyState = family.rootId ? 'family' : 'awaiting_original'
      roles.set(unit.headId, 'principal')
      for (const id of unit.memberIds.slice(1)) roles.set(id, isSignificantFollowOn(byId.get(id)!) ? 'amendment' : 'member')
      for (const id of unit.timelineIds) roles.set(id, routineRole(byId.get(id)!))
    } else {
      const ordered = [...awaiting!.applicationIds].sort((a, b) => byId.get(a)!.reference.localeCompare(byId.get(b)!.reference))
      headApplicationId = ordered[0]
      principalApplicationId = null
      familyState = 'awaiting_original'
      for (const id of ordered) roles.set(id, routineRole(byId.get(id)!))
    }

    // Which Development the family lives in.
    const memberDevelopments = [...new Set(ids.map(id => membershipOf.get(id)?.developmentId).filter((d): d is string => Boolean(d)))]
      .map(id => developmentById.get(id))
      .filter((d): d is DevelopmentGuard => Boolean(d))
    const protectedDevelopments = memberDevelopments.filter(isProtected)
    if (protectedDevelopments.length > 1) {
      plans.push(hold('protected_development', `${protectedDevelopments.length} Developments in this family have been reviewed or researched`))
      continue
    }
    // A principal's own Development carries its classification, so the family moves into it. With no
    // principal the choice is arbitrary, and the oldest keeps it stable across runs.
    const headDevelopment = principalApplicationId ? membershipOf.get(principalApplicationId)?.developmentId ?? null : null
    const target = protectedDevelopments[0]
      ?? (headDevelopment ? developmentById.get(headDevelopment) : undefined)
      ?? [...memberDevelopments].sort((a, b) => (a.firstSeenAt ?? '').localeCompare(b.firstSeenAt ?? '') || a.id.localeCompare(b.id))[0]
      ?? null

    const changes: MemberChange[] = []
    for (const id of ids) {
      const role = roles.get(id)
      if (!role) continue
      const current = membershipOf.get(id)
      if (target && current?.developmentId === target.id && current.role === role) continue
      // A single application keeps its legacy 'primary' role when it leads its own Development.
      if (target && current?.developmentId === target.id && role === 'principal' && current.role === 'primary') continue
      changes.push({
        applicationId: id,
        role,
        linkIds: links.filter(link => link.childId === id && link.strength === 'strong').map(link => link.id),
      })
    }

    const author = target ? authorOf(target, memberships) : null
    const principalChanges = principalApplicationId !== null && author !== principalApplicationId
    if (target && isProtected(target)) {
      const intrusive = changes.filter(change => !PAPERWORK_ROLES.has(change.role) && membershipOf.get(change.applicationId)?.developmentId !== target.id)
      if (intrusive.length > 0 || principalChanges || (principalApplicationId === null && author !== null)) {
        plans.push(hold('protected_development', 'Only paperwork may join a reviewed or researched Development'))
        continue
      }
    }

    const principal = principalApplicationId ? byId.get(principalApplicationId)! : null
    // The principal is graded again, from its family, when what the scheme is may have changed: a
    // new principal, or a significant change joining (pilot plan 3a). Paperwork joining never
    // triggers a grade; it only lengthens the timeline.
    const significantJoined = changes.some((change) =>
      !PAPERWORK_ROLES.has(change.role) && change.applicationId !== principalApplicationId
      && membershipOf.get(change.applicationId)?.developmentId !== target?.id)
    const queueClassification = principal && (principalChanges || significantJoined) ? [principal.id] : []
    const admitByFamily = principal && !principal.intelligence_tier ? [principal.id] : []
    const clearMachineGrade = principalApplicationId === null && author !== null
    const stateChanges = !target
      || target.familyState !== familyState
      || target.principalApplicationId !== principalApplicationId

    if (changes.length === 0 && !stateChanges && queueClassification.length === 0) {
      plans.push({ action: 'unchanged', familyKey: family.key, applicationIds: ids })
      continue
    }
    plans.push({
      action: 'apply',
      familyKey: family.key,
      targetDevelopmentId: target?.id ?? null,
      headApplicationId,
      principalApplicationId,
      familyState,
      members: changes,
      clearMachineGrade,
      queueClassification,
      admitByFamily,
      missingParentKeys,
    })
  }
  return plans
}

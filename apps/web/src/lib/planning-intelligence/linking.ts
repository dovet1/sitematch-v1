/**
 * Groups one council's planning applications into families: a permission and the variations,
 * amendments, reserved matters, condition submissions and companion consents that follow it.
 *
 * Pure and deterministic, so the national report, the tests and the eventual trigger all read the
 * same rules. Nothing here writes to the database or calls a provider.
 *
 * Only exact evidence links automatically, the same two ways Plota's own associated endpoint
 * links: a description that cites another reference of the same council, and a follow-on
 * reference that carries its parent's case number. Proximity, UPRN and address never create a
 * link on their own; at Edinburgh a shared UPRN joined unrelated short-term lets in one tenement.
 *
 * A citation is strong only when the description says what it is doing to that application
 * ("discharge of condition 14 of 2024/3141", "Linked with 26/03956/FULL"). An incidental mention
 * ("land adjacent to the site approved under ...") is kept as a weak link for a reviewer and never
 * joins a family.
 */

export interface LinkableApplication {
  id: string
  reference: string
  description?: string | null
  procedure?: string | null
  address?: string | null
  postcode?: string | null
  uprn?: string | null
}

export type FollowOnKind = 'condition' | 'amendment' | 'reserved_matters'
export type LinkKind = FollowOnKind | 'companion' | 'cited'
export type LinkStrength = 'strong' | 'weak'
export type LinkSource = 'cited_reference' | 'reference_core'

export interface ApplicationLink {
  childId: string
  /** The reference as cited, or the parent case number for a core link, normalised. */
  parentReference: string
  /** Null when the parent is not among the applications supplied. */
  parentId: string | null
  kind: LinkKind
  strength: LinkStrength
  source: LinkSource
  /** The text that justifies the link, so a reviewer can see why it exists. */
  evidence: string
}

export interface ApplicationFamily {
  key: string
  applicationIds: string[]
  /** The stored application that heads the family, when one does. */
  rootId: string | null
  /** Parent references cited by members but not among the applications supplied. */
  missingParentReferences: string[]
}

export function normaliseReference(reference: string): string {
  return reference.toUpperCase().replace(/\s+/g, '')
}

function referenceShape(reference: string): string {
  return normaliseReference(reference).replace(/[0-9]/g, '9').replace(/[A-Z]/g, 'A')
}

/**
 * The reference formats a council actually uses, learned from its own stored references. A token
 * in a description counts as a citation only if it has one of these shapes, which is what stops
 * use classes ("B2/B8"), bedroom counts and measurements being read as references. A shape must
 * be a real share of the council's references, not a one-off typo.
 */
export function councilReferenceShapes(references: string[]): Set<string> {
  const counts = new Map<string, number>()
  for (const reference of references) {
    const shape = referenceShape(reference)
    counts.set(shape, (counts.get(shape) ?? 0) + 1)
  }
  const floor = Math.max(3, references.length * 0.005)
  return new Set([...counts].filter(([, count]) => count >= floor).map(([shape]) => shape))
}

// Follow-on suffixes, measured against Plota's procedure on 24,740 national applications. A suffix
// must start with letters: some councils glue a running number to the type ("00023FULL"), and
// splitting those would put a whole month of unrelated applications into one family.
const CONDITION_SUFFIX = /^(?:COND(?:S|\d{0,3}[A-Z]?)?|CND\d*|DISCON\d*|DISC(?:_[A-Z]|\d*)|DIS\d*|DOC\d*|DC\d*|DCON\d*|DETAIL\d*|DRC\d*|AOC\d*|AMC\d*|MSC\d*|AD(?:FULL|LBC|ADV))$/
// These also label ordinary applications at some councils (DET was 37 of 106 full applications),
// so they only link when the application's own wording agrees it is a condition submission.
const AMBIGUOUS_CONDITION_SUFFIX = /^(?:DET\d*|CON\d*|SUB\d*|CN\d*)$/
const AMENDMENT_SUFFIX = /^(?:NMA\d*|NMV\d*|NMC\d*|VAR\d*|MMA\d*|AMD\d*|S73\d*)$/
// The family a follow-on suffix belongs to, longest first, so reuse is measured per family.
const SUFFIX_FAMILIES = ['ADFULL', 'ADLBC', 'ADADV', 'DISCON', 'DETAIL', 'CONDS', 'COND', 'DCON', 'DISC', 'CND', 'DIS', 'DOC',
  'DRC', 'AOC', 'AMC', 'MSC', 'DET', 'CON', 'SUB', 'DC', 'CN', 'NMA', 'NMV', 'NMC', 'VAR', 'MMA', 'AMD', 'S73']
function suffixFamily(suffix: string): string | null {
  return SUFFIX_FAMILIES.find(family => suffix.startsWith(family)) ?? null
}
const PRINCIPAL_SUFFIX = /^(?:FUL|FULL|F|FA|FU|FPA|PP|PLF|O|OUT|OUTL|PIP|HYB|RM|REM|ARM|MAJ)$/
const COMPANION_SUFFIX = /^(?:LBC|LBA|LB|ADV|CAC)$/

/**
 * Splits "21/03456/CONDA" into its case number and type suffix, when it has that form. Also reads
 * a trailing sequence ("22/01714/DOC/8") and year-last numbering ("S/2903/14/COND50B").
 */
export function referenceCore(reference: string): { core: string; suffix: string } | null {
  const match = normaliseReference(reference).match(/^(.*\d)[/\-.]([A-Z]{1,8}(?:\d{1,3}[A-Z]?)?|[A-Z]+_[A-Z])(?:[/\-.]\d{1,3})?$/)
  return match && /\d{3,}/.test(match[1]) ? { core: match[1], suffix: match[2] } : null
}

const AMENDMENT_WORDING = /\bnon[\s-]*material\s+(?:amendment|variation|change|minor)|\bminor\s+material\s+amendment|\bvariation\s+(?:of|to)\s+(?:the\s+)?(?:conditions?|planning|wording)|\bremov(?:e|al)\s+(?:of\s+)?conditions?|\bvary(?:ing)?\s+(?:conditions?|the\s+wording)|\bsection\s+73\b|\bs\.?\s?73\b|\bamendments?\s+to\s+(?:the\s+)?(?:previously\s+)?(?:approved|planning|permission|consent|application|scheme)/i
const CONDITION_LEAD = /^\s*(?:application\s+for\s+)?(?:(?:partial\s+)?discharge|approval\s+of\s+details|submission\s+of\s+details|compliance\s+with|details?\b)/i
const RESERVED_MATTERS_WORDING = /\breserved\s+matters\b/i
const CONDITION_WORDING = /\b(?:discharge|approval|submission|compliance)\s+(?:of\s+|with\s+)?(?:the\s+)?(?:details?|conditions?)\b|\bdetails?\s+(?:of|for|pursuant|reserved|required|submitted|in\s+relation)\b|\bpursuant\s+to\s+(?:conditions?|schedule|clause|s\.?\s?106|section\s+106)\b|\bmatters\s+(?:pursuant|reserved\s+by|specified\s+in)\b/i

/**
 * What an application does to an earlier one, from its own wording first and Plota's procedure
 * second. Wording wins because procedure is normalised per council and was wrong in both
 * directions in earlier samples: Wandsworth labels condition submissions "full".
 */
export function followOnKind(application: Pick<LinkableApplication, 'description' | 'procedure'>): FollowOnKind | null {
  const description = application.description ?? ''
  if (CONDITION_LEAD.test(description) && !AMENDMENT_WORDING.test(description.slice(0, 60))) return 'condition'
  if (AMENDMENT_WORDING.test(description)) return 'amendment'
  if (RESERVED_MATTERS_WORDING.test(description)) return 'reserved_matters'
  if (CONDITION_WORDING.test(description)) return 'condition'
  if (application.procedure === 'discharge') return 'condition'
  if (application.procedure === 'amendment') return 'amendment'
  if (application.procedure === 'reserved-matters') return 'reserved_matters'
  return null
}

// No spaces inside a reference: allowing them glued "2024/3141 - minor" and "ref. 2026/0443" into
// tokens that match no council format. Some councils use no separator at all (Ealing 244424FUL,
// Waltham Forest 202881); those are read separately and must match the council's own format.
const TOKEN = /\b[A-Z0-9]{1,8}(?:[/\-.][A-Z0-9]{1,8}){1,4}\b/gi
const UNSEPARATED_TOKEN = /\b\d{5,8}[A-Z]{0,5}\b/gi
const DATE = /^\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4}$/
// The text just before a citation decides what it means. "Appeal" is not incidental: "condition 7
// of appeal permission 22/02067/F" is a genuine parent, and appeal references (APP/...) are
// excluded as tokens anyway.
const INCIDENTAL_CUE = /\b(?:adjacent|adjoining|neighbouring|next\s+to|land\s+(?:to\s+the\s+)?(?:north|south|east|west|rear)\s+of|similar\s+to|superseded)\b[^;\n]{0,60}$|\b(?:refused|withdrawn|dismissed)\b[^;\n]{0,25}$/i
const COMPANION_CUE = /\b(?:linked|in\s+conjunction|concurrent(?:ly)?|accompanying|together)\b(?:\s+with)?[^.;]{0,40}$/i
// Follow-on descriptions phrase their parent many ways: "on PL/09173", "from planning application",
// "in respect of Decision Notice PA23/04991", "permission dated 28th March 2024 (RN: 23/08605/FULL)".
// A connecting word shortly before the reference is enough once the application is a follow-on.
const REFERENCE_CUE = /\b(?:of|to|on|from|re|under|for|regarding|relating\s+to|in\s+respect\s+of|pursuant\s+to|attached\s+to|approved|granted|permission|consent|application|applicaiton|approval|notice|notification|decision|ref(?:erence)?|rn|no|number|by)\b[^;\n]{0,45}$/i
// A reference in a format the council no longer uses (Richmond's 24/2692/VRC under PA26/1518) is
// accepted only when a naming word sits right before it.
const NAMING_CUE = /\b(?:permission|consent|application|applicaiton|approval|notice|ref(?:erence)?|rn|no)\b[\s.:#("'’-]*$/i
// Needs a slash: a hyphenated token after "their ref" was another authority's reference
// (Surrey County Council's SCCRef-2026-0086 on a Runnymede consultation).
const REFERENCE_LIKE = /^(?=(?:\D*\d){5})(?=.*\d{3})(?=.*\/)[A-Z0-9]+(?:[/\-.][A-Z0-9]+)+$/

interface Citation { token: string; index: number; familiar: boolean }

function citations(application: LinkableApplication, shapes: Set<string>): Citation[] {
  const own = normaliseReference(application.reference)
  const description = application.description ?? ''
  const seen = new Set<string>()
  const found: Citation[] = []
  const matches = [...description.matchAll(TOKEN), ...description.matchAll(UNSEPARATED_TOKEN)]
    .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
  for (const match of matches) {
    // "ref.25/00552/FUL" arrives glued to its label.
    const token = normaliseReference(match[0]).replace(/^(?:REF|NO|RN)[.:]?(?=[A-Z]{0,4}\d)/, '')
    if (token === own || seen.has(token) || !/\d/.test(token) || DATE.test(token) || token.startsWith('APP/')) continue
    const familiar = shapes.has(referenceShape(token))
    const index = match.index ?? 0
    if (!familiar && !(REFERENCE_LIKE.test(token) && NAMING_CUE.test(description.slice(Math.max(0, index - 40), index)))) continue
    seen.add(token)
    found.push({ token, index, familiar })
  }
  return found
}

function evidenceAround(description: string, index: number, length: number): string {
  return description.slice(Math.max(0, index - 60), index + length + 10).trim()
}

function addressTokens(address: string | null | undefined): Set<string> {
  return new Set((address ?? '').toUpperCase().match(/[A-Z0-9]{3,}/g) ?? [])
}

/** Plota links shared case numbers only when the records also share a site; so does this. */
function sameSite(a: LinkableApplication, b: LinkableApplication): boolean {
  if (a.uprn && b.uprn) return String(a.uprn) === String(b.uprn)
  if (a.postcode && b.postcode) return normaliseReference(a.postcode) === normaliseReference(b.postcode)
  const left = addressTokens(a.address), right = addressTokens(b.address)
  if (left.size === 0 || right.size === 0) return false
  const shared = [...left].filter(token => right.has(token)).length
  return shared / (left.size + right.size - shared) >= 0.5
}

/**
 * Whether this council numbers one suffix family of follow-on off its parent's case number.
 * Measured per family because councils mix: Cambridge reuses the number for condition submissions
 * (21/02957/COND16A) but gives section 73 applications their own (26/01408/S73 varies
 * 25/00259/FUL), and Falkirk reuses it for COND but not MSC. Two independent signs:
 * follow-ons that quote a parent quote one with their own number, or follow-on references often
 * share a number with a stored permission. Neither is assumed from a handful of cases.
 */
function councilReusesCaseNumbers(
  applications: LinkableApplication[], shapes: Set<string>, byCore: Map<string, LinkableApplication[]>, family: string
): boolean {
  let quotedOwn = 0, quotedOther = 0, followOnReferences = 0, withPermissionSibling = 0
  for (const application of applications) {
    const parts = referenceCore(application.reference)
    if (!parts || suffixFamily(parts.suffix) !== family) continue
    followOnReferences++
    if ((byCore.get(parts.core) ?? []).some(sibling => sibling.id !== application.id
      && PRINCIPAL_SUFFIX.test(referenceCore(sibling.reference)!.suffix))) withPermissionSibling++
    const cores = citations(application, shapes).map(citation => referenceCore(citation.token)?.core ?? citation.token)
    if (cores.length === 0) continue
    if (cores.some(core => core === parts.core || core.endsWith(`/${parts.core}`))) quotedOwn++
    else quotedOther++
  }
  const quoted = quotedOwn + quotedOther
  return (quoted >= 5 && quotedOwn / quoted >= 0.5) || (followOnReferences >= 5 && withPermissionSibling / followOnReferences >= 0.2)
}

class UnionFind {
  private readonly parent = new Map<string, string>()
  find(key: string): string {
    let root = key
    while (this.parent.has(root) && this.parent.get(root) !== root) root = this.parent.get(root)!
    this.parent.set(key, root)
    return root
  }
  union(a: string, b: string) {
    const ra = this.find(a), rb = this.find(b)
    if (ra !== rb) this.parent.set(ra > rb ? ra : rb, ra > rb ? rb : ra)
  }
}

function principalRank(application: LinkableApplication): number {
  const suffix = referenceCore(application.reference)?.suffix
  if (followOnKind(application)) return 2
  if (suffix && COMPANION_SUFFIX.test(suffix)) return 1
  return 0
}

export function linkCouncilApplications(applications: LinkableApplication[]): {
  links: ApplicationLink[]
  families: ApplicationFamily[]
} {
  const byId = new Map(applications.map(application => [application.id, application]))
  const byReference = new Map(applications.map(application => [normaliseReference(application.reference), application]))
  const byCore = new Map<string, LinkableApplication[]>()
  for (const application of applications) {
    const parts = referenceCore(application.reference)
    if (parts) byCore.set(parts.core, [...(byCore.get(parts.core) ?? []), application])
  }
  const shapes = councilReferenceShapes(applications.map(application => application.reference))
  const links: ApplicationLink[] = []
  const reuseByFamily = new Map<string, boolean>()
  const reuses = (family: string | null) => {
    if (!family) return false
    if (!reuseByFamily.has(family)) reuseByFamily.set(family, councilReusesCaseNumbers(applications, shapes, byCore, family))
    return reuseByFamily.get(family)!
  }

  const resolve = (token: string, childId: string): LinkableApplication | null => {
    const exact = byReference.get(token)
    if (exact && exact.id !== childId) return exact
    // "Condition 3 of 24/01333/FUL" where only 24/01333/CND2 is stored names a missing permission,
    // not the sibling condition submission; resolving to the sibling would misplace the parent.
    const core = referenceCore(token)?.core ?? token
    const candidates = (byCore.get(core) ?? []).filter(candidate => candidate.id !== childId && principalRank(candidate) < 2)
    return [...candidates].sort((a, b) => principalRank(a) - principalRank(b) || a.reference.localeCompare(b.reference))[0] ?? null
  }

  for (const application of applications) {
    const description = application.description ?? ''
    const kind = followOnKind(application)
    const linkedParents = new Set<string>()
    const citedCores = new Set<string>()

    for (const { token, index, familiar } of citations(application, shapes)) {
      const before = description.slice(Math.max(0, index - 90), index)
      // An unfamiliar format is only trusted as a follow-on's parent, never as a loose mention.
      if (!familiar && !kind) continue
      const parent = resolve(token, application.id)
      let linkKind: LinkKind = 'cited'
      let strength: LinkStrength = 'weak'
      if (!INCIDENTAL_CUE.test(before)) {
        if (COMPANION_CUE.test(before)) { linkKind = 'companion'; strength = 'strong' }
        else if (kind && REFERENCE_CUE.test(before)) { linkKind = kind; strength = 'strong' }
      }
      if (parent) linkedParents.add(parent.id)
      if (strength === 'strong') citedCores.add(referenceCore(token)?.core ?? token)
      links.push({
        childId: application.id, parentReference: token, parentId: parent?.id ?? null,
        kind: linkKind, strength, source: 'cited_reference', evidence: evidenceAround(description, index, token.length),
      })
    }

    const parts = referenceCore(application.reference)
    if (!parts) continue
    const suffixKind: LinkKind | null = CONDITION_SUFFIX.test(parts.suffix) ? 'condition'
      : AMBIGUOUS_CONDITION_SUFFIX.test(parts.suffix) && kind === 'condition' ? 'condition'
      : AMENDMENT_SUFFIX.test(parts.suffix) ? 'amendment'
      : COMPANION_SUFFIX.test(parts.suffix) ? 'companion'
      : null
    if (!suffixKind) continue
    const siblings = (byCore.get(parts.core) ?? []).filter(sibling => sibling.id !== application.id)
    // Most councils give a condition submission or amendment its own running number with a type
    // suffix (Leeds 26/01686/COND discharges 24/03592/FU); only some reuse the parent's (Oxford,
    // Bromley, Wakefield). In the first national sample 58 of 61 unsupported case-number links were
    // the application's own number, and even with a same-numbered sibling 6 of 20 still were
    // (Bath, Breckland). So a follow-on's number links only at a council shown to reuse numbers, and
    // only when another stored application shares it or the description quotes it -- never merely
    // because the description repeats the application's own reference.
    if (suffixKind !== 'companion') {
      const quoted = description.toUpperCase().replace(/\s+/g, '').split(normaliseReference(application.reference)).join('').includes(parts.core)
      if (!reuses(suffixFamily(parts.suffix)) || (siblings.length === 0 && !quoted)) continue
    }
    const principal = siblings.find(sibling => PRINCIPAL_SUFFIX.test(referenceCore(sibling.reference)!.suffix))
    // A companion consent needs its principal present to link: two listed-building consents with
    // the same number say nothing on their own. A follow-on links to its missing parent's number.
    if (suffixKind === 'companion' && !principal) continue
    // The description already cites this parent; a second link would only repeat the evidence.
    const alreadyCited = [...citedCores].some(cited => cited === parts.core || cited.endsWith(`/${parts.core}`))
    if ((principal && linkedParents.has(principal.id)) || alreadyCited) continue
    const site = principal ?? siblings[0]
    links.push({
      childId: application.id, parentReference: parts.core, parentId: principal?.id ?? null,
      kind: suffixKind, strength: !site || sameSite(application, site) ? 'strong' : 'weak',
      source: 'reference_core', evidence: `${normaliseReference(application.reference)} shares case number ${parts.core}`,
    })
  }

  const families = new UnionFind()
  const referenceKey = (reference: string) => `ref:${referenceCore(reference)?.core ?? normaliseReference(reference)}`
  for (const application of applications) families.union(`app:${application.id}`, referenceKey(application.reference))
  const strong = links.filter(link => link.strength === 'strong')
  for (const link of strong) families.union(`app:${link.childId}`, link.parentId ? `app:${link.parentId}` : referenceKey(link.parentReference))

  const groups = new Map<string, { ids: Set<string>; missing: Set<string> }>()
  const group = (key: string) => {
    const root = families.find(key)
    if (!groups.has(root)) groups.set(root, { ids: new Set(), missing: new Set() })
    return groups.get(root)!
  }
  for (const link of strong) {
    const entry = group(`app:${link.childId}`)
    entry.ids.add(link.childId)
    if (link.parentId) entry.ids.add(link.parentId)
    else entry.missing.add(link.parentReference)
  }

  return {
    links,
    families: [...groups.values()].map(({ ids, missing }) => {
      const members = [...ids].map(id => byId.get(id)!).sort((a, b) => a.reference.localeCompare(b.reference))
      const root = [...members].sort((a, b) => principalRank(a) - principalRank(b) || a.reference.localeCompare(b.reference))
        .find(member => principalRank(member) === 0) ?? null
      // "21/03456/FUL" cited in one description and case number "21/03456" on a sibling are one
      // missing parent; report it once, by its fullest form.
      const missingByKey = new Map<string, string>()
      for (const reference of missing) {
        if (byReference.has(reference)) continue
        const key = referenceKey(reference)
        if ((missingByKey.get(key)?.length ?? 0) < reference.length) missingByKey.set(key, reference)
      }
      const missingParentReferences = [...missingByKey.values()].sort()
      return {
        key: root ? `app:${root.id}` : `ref:${missingParentReferences[0] ?? members[0].reference}`,
        applicationIds: members.map(member => member.id),
        rootId: root?.id ?? null,
        missingParentReferences,
      }
    }).sort((a, b) => a.key.localeCompare(b.key)),
  }
}

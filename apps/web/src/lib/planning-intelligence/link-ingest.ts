import type { PlanningAdminClient } from './db'
import { lookupWorthFetching, quotesMajorProposal } from './family-priority'
import {
  canHeadFamily,
  familyKey,
  linksForApplication,
  lookupKeysFor,
  normaliseReference,
  referenceCore,
  resolverFor,
  type ApplicationLink,
  type CouncilLinkProfile,
  type LinkableApplication,
} from './linking'

/**
 * Development linking, step 3: link applications to their families as they are stored.
 *
 * Writes link evidence and requests for missing families only. It never changes Development
 * membership, classification or what the planning tab shows; step 5 does that, and the two are
 * released together. Gated by PLANNING_LINKING_ENABLED so ingestion is unchanged until then.
 */
export function planningLinkingEnabled(): boolean {
  return process.env.PLANNING_LINKING_ENABLED === 'true'
}

/** The linking keys stored beside every application, computed by the same rules the linker uses. */
export function referenceKeys(reference: string): { reference_normalised: string; reference_core: string | null } {
  return { reference_normalised: normaliseReference(reference), reference_core: referenceCore(reference)?.core ?? null }
}

export const LINKING_COLUMNS = 'id,authority_slug,reference,description,procedure,address,postcode,uprn,intelligence_tier,date_received'

export type StoredApplication = LinkableApplication & { authority_slug: string; intelligence_tier?: boolean; date_received?: string | null }

export interface LinkIngestResult {
  applications: number
  links: number
  strongLinks: number
  resolvedToStoredParent: number
  lookupsRequested: number
  /** Missing originals not queued because nothing in their family is worth a request yet. */
  lookupsNotWorthFetching: number
  lookupsResolvedLocally: number
  unprofiledCouncils: string[]
}

const CHUNK = 200

function chunks<T>(items: T[], size = CHUNK): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

async function loadProfiles(db: PlanningAdminClient, councils: string[]): Promise<Map<string, CouncilLinkProfile>> {
  const profiles = new Map<string, CouncilLinkProfile>()
  for (const slugs of chunks(councils)) {
    const { data, error } = await db.from('planning_council_link_profiles')
      .select('authority_slug,reference_shapes,reusing_suffix_families').in('authority_slug', slugs)
    if (error) throw error
    for (const row of (data ?? []) as Array<{ authority_slug: string; reference_shapes: string[]; reusing_suffix_families: string[] }>) {
      profiles.set(row.authority_slug, { shapes: new Set(row.reference_shapes), reusingFamilies: new Set(row.reusing_suffix_families) })
    }
  }
  return profiles
}

/** The stored applications that could answer this page's citations and case numbers. */
async function loadCandidates(
  db: PlanningAdminClient, council: string, references: string[], cores: string[]
): Promise<StoredApplication[]> {
  const found: StoredApplication[] = []
  for (const [column, values] of [['reference_normalised', references], ['reference_core', cores]] as const) {
    for (const batch of chunks([...new Set(values)])) {
      const { data, error } = await db.from('planning_applications').select(LINKING_COLUMNS)
        .eq('authority_slug', council).in(column, batch)
      if (error) throw error
      found.push(...((data ?? []) as StoredApplication[]))
    }
  }
  return found
}

function latestDate(a: string | null, b: string | null): string | null {
  if (!a) return b
  if (!b) return a
  return a > b ? a : b
}

function linkRow(link: ApplicationLink, council: string) {
  return {
    authority_slug: council,
    child_application_id: link.childId,
    parent_application_id: link.parentId,
    parent_reference: link.parentReference,
    parent_key: familyKey(link.parentReference),
    kind: link.kind,
    strength: link.strength,
    source: link.source,
    evidence: link.evidence,
  }
}

export async function linkStoredApplications(
  db: PlanningAdminClient, applications: StoredApplication[]
): Promise<LinkIngestResult> {
  const result: LinkIngestResult = {
    applications: applications.length, links: 0, strongLinks: 0, resolvedToStoredParent: 0,
    lookupsRequested: 0, lookupsNotWorthFetching: 0, lookupsResolvedLocally: 0, unprofiledCouncils: [],
  }
  if (applications.length === 0) return result

  const byCouncil = new Map<string, StoredApplication[]>()
  for (const application of applications) {
    byCouncil.set(application.authority_slug, [...(byCouncil.get(application.authority_slug) ?? []), application])
  }
  const profiles = await loadProfiles(db, [...byCouncil.keys()])

  const rows: ReturnType<typeof linkRow>[] = []
  const lookups: Array<{ authority_slug: string; parent_key: string; parent_reference: string; child: StoredApplication }> = []
  for (const [council, councilApplications] of byCouncil) {
    const profile = profiles.get(council)
    // Without a profile the council's reference formats are unknown, and guessing them is what
    // produced the rejected case-number rules. The seeding script builds profiles for every council.
    if (!profile) { result.unprofiledCouncils.push(council); continue }

    const references: string[] = [], cores: string[] = []
    for (const application of councilApplications) {
      const keys = lookupKeysFor(application, profile)
      references.push(...keys.references)
      cores.push(...keys.cores)
    }
    const stored = await loadCandidates(db, council, references, cores)
    const known = new Map([...stored, ...councilApplications].map(application => [application.id, application]))
    const resolver = resolverFor([...known.values()])

    const seen = new Set<string>()
    for (const application of councilApplications) {
      for (const link of linksForApplication(application, profile, resolver)) {
        const row = linkRow(link, council)
        // One piece of evidence per child, family and source; a quoted reference and its case
        // number can both appear in one description.
        const key = `${row.child_application_id}|${row.parent_key}|${row.source}`
        if (seen.has(key)) continue
        seen.add(key)
        rows.push(row)
        if (link.strength !== 'strong') continue
        result.strongLinks++
        if (link.parentId) result.resolvedToStoredParent++
        else lookups.push({ authority_slug: council, parent_key: row.parent_key, parent_reference: row.parent_reference, child: application })
      }
    }
  }

  // Existing evidence is left as it is, including a link someone removed: re-ingesting an
  // application never recreates what a person took away.
  for (const batch of chunks(rows, 500)) {
    const { error } = await db.from('planning_application_links')
      .upsert(batch, { onConflict: 'child_application_id,parent_key,source', ignoreDuplicates: true })
    if (error) throw error
  }
  result.links = rows.length

  // Earlier follow-ons whose parent is in this page.
  const parents = applications.map(application => ({
    id: application.id,
    authority_slug: application.authority_slug,
    reference_normalised: normaliseReference(application.reference),
    reference_core: canHeadFamily(application) ? referenceCore(application.reference)?.core ?? null : null,
  }))
  for (const batch of chunks(parents, 500)) {
    const { data, error } = await db.rpc('planning_resolve_family_parents', { p_rows: batch })
    if (error) throw error
    result.lookupsResolvedLocally += Number(data) || 0
  }

  // One request per missing family, by its fullest cited form; the database enforces the same.
  const families = new Map<string, { authority_slug: string; parent_key: string; parent_reference: string }>()
  const signals = new Map<string, { tier: boolean; quotes: boolean; children: Set<string>; latest: string | null }>()
  for (const lookup of lookups) {
    const key = `${lookup.authority_slug}|${lookup.parent_key}`
    const current = families.get(key)
    if (!current || current.parent_reference.length < lookup.parent_reference.length) {
      families.set(key, { authority_slug: lookup.authority_slug, parent_key: lookup.parent_key, parent_reference: lookup.parent_reference })
    }
    const signal = signals.get(key) ?? { tier: false, quotes: false, children: new Set<string>(), latest: null }
    signal.tier ||= lookup.child.intelligence_tier === true
    signal.quotes ||= quotesMajorProposal(lookup.child.description, lookup.parent_reference)
    signal.children.add(lookup.child.id)
    signal.latest = latestDate(signal.latest, lookup.child.date_received ?? null)
    signals.set(key, signal)
  }

  // Only families worth a request are queued. Size counts every stored follow-on, not only this
  // page's, so a family crosses the line when its third follow-on arrives and is queued then.
  const byCouncilKeys = new Map<string, string[]>()
  for (const family of families.values()) {
    byCouncilKeys.set(family.authority_slug, [...(byCouncilKeys.get(family.authority_slug) ?? []), family.parent_key])
  }
  const storedChildren = new Map<string, string[]>()
  for (const [council, keys] of byCouncilKeys) {
    for (const batch of chunks(keys)) {
      const { data, error } = await db.from('planning_application_links').select('child_application_id,parent_key,removed_at')
        .eq('authority_slug', council).in('parent_key', batch).eq('strength', 'strong')
      if (error) throw error
      for (const row of (data ?? []) as Array<{ child_application_id: string; parent_key: string; removed_at: string | null }>) {
        if (row.removed_at) continue
        const key = `${council}|${row.parent_key}`
        signals.get(key)?.children.add(row.child_application_id)
        storedChildren.set(row.child_application_id, [...(storedChildren.get(row.child_application_id) ?? []), key])
      }
    }
  }
  // A family is active when any follow-on, stored earlier or arriving now, is recent.
  for (const batch of chunks([...storedChildren.keys()])) {
    const { data, error } = await db.from('planning_applications').select('id,date_received').in('id', batch)
    if (error) throw error
    for (const row of (data ?? []) as Array<{ id: string; date_received: string | null }>) {
      for (const key of storedChildren.get(row.id) ?? []) {
        const signal = signals.get(key)
        if (signal) signal.latest = latestDate(signal.latest, row.date_received)
      }
    }
  }
  const worthwhile = [...families.entries()].filter(([key]) => {
    const signal = signals.get(key)!
    return lookupWorthFetching({
      anyChildInTier: signal.tier, quotesMajorProposal: signal.quotes, childCount: signal.children.size, latestChildReceived: signal.latest,
    })
  }).map(([, family]) => family)
  result.lookupsNotWorthFetching = families.size - worthwhile.length
  for (const batch of chunks(worthwhile, 500)) {
    const { data, error } = await db.rpc('planning_request_family_lookups', { p_rows: batch })
    if (error) throw error
    result.lookupsRequested += Number(data) || 0
  }
  return result
}

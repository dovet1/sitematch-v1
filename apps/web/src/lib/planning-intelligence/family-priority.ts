import { describedCommercialWork } from './commercial-description'
import type { PlanningAdminClient } from './db'
import { normaliseReference } from './linking'

/**
 * The order family lookups spend requests in. Agreed with the user's reviewer (14 September 2026):
 * first the originals of Developments already judged relevant, then overlooked families with recent
 * activity, and potentially important single follow-ups as well as large families. A family's size
 * is a signal, never a gate: Broadland's warehouse club was eleven condition submissions, but one
 * discharge quoting "erection of 392 dwellings" is worth a request too.
 */
export interface LookupSignals {
  childCount: number
  /** Best classifier relevance among Developments of this family's follow-ons, if any are classified. */
  bestRelevance: 'high' | 'medium' | 'low' | null
  anyChildInTier: boolean
  latestChildReceived: string | null
  /** A follow-on's description quotes a parent proposal that reads as commercial or major housing. */
  quotesMajorProposal: boolean
}

export function lookupPriority(signals: LookupSignals, now = new Date()): number {
  let score = 0
  if (signals.bestRelevance === 'high') score += 4000
  else if (signals.bestRelevance === 'medium') score += 3000
  else if (signals.anyChildInTier) score += 2000
  if (signals.quotesMajorProposal) score += 1500
  if (signals.latestChildReceived) {
    const days = (now.getTime() - new Date(`${signals.latestChildReceived}T00:00:00Z`).getTime()) / 86_400_000
    if (days <= 180) score += 500
  }
  score += 100 * Math.min(signals.childCount, 10)
  return score
}

const MAJOR_HOUSING = /\b(\d{2,4})\s*(?:no\.?\s*)?(?:x\s*)?(?:new\s+)?(?:residential\s+)?(?:dwellings?|homes|houses|flats|apartments|residential\s+units|units)\b/i

/**
 * What a follow-on quotes of its parent's proposal: the text after the parent reference, where
 * councils conventionally restate the permission ("of permission 2021/3958 (Demolition of ... and
 * erection of 392 dwellings)").
 */
export function quotesMajorProposal(description: string | null | undefined, parentReference: string): boolean {
  const text = (description ?? '').replace(/\s+/g, ' ')
  const at = text.toUpperCase().replace(/\s+/g, ' ').indexOf(normaliseReference(parentReference))
  const quoted = at === -1 ? text : text.slice(at + parentReference.length)
  const housing = quoted.match(MAJOR_HOUSING)
  if (housing && Number(housing[1]) >= 15) return true
  // The quoted proposal usually sits in brackets or after "for"; read it as a proposal in its own right.
  const proposal = quoted.replace(/^[^(A-Za-z]*(?:\(|for\s+|-\s*)?/i, '')
  return describedCommercialWork(proposal) !== null
}

function chunks<T>(items: T[], size = 200): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

/** Recompute priorities for queued lookups, optionally for some councils. Reads and one update per lookup. */
export async function prioritiseFamilyLookups(db: PlanningAdminClient, councils?: string[]): Promise<number> {
  let query = db.from('planning_family_lookups').select('id,authority_slug,parent_key,parent_reference,priority')
    .in('status', ['queued', 'deferred'])
  if (councils?.length) query = query.in('authority_slug', councils)
  const { data: lookups, error } = await query
  if (error) throw error
  let updated = 0
  const byCouncil = new Map<string, Array<{ id: string; parent_key: string; parent_reference: string; priority: number }>>()
  for (const lookup of (lookups ?? []) as Array<{ id: string; authority_slug: string; parent_key: string; parent_reference: string; priority: number }>) {
    byCouncil.set(lookup.authority_slug, [...(byCouncil.get(lookup.authority_slug) ?? []), lookup])
  }
  for (const [council, councilLookups] of byCouncil) {
    const links: Array<{ child_application_id: string; parent_key: string }> = []
    for (const keys of chunks(councilLookups.map(lookup => lookup.parent_key))) {
      const { data, error: linkError } = await db.from('planning_application_links').select('child_application_id,parent_key')
        .eq('authority_slug', council).in('parent_key', keys).eq('strength', 'strong').is('removed_at', null)
      if (linkError) throw linkError
      links.push(...((data ?? []) as typeof links))
    }
    const childIds = [...new Set(links.map(link => link.child_application_id))]
    const children = new Map<string, { intelligence_tier: boolean; date_received: string | null; description: string | null }>()
    const relevance = new Map<string, string>()
    for (const ids of chunks(childIds)) {
      const { data, error: childError } = await db.from('planning_applications').select('id,intelligence_tier,date_received,description').in('id', ids)
      if (childError) throw childError
      for (const row of (data ?? []) as Array<{ id: string; intelligence_tier: boolean; date_received: string | null; description: string | null }>) children.set(row.id, row)
      const { data: developments, error: developmentError } = await db.from('development_applications')
        .select('planning_application_id,developments(relevance)').in('planning_application_id', ids)
      if (developmentError) throw developmentError
      for (const row of (developments ?? []) as unknown as Array<{ planning_application_id: string; developments: { relevance: string | null } | null }>) {
        if (row.developments?.relevance) relevance.set(row.planning_application_id, row.developments.relevance)
      }
    }
    for (const lookup of councilLookups) {
      const members = links.filter(link => link.parent_key === lookup.parent_key).map(link => link.child_application_id)
      const unique = [...new Set(members)]
      const rank = { high: 3, medium: 2, low: 1 } as Record<string, number>
      const best = unique.map(id => relevance.get(id)).filter(Boolean).sort((a, b) => rank[b!] - rank[a!])[0] ?? null
      const signals: LookupSignals = {
        childCount: unique.length,
        bestRelevance: best as LookupSignals['bestRelevance'],
        anyChildInTier: unique.some(id => children.get(id)?.intelligence_tier),
        latestChildReceived: unique.map(id => children.get(id)?.date_received).filter(Boolean).sort().at(-1) ?? null,
        quotesMajorProposal: unique.some(id => quotesMajorProposal(children.get(id)?.description, lookup.parent_reference)),
      }
      const priority = lookupPriority(signals)
      if (priority === lookup.priority) continue
      const { error: updateError } = await db.from('planning_family_lookups').update({ priority, updated_at: new Date().toISOString() }).eq('id', lookup.id)
      if (updateError) throw updateError
      updated++
    }
  }
  return updated
}

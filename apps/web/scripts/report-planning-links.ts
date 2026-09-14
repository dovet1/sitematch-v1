/**
 * Read-only: runs the application linker over stored applications council by council and reports
 * families, merges, missing parents and a labelling sample. No provider or model calls, no writes.
 *
 *   ../../node_modules/.bin/tsx scripts/report-planning-links.ts [--councils=a,b] [--sample=200]
 */
import { loadEnvConfig } from '@next/env'
import { createClient } from '@supabase/supabase-js'
import { mkdirSync, writeFileSync } from 'node:fs'
import { followOnKind, linkCouncilApplications, type ApplicationLink } from '../src/lib/planning-intelligence/linking'

loadEnvConfig(process.cwd())

const args = new Map(process.argv.slice(2).map(arg => arg.replace(/^--/, '').split('=') as [string, string]))
const SAMPLE_SIZE = Number(args.get('sample') ?? 200)
const RECENT_SINCE = '2026-03-14'

type Row = {
  id: string; reference: string; description: string; procedure: string | null; address: string | null
  postcode: string | null; uprn: string | null; intelligence_tier: boolean; date_received: string | null
}

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
  global: { fetch: (url, init) => fetch(url, { ...init, signal: AbortSignal.timeout(30000) }) },
})

async function withRetry<T>(label: string, run: () => PromiseLike<{ data: T | null; error: unknown }>): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    const { data, error } = await run()
    if (!error && data) return data
    if (attempt >= 4) throw new Error(`${label}: ${JSON.stringify(error)}`)
    await new Promise(resolve => setTimeout(resolve, 2000 * attempt))
  }
}

async function councilRows(council: string): Promise<Row[]> {
  const rows: Row[] = []
  for (let from = 0; ; from += 1000) {
    const page = await withRetry(`${council}@${from}`, () => db.from('planning_applications')
      .select('id,reference,description,procedure,address,postcode,uprn,intelligence_tier,date_received')
      .eq('authority_slug', council).order('id').range(from, from + 999))
    rows.push(...(page as Row[]))
    if (page.length < 1000) return rows
  }
}

// Deterministic sampling, so a labelled sample can be regenerated and compared.
let seed = 20260914
const random = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31)
type SampleEntry = Record<string, unknown>
const reservoirs = new Map<string, { seen: number; items: SampleEntry[] }>()
function offer(stratum: string, capacity: number, build: () => SampleEntry) {
  const reservoir = reservoirs.get(stratum) ?? { seen: 0, items: [] }
  reservoirs.set(stratum, reservoir)
  reservoir.seen++
  if (reservoir.items.length < capacity) reservoir.items.push(build())
  else {
    const slot = Math.floor(random() * reservoir.seen)
    if (slot < capacity) reservoir.items[slot] = build()
  }
}

function bump(counter: Record<string, number>, key: string, by = 1) { counter[key] = (counter[key] ?? 0) + by }

async function main() {
  const councils = args.get('councils')?.split(',')
    ?? (await withRetry('councils', () => db.from('planning_authority_coverage').select('authority_slug').order('authority_slug')))
      .map((row: { authority_slug: string }) => row.authority_slug)

  const totals = {
    councils: 0, applications: 0, tierApplications: 0,
    links: {} as Record<string, number>,
    strongResolved: 0, strongUnresolved: 0,
    families: 0, familyApplications: 0, familySizes: {} as Record<string, number>,
    familiesWithStoredRoot: 0, familiesWithMissingParent: 0, familiesWithTierMember: 0,
    developmentsMerged: 0, tierApplicationsInFamilies: 0, nonTierApplicationsJoiningTierFamilies: 0,
    overlookedFamilies: 0, overlookedFamilyApplications: 0, distinctMissingParents: 0,
    // Several missing permissions in one family is usually a phased masterplan: review, not auto-merge.
    familiesWithSeveralMissingParents: 0,
    // Recall: applications worded as follow-ons that the linker could not attach to anything.
    followOnApplications: 0, followOnWithoutStrongLink: 0, followOnWithOnlyWeakLink: 0,
  }
  const perCouncil: Record<string, unknown>[] = []
  const overlookedExamples: Record<string, unknown>[] = []

  for (const council of councils) {
    const rows = await councilRows(council)
    const byId = new Map(rows.map(row => [row.id, row]))
    const { links, families } = linkCouncilApplications(rows)
    totals.councils++
    totals.applications += rows.length
    totals.tierApplications += rows.filter(row => row.intelligence_tier).length

    for (const link of links) {
      bump(totals.links, `${link.source}:${link.kind}:${link.strength}`)
      if (link.strength === 'strong') link.parentId ? totals.strongResolved++ : totals.strongUnresolved++
      const describe = (entry: ApplicationLink) => {
        const child = byId.get(entry.childId)!, parent = entry.parentId ? byId.get(entry.parentId) : null
        return {
          council, source: entry.source, kind: entry.kind, strength: entry.strength, evidence: entry.evidence,
          child: { reference: child.reference, procedure: child.procedure, received: child.date_received, description: child.description.slice(0, 400) },
          parent: parent
            ? { reference: parent.reference, procedure: parent.procedure, received: parent.date_received, description: parent.description.slice(0, 400) }
            : { reference: entry.parentReference, stored: false },
        }
      }
      offer(link.strength === 'strong' ? `strong:${link.source}:${link.kind}` : 'weak', link.strength === 'strong' ? SAMPLE_SIZE : 60, () => describe(link))
    }

    const strongChildren = new Set(links.filter(link => link.strength === 'strong').map(link => link.childId))
    const weakChildren = new Set(links.filter(link => link.strength === 'weak').map(link => link.childId))
    for (const row of rows) {
      if (!followOnKind(row)) continue
      totals.followOnApplications++
      if (strongChildren.has(row.id)) continue
      totals.followOnWithoutStrongLink++
      if (weakChildren.has(row.id)) totals.followOnWithOnlyWeakLink++
      offer('unlinkedFollowOn', 40, () => ({ council, reference: row.reference, procedure: row.procedure, description: row.description.slice(0, 250) }))
    }

    let merged = 0, missingParents = 0, overlooked = 0
    for (const family of families) {
      const members = family.applicationIds.map(id => byId.get(id)!)
      const tier = members.filter(member => member.intelligence_tier).length
      const size = members.length
      totals.families++
      totals.familyApplications += size
      bump(totals.familySizes, size >= 10 ? '10+' : size >= 5 ? '5-9' : size >= 3 ? '3-4' : String(size))
      if (family.rootId) totals.familiesWithStoredRoot++
      if (family.missingParentReferences.length) { totals.familiesWithMissingParent++; missingParents += family.missingParentReferences.length }
      if (family.missingParentReferences.length > 1) totals.familiesWithSeveralMissingParents++
      if (tier > 0) {
        totals.familiesWithTierMember++
        totals.tierApplicationsInFamilies += tier
        totals.nonTierApplicationsJoiningTierFamilies += size - tier
        merged += tier - 1
      }
      const recent = members.some(member => (member.date_received ?? '') >= RECENT_SINCE)
      if (!family.rootId && tier === 0 && size >= 3 && recent) {
        overlooked++
        totals.overlookedFamilyApplications += size
        offer('overlooked', 40, () => ({
          council, missingParents: family.missingParentReferences, size,
          members: members.slice(0, 12).map(member => `${member.reference} [${member.procedure}] ${member.date_received} | ${member.description.slice(0, 120)}`),
        }))
      }
    }
    totals.developmentsMerged += merged
    totals.distinctMissingParents += missingParents
    totals.overlookedFamilies += overlooked
    perCouncil.push({ council, applications: rows.length, links: links.length, strong: links.filter(link => link.strength === 'strong').length, families: families.length, merged, missingParents, overlooked })
    console.log(`${council}: ${rows.length} applications, ${families.length} families, ${merged} merges, ${overlooked} overlooked`)
  }

  const strata = [...reservoirs].filter(([key]) => key.startsWith('strong:'))
  const strongTotal = strata.reduce((sum, [, reservoir]) => sum + reservoir.seen, 0)
  // Proportional to each kind's share of strong links, with at least ten of every kind so rare
  // kinds (companions, reserved matters, case-number links) are actually checked.
  const labellingSample = strata.flatMap(([stratum, reservoir]) => {
    const quota = Math.max(10, Math.round(SAMPLE_SIZE * reservoir.seen / strongTotal))
    return reservoir.items.slice(0, quota).map(item => ({ stratum, stratumSize: reservoir.seen, label: null, note: '', ...item }))
  })

  mkdirSync('reports', { recursive: true })
  const stamp = new Date().toISOString().slice(0, 10)
  const summaryPath = `reports/planning-links-${stamp}${args.has('councils') ? '-subset' : ''}.json`
  const samplePath = `reports/planning-links-sample-${stamp}${args.has('councils') ? '-subset' : ''}.json`
  writeFileSync(summaryPath, JSON.stringify({ at: new Date().toISOString(), recentSince: RECENT_SINCE, totals, perCouncil,
    overlookedExamples: reservoirs.get('overlooked')?.items ?? overlookedExamples }, null, 2))
  writeFileSync(samplePath, JSON.stringify({ labellingSample, weakSample: reservoirs.get('weak')?.items ?? [],
    unlinkedFollowOnSample: reservoirs.get('unlinkedFollowOn')?.items ?? [] }, null, 2))
  console.log(JSON.stringify({ totals, summaryPath, samplePath, labellingSampleSize: labellingSample.length }, null, 2))
}

main().catch(error => { console.error(error); process.exitCode = 1 })

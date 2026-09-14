/** Pilot completion plan: list research candidates whose family we already hold.
 *
 * A candidate is a commercial development at a pilot council whose principal application is an
 * original proposal (not a follow-on), with no unresolved strong link to a missing parent, and not
 * yet researched. With --probe it also runs the council document collector on each candidate (no
 * model or Plota requests; it reads public council pages) so the pilot can include both readable
 * and blocked portals.
 *
 * Read-only. Run from apps/web:
 *   ../../node_modules/.bin/tsx scripts/pilot-research-candidates.ts [--councils=crawley,wandsworth] [--limit=15] [--probe]
 */
import { writeFileSync } from 'fs'
import { loadEnvConfig } from '@next/env'
import { createClient } from '@supabase/supabase-js'
import { followOnKind } from '../src/lib/planning-intelligence/linking'
import { collectCouncilResearchSources } from '../src/lib/planning-intelligence/research-sources'
import type { PlotaApplication } from '../src/lib/planning-intelligence/types'

loadEnvConfig(process.cwd())

const args = new Map(process.argv.slice(2).map(arg => arg.replace(/^--/, '').split('=') as [string, string]))
const councils = (args.get('councils') ?? 'crawley,wandsworth,south-norfolk-broadland,glasgow').split(',')
const perCouncil = Number(args.get('limit') ?? 15)
const probe = args.has('probe')

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })

async function main() {
  const out: Record<string, unknown>[] = []
  for (const council of councils) {
    const { data: apps, error } = await db.from('planning_applications')
      .select('id,reference,description,procedure,stage,date_received,raw,development_applications(development_id,role,developments(id,relevance,creates_commercial_space,research_state,review_state))')
      .eq('authority_slug', council)
      .eq('intelligence_tier', true)
      .gte('date_received', '2025-09-01')
      .order('date_received', { ascending: false })
      .limit(1000)
    if (error) throw error

    const unresolvedChildren = new Set<string>()
    const ids = (apps ?? []).map(app => app.id)
    for (let i = 0; i < ids.length; i += 150) {
      const { data: childLinks, error: linkError } = await db.from('planning_application_links')
        .select('child_application_id,parent_application_id,strength')
        .in('child_application_id', ids.slice(i, i + 150))
        .is('removed_at', null)
      if (linkError) throw linkError
      for (const link of childLinks ?? []) {
        if (link.strength === 'strong' && !link.parent_application_id) unresolvedChildren.add(link.child_application_id)
      }
    }

    let kept = 0
    for (const app of apps ?? []) {
      if (kept >= perCouncil) break
      // One application belongs to one development, so PostgREST returns the membership as an object.
      type Membership = { developments: { id: string; relevance: string | null; creates_commercial_space: string | null; research_state: string; review_state: string } | null }
      const embedded = app.development_applications as unknown as Membership | Membership[] | null
      const development = (Array.isArray(embedded) ? embedded[0] : embedded)?.developments
      if (!development || development.creates_commercial_space !== 'yes') continue
      if (development.relevance !== 'high' && development.relevance !== 'medium') continue
      if (development.research_state === 'complete' || development.review_state === 'rejected') continue
      if (followOnKind(app) || unresolvedChildren.has(app.id)) continue
      const raw = app.raw as PlotaApplication
      const row: Record<string, unknown> = {
        council, developmentId: development.id, reference: app.reference, received: app.date_received,
        relevance: development.relevance, description: (app.description ?? '').slice(0, 220),
        councilUrl: raw.links?.council ?? null,
      }
      if (probe) {
        const collected = await collectCouncilResearchSources(raw)
        row.councilPage = collected.sources.some(s => s.kind === 'council_page')
        row.documents = collected.sources.filter(s => s.kind === 'document').length
        row.warnings = collected.warnings.slice(0, 3)
      }
      out.push(row)
      kept++
      console.log(JSON.stringify(row))
    }
  }
  const file = `reports/pilot-research-candidates-${new Date().toISOString().slice(0, 10)}.json`
  writeFileSync(file, JSON.stringify(out, null, 2))
  console.log(`wrote ${file}`)
}

main().catch(error => { console.error(error); process.exit(1) })

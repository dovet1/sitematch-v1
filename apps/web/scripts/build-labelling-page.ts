/**
 * Build the standalone human-labelling page from the live intelligence-tier sample.
 *
 * The page is one self-contained HTML file that opens from the filesystem with no account
 * and no server, because the people labelling are not all inside the organisation. It posts
 * each judgement to `planning_label_submissions` with the public anon key, exactly as the
 * lead-capture form does; a CORS preflight carrying `Origin: null` returns `*`, which is why
 * `file://` works.
 *
 * Run from apps/web:
 *   npx tsx scripts/build-labelling-page.ts <out.html>
 *   npx tsx scripts/build-labelling-page.ts <out.html> --offline   # no database posting
 */
import { loadEnvConfig } from '@next/env'
import { createClient } from '@supabase/supabase-js'
import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

loadEnvConfig(process.cwd())

const TEMPLATE = join(process.cwd(), 'scripts', 'labelling', 'page.template.html')

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
})

/**
 * The payload lands inside a `<script>` element, so a description containing `</script>`
 * would close it and put the rest of the sample into the document as markup. JSON.stringify
 * does not escape `<`, so it is escaped here. The same goes for the line separators, which
 * are valid JSON but not valid JavaScript string literals in older parsers.
 */
function embed(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029')
}

async function main() {
  const out = process.argv[2] ?? 'planning-labelling.html'
  const offline = process.argv.includes('--offline')

  const { data: apps, error } = await db
    .from('planning_applications')
    .select('id,provider_id,reference,authority_name,address,postcode,description,category,procedure,planning_route,commercial_work,commercial_use_class,stated_dwelling_count,stated_floorspace_sqm,stage,date_received,eligibility_limbs,links')
    .eq('intelligence_tier', true)
    .order('date_received', { ascending: false })
  if (error) throw error

  const { data: runs, error: runError } = await db
    .from('planning_classification_runs')
    .select('planning_application_id,output,prompt_version,status,finished_at')
    .eq('status', 'complete')
    .order('finished_at', { ascending: true })
  if (runError) throw runError

  // Latest completed run wins, so the page reveals the current prompt's verdict.
  const latest = new Map<string, { output: unknown; promptVersion: string }>()
  for (const r of runs ?? []) {
    latest.set(r.planning_application_id as string, {
      output: r.output,
      promptVersion: r.prompt_version as string,
    })
  }

  const records = (apps ?? []).map((a) => {
    const run = latest.get(a.id as string)
    const o = (run?.output ?? null) as null | Record<string, unknown>
    return {
      id: a.provider_id,
      reference: a.reference,
      authority: a.authority_name,
      address: a.address,
      postcode: a.postcode,
      description: a.description,
      categoryLabel: (a.category as { label?: string } | null)?.label ?? null,
      procedure: a.procedure,
      planningRoute: a.planning_route,
      commercialWork: a.commercial_work,
      useClass: a.commercial_use_class,
      dwellings: a.stated_dwelling_count,
      floorspace: a.stated_floorspace_sqm,
      stage: a.stage,
      dateReceived: a.date_received,
      limbs: a.eligibility_limbs,
      councilUrl: (a.links as { council?: string } | null)?.council ?? null,
      // Only `relevance` is comparable now: opportunityType is retired in v3, and the two
      // questions replacing it have no v4 counterpart to reveal.
      model: o
        ? {
            promptVersion: run!.promptVersion,
            relevance: o.relevance ?? null,
            confidence: o.confidence ?? null,
            summary: o.substantiveProposal ?? null,
          }
        : null,
    }
  })

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!offline && (!url || !key)) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are needed, or pass --offline')
  }
  const remote = offline ? 'null' : embed({ url, key })

  let html = readFileSync(TEMPLATE, 'utf8')
  html = html.replace(/\/\*__RECORDS__\*\/[\s\S]*?\/\*__RECORDS__\*\//, embed(records))
  html = html.replace(/\/\*__REMOTE__\*\/[\s\S]*?\/\*__REMOTE__\*\//, remote)
  if (html.includes('__RECORDS__') || html.includes('__REMOTE__')) {
    throw new Error('Template placeholders were not both replaced')
  }
  writeFileSync(out, html)

  const withModel = records.filter((r) => r.model !== null).length
  console.log(`wrote ${out}`)
  console.log(`  ${records.length} records, ${withModel} carrying a model relevance verdict`)
  console.log(`  posts to the shared table: ${offline ? 'no (--offline)' : 'yes'}`)
  const spread: Record<string, number> = {}
  for (const r of records) if (r.model) spread[String(r.model.relevance)] = (spread[String(r.model.relevance)] ?? 0) + 1
  console.log(`  model relevance spread: ${JSON.stringify(spread)}`)
}
main()

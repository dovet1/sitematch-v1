/**
 * Export the intelligence-tier census with each record's current model verdict, as the
 * input to a human labelling pass. Ground truth is assigned by a person against these
 * records; nothing here invents a label.
 *
 * Run from apps/web:  npx tsx scripts/export-labelling-sample.ts <out.json>
 */
import { loadEnvConfig } from '@next/env'
import { createClient } from '@supabase/supabase-js'
import { writeFileSync } from 'fs'

loadEnvConfig(process.cwd())
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function main() {
  const out = process.argv[2] ?? 'labelling-sample.json'
  const { data: apps, error } = await db
    .from('planning_applications')
    .select('id,provider_id,reference,authority_name,address,postcode,description,category,procedure,planning_route,commercial_work,commercial_use_class,stated_dwelling_count,stated_floorspace_sqm,stage,date_received,eligibility_limbs,links')
    .eq('intelligence_tier', true)
    .order('date_received', { ascending: false })
  if (error) throw error

  const { data: runs } = await db
    .from('planning_classification_runs')
    .select('planning_application_id,output,prompt_version,status,finished_at')
    .eq('status', 'complete')
    .order('finished_at', { ascending: true })

  // Latest completed run wins, so the sample reflects the current prompt.
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
      model: o
        ? {
            promptVersion: run!.promptVersion,
            relevance: o.relevance ?? null,
            confidence: o.confidence ?? null,
            // v4 output carries opportunityType, v5 does not; both are dumped as they stand
            // so a raw sample can still be read against whichever prompt produced it.
            opportunityType: o.opportunityType ?? null,
            createsCommercialSpace: (o.commercialSpace as { creates?: unknown } | undefined)?.creates ?? null,
            dwellingCount: (o.dwellings as { count?: unknown } | undefined)?.count ?? null,
            summary: o.substantiveProposal ?? null,
          }
        : null,
    }
  })

  const withModel = records.filter((r) => r.model !== null).length
  writeFileSync(out, JSON.stringify(records, null, 2))
  console.log(`wrote ${records.length} records to ${out} (${withModel} carry a model verdict)`)
  const spread: Record<string, number> = {}
  for (const r of records) if (r.model) spread[String(r.model.relevance)] = (spread[String(r.model.relevance)] ?? 0) + 1
  console.log('model relevance spread:', JSON.stringify(spread))
}
main()

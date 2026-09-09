/**
 * Measure the operator-research prompt on real public planning evidence without touching
 * queue state or the budget ledger. The caller uses the reported provider cost to size the
 * worker's atomic reservation before enabling it.
 */
import { loadEnvConfig } from '@next/env'
import { createClient } from '@supabase/supabase-js'
import { researchOperatorWithOpenRouter } from '../src/lib/planning-intelligence/research-openrouter'
import { collectCouncilResearchSources } from '../src/lib/planning-intelligence/research-sources'
import type { PlotaApplication } from '../src/lib/planning-intelligence/types'

loadEnvConfig(process.cwd())

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!url || !serviceKey) throw new Error('Supabase service credentials are not configured')
  if (!apiKey) throw new Error('OPENROUTER_API_KEY is not configured')
  const db = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })

  const requestedReference = process.argv[2]

  // No v5 classifications exist yet, so escalate_for_research is currently empty. High v4
  // developments are the closest real population for measuring this brand-research pass;
  // this script does not change their classification or research state.
  const { data: developments, error: developmentsError } = await db.from('developments')
    .select('id').eq('relevance', 'high')
  if (developmentsError) throw developmentsError
  const developmentIds = (developments ?? []).map((row) => row.id)
  if (developmentIds.length === 0) throw new Error('No high-relevance developments are available')

  const { data: links, error: linksError } = await db.from('development_applications')
    .select('development_id,planning_application_id').in('development_id', developmentIds)
  if (linksError) throw linksError
  const applicationIds = (links ?? []).map((row) => row.planning_application_id)
  let applicationQuery = db.from('planning_applications')
    .select('id,raw,documents_count').in('id', applicationIds)
  if (requestedReference) applicationQuery = applicationQuery.eq('reference', requestedReference)
  const { data: applications, error: applicationsError } = await applicationQuery
    .order('documents_count', { ascending: false, nullsFirst: false }).limit(1)
  if (applicationsError) throw applicationsError
  const stored = applications?.[0]
  if (!stored) throw new Error('No linked high-relevance application is available')

  const application = stored.raw as PlotaApplication
  const collected = await collectCouncilResearchSources(application)
  console.info(JSON.stringify({
    reference: application.reference,
    collectedSources: collected.sources.map((source) => ({
      kind: source.kind, url: source.url, textCharacters: source.text.length,
      needsOcr: Boolean(source.ocrFile),
    })),
    sourceWarnings: collected.warnings,
  }, null, 2))
  if (process.argv.includes('--sources-only')) return
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(new Error('Research measurement timed out')), 240_000)
  try {
    const researched = await researchOperatorWithOpenRouter({
      application, sources: collected.sources, apiKey,
      model: process.env.OPENROUTER_PLANNING_RESEARCH_MODEL,
      signal: controller.signal,
    })
    console.info(JSON.stringify({
      reference: application.reference,
      sourceCount: collected.sources.length,
      sourceWarnings: collected.warnings,
      operators: researched.signals.map((signal) => ({
        name: signal.name, role: signal.role, source: signal.evidenceSource,
      })),
      commercialFloorspace: researched.commercialFloorspace,
      useClasses: researched.useClasses,
      noOperatorReason: researched.noOperatorReason,
      researchMemo: researched.researchMemo,
      webCitations: researched.webCitations,
      webSearchRequests: researched.webSearchRequests,
      model: researched.model,
      inputTokens: researched.inputTokens,
      outputTokens: researched.outputTokens,
      costUsd: researched.costUsd,
    }, null, 2))
  } finally {
    clearTimeout(timeout)
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Research measurement failed')
  process.exit(1)
})

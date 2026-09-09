/**
 * Exercise the complete research worker on one real, pre-v5 high-relevance application.
 *
 * The current calibration set has no genuine escalate_for_research rows. This script stages
 * one named v4 proxy, invokes exactly one queue item, and always restores the development's
 * prior escalation/research state. The run and planning_ai_usage ledger are preserved; any
 * pending research signal is removed so the proxy cannot leak into product data.
 */
import { loadEnvConfig } from '@next/env'
import { createClient } from '@supabase/supabase-js'
import { researchPlanningBatch } from '../src/lib/planning-intelligence/research'

loadEnvConfig(process.cwd())

const reference = process.argv[2] ?? '07/26/0675/F'

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!url || !serviceKey || !apiKey) throw new Error('Required service credentials are not configured')
  const db = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })

  const { data: application, error: applicationError } = await db.from('planning_applications')
    .select('id,reference').eq('reference', reference).single()
  if (applicationError) throw applicationError
  const { data: relationship, error: relationshipError } = await db.from('development_applications')
    .select('development_id').eq('planning_application_id', application.id).single()
  if (relationshipError) throw relationshipError
  const { data: development, error: developmentError } = await db.from('developments')
    .select('id,relevance,escalate_for_research,research_state,research_started_at,last_enriched_at,existing_commercial_use_classes,proposed_commercial_use_classes')
    .eq('id', relationship.development_id).single()
  if (developmentError) throw developmentError
  if (development.relevance !== 'high') throw new Error('The test proxy is no longer high relevance')

  const { count: otherQueued, error: queueError } = await db.from('developments')
    .select('*', { count: 'exact', head: true })
    .eq('escalate_for_research', true)
    .neq('id', development.id)
  if (queueError) throw queueError
  if ((otherQueued ?? 0) > 0) throw new Error('Other escalated rows exist; refusing to stage an ambiguous test queue')

  let workerResult: Awaited<ReturnType<typeof researchPlanningBatch>> | null = null
  try {
    const { error: stageError } = await db.from('developments').update({
      escalate_for_research: true,
      research_state: 'queued',
      research_started_at: null,
    }).eq('id', development.id)
    if (stageError) throw stageError

    workerResult = await researchPlanningBatch({ db: db as never, apiKey, limit: 1 })
    const { data: run, error: runError } = await db.from('planning_classification_runs')
      .select('id,status,output,cost_usd,input_tokens,output_tokens')
      .eq('planning_application_id', application.id)
      .eq('stage', 'web')
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (runError) throw runError
    const { data: usage, error: usageError } = run
      ? await db.from('planning_ai_usage')
        .select('status,reserved_usd,actual_usd')
        .eq('classification_run_id', run.id)
        .order('occurred_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      : { data: null, error: null }
    if (usageError) throw usageError

    const output = run?.output as {
      signals?: Array<{ name: string; role: string; evidenceSource: string }>
      commercialFloorspace?: Array<{
        scope: string; sqm: number; measurementBasis: string; evidenceUrl: string; evidencePage: string | null
      }>
      useClasses?: Array<{ phase: string; useClass: string; evidenceUrl: string; evidencePage: string | null }>
      noOperatorReason?: string
      researchMemo?: string
      webCitations?: Array<{ url: string; title: string | null; excerpt: string | null }>
      webSearchRequests?: number
      sourceUrls?: string[]
      sourceWarnings?: string[]
    } | null
    console.info(JSON.stringify({
      reference,
      workerResult,
      run: run ? {
        status: run.status,
        costUsd: run.cost_usd,
        inputTokens: run.input_tokens,
        outputTokens: run.output_tokens,
        signals: output?.signals ?? [],
        commercialFloorspace: output?.commercialFloorspace ?? [],
        useClasses: output?.useClasses ?? [],
        noOperatorReason: output?.noOperatorReason ?? null,
        researchMemo: output?.researchMemo ?? null,
        webCitations: output?.webCitations ?? [],
        webSearchRequests: output?.webSearchRequests ?? 0,
        sourceCount: output?.sourceUrls?.length ?? 0,
        sourceWarnings: output?.sourceWarnings ?? [],
      } : null,
      usage,
    }, null, 2))
  } finally {
    // The run and ledger are the audit trail. Pending projections from this artificial queue
    // are not product data and must not survive the test.
    const { error: signalCleanupError } = await db.from('development_brand_signals')
      .delete()
      .eq('planning_application_id', application.id)
      .eq('review_state', 'pending')
      .in('evidence_source', ['council_page', 'document', 'web'])
    const { error: observationCleanupError } = await db.from('development_observations')
      .delete()
      .eq('planning_application_id', application.id)
      .eq('metric', 'commercial_floorspace')
      .eq('review_state', 'pending')
      .not('evidence_url', 'is', null)
    const { error: restoreError } = await db.from('developments').update({
      escalate_for_research: development.escalate_for_research,
      research_state: development.research_state,
      research_started_at: development.research_started_at,
      last_enriched_at: development.last_enriched_at,
      existing_commercial_use_classes: development.existing_commercial_use_classes,
      proposed_commercial_use_classes: development.proposed_commercial_use_classes,
    }).eq('id', development.id)
    if (signalCleanupError) throw signalCleanupError
    if (observationCleanupError) throw observationCleanupError
    if (restoreError) throw restoreError
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'One-record planning research test failed')
  process.exit(1)
})

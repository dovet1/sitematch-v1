import {
  DEFAULT_MONTHLY_LLM_BUDGET_USD,
  DEFAULT_RESEARCH_RESERVATION_USD,
  DEFAULT_RESEARCH_STAGE_BUDGET_USD,
  configuredBudget,
} from './budget'
import type { PlanningAdminClient } from './db'
import {
  DEFAULT_OPENROUTER_RESEARCH_MODEL,
  PLANNING_RESEARCH_PROMPT_VERSION,
  PLANNING_RESEARCH_SCHEMA_VERSION,
  RESEARCH_REQUEST_TIMEOUT_MS,
  researchOperatorWithOpenRouter,
} from './research-openrouter'
import { collectCouncilResearchSources } from './research-sources'
import type { PlotaApplication } from './types'

interface ResearchQueueRow {
  development_id: string
  planning_application_id: string
  input_hash: string
  raw: PlotaApplication
}

export interface ResearchBatchResult {
  considered: number
  researched: number
  failed: number
  deferredBudget: number
  operatorsFound: number
  commercialFactsFound: number
}

export const RESEARCH_LEASE_MS = RESEARCH_REQUEST_TIMEOUT_MS + 120_000

function deadline(): { signal: AbortSignal; cleanup: () => void } {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(new Error('Planning research timed out')), RESEARCH_REQUEST_TIMEOUT_MS)
  return { signal: controller.signal, cleanup: () => clearTimeout(timeout) }
}

async function replacePendingResearchSignals(
  db: PlanningAdminClient,
  row: ResearchQueueRow,
  signals: Awaited<ReturnType<typeof researchOperatorWithOpenRouter>>['signals']
) {
  const { error: deleteError } = await db.from('development_brand_signals')
    .delete()
    .eq('planning_application_id', row.planning_application_id)
    .eq('review_state', 'pending')
    .in('evidence_source', ['council_page', 'document', 'web'])
  if (deleteError) throw deleteError
  if (signals.length === 0) return

  const { error } = await db.from('development_brand_signals').insert(signals.map((signal) => ({
    development_id: row.development_id,
    planning_application_id: row.planning_application_id,
    brand_id: null,
    observed_name: signal.name,
    role: signal.role,
    evidence_source: signal.evidenceSource,
    evidence_excerpt: signal.evidenceExcerpt,
    evidence_url: signal.evidenceUrl,
    confidence: signal.confidence,
    review_state: 'pending',
    planning_outcome: row.raw.stage ?? null,
  })))
  if (error) throw error
}

async function replacePendingResearchFloorspace(
  db: PlanningAdminClient,
  row: ResearchQueueRow,
  findings: Awaited<ReturnType<typeof researchOperatorWithOpenRouter>>['commercialFloorspace']
) {
  // Initial-classifier rows have no evidence URL. Research owns only URL-grounded pending
  // rows, so rerunning it cannot delete a human decision or the cheaper model's evidence.
  const { error: deleteError } = await db.from('development_observations')
    .delete()
    .eq('planning_application_id', row.planning_application_id)
    .eq('metric', 'commercial_floorspace')
    .eq('review_state', 'pending')
    .not('evidence_url', 'is', null)
  if (deleteError) throw deleteError
  if (findings.length === 0) return

  const actionByScope = {
    existing: 'retain', lost: 'remove', proposed: 'create', net: 'change',
  } as const
  const { error } = await db.from('development_observations').insert(findings.map((finding) => ({
    development_id: row.development_id,
    planning_application_id: row.planning_application_id,
    metric: 'commercial_floorspace',
    scope: finding.scope,
    action: actionByScope[finding.scope],
    value: finding.sqm,
    unit: 'sqm',
    measurement_basis: finding.measurementBasis,
    evidence_excerpt: finding.evidenceExcerpt,
    evidence_url: finding.evidenceUrl,
    evidence_page: finding.evidencePage,
    confidence: finding.confidence,
    review_state: 'pending',
  })))
  if (error) throw error
}

export async function researchPlanningBatch(input: {
  db: PlanningAdminClient
  apiKey: string
  model?: string
  limit?: number
}): Promise<ResearchBatchResult> {
  const model = input.model ?? process.env.OPENROUTER_PLANNING_RESEARCH_MODEL
    ?? DEFAULT_OPENROUTER_RESEARCH_MODEL
  const monthlyBudget = configuredBudget(
    'PLANNING_LLM_MONTHLY_BUDGET_USD', DEFAULT_MONTHLY_LLM_BUDGET_USD
  )
  const stageBudget = configuredBudget(
    'PLANNING_LLM_RESEARCH_BUDGET_USD', DEFAULT_RESEARCH_STAGE_BUDGET_USD
  )
  const reservation = configuredBudget(
    'PLANNING_LLM_RESEARCH_RESERVATION_USD', DEFAULT_RESEARCH_RESERVATION_USD
  )
  if (
    model !== DEFAULT_OPENROUTER_RESEARCH_MODEL
    && process.env.PLANNING_LLM_RESEARCH_RESERVATION_USD === undefined
  ) {
    throw new Error(
      'A custom research model requires PLANNING_LLM_RESEARCH_RESERVATION_USD so the hard budget remains valid'
    )
  }
  const limit = Math.max(1, Math.min(input.limit ?? 3, 10))
  const result: ResearchBatchResult = {
    considered: 0, researched: 0, failed: 0, deferredBudget: 0,
    operatorsFound: 0, commercialFactsFound: 0,
  }

  for (let index = 0; index < limit; index++) {
    const { data, error } = await input.db.rpc('claim_next_planning_research', {
      p_stale_before: new Date(Date.now() - RESEARCH_LEASE_MS).toISOString(),
    })
    if (error) throw error
    if (!data) break
    const row = data as ResearchQueueRow
    result.considered++

    const { data: run, error: runError } = await input.db.from('planning_classification_runs')
      .upsert({
        planning_application_id: row.planning_application_id,
        development_id: row.development_id,
        stage: 'web', provider: 'openrouter', model,
        prompt_version: PLANNING_RESEARCH_PROMPT_VERSION,
        schema_version: PLANNING_RESEARCH_SCHEMA_VERSION,
        input_hash: row.input_hash,
        status: 'running', output: null, error: null,
        input_tokens: null, output_tokens: null, cost_usd: null,
        started_at: new Date().toISOString(), finished_at: null,
      }, {
        onConflict: 'planning_application_id,stage,provider,model,prompt_version,schema_version,input_hash',
      }).select('id').single()
    if (runError) throw runError

    const { data: usageId, error: reserveError } = await input.db.rpc('reserve_planning_ai_usage', {
      p_planning_application_id: row.planning_application_id,
      p_classification_run_id: run.id,
      p_stage: 'web', p_provider: 'openrouter', p_model: model,
      p_reserved_usd: reservation,
      p_monthly_budget_usd: monthlyBudget,
      p_stage_budget_usd: stageBudget,
    })
    if (reserveError) throw reserveError
    if (!usageId) {
      result.deferredBudget++
      await Promise.all([
        input.db.from('developments').update({
          research_state: 'deferred_budget', research_started_at: null,
        }).eq('id', row.development_id),
        input.db.from('planning_classification_runs').update({
          status: 'deferred_budget', finished_at: new Date().toISOString(),
        }).eq('id', run.id),
      ])
      break
    }

    const requestDeadline = deadline()
    try {
      const collected = await collectCouncilResearchSources(row.raw)
      const researched = await researchOperatorWithOpenRouter({
        application: row.raw,
        sources: collected.sources,
        apiKey: input.apiKey,
        model,
        signal: requestDeadline.signal,
      })
      await replacePendingResearchSignals(input.db, row, researched.signals)
      await replacePendingResearchFloorspace(input.db, row, researched.commercialFloorspace)
      const actualCost = researched.costUsd ?? reservation
      const now = new Date().toISOString()
      const existingUseClasses = [...new Set(researched.useClasses
        .filter((finding) => finding.phase === 'existing').map((finding) => finding.useClass))]
      const proposedUseClasses = [...new Set(researched.useClasses
        .filter((finding) => finding.phase === 'proposed').map((finding) => finding.useClass))]
      const [{ error: developmentError }, { error: finishRunError }, { error: finishUsageError }] =
        await Promise.all([
          input.db.from('developments').update({
            research_state: 'complete', research_started_at: null,
            existing_commercial_use_classes: existingUseClasses,
            proposed_commercial_use_classes: proposedUseClasses,
            last_enriched_at: now, updated_at: now,
          }).eq('id', row.development_id),
          input.db.from('planning_classification_runs').update({
            status: 'complete', model: researched.model,
            output: {
              signals: researched.signals,
              commercialFloorspace: researched.commercialFloorspace,
              useClasses: researched.useClasses,
              noOperatorReason: researched.noOperatorReason,
              researchMemo: researched.researchMemo,
              webCitations: researched.webCitations,
              webSearchRequests: researched.webSearchRequests,
              sourceUrls: collected.sources.map((source) => source.url),
              sourceWarnings: collected.warnings,
            },
            input_tokens: researched.inputTokens, output_tokens: researched.outputTokens,
            cost_usd: actualCost, finished_at: now,
          }).eq('id', run.id),
          input.db.from('planning_ai_usage').update({
            status: 'complete', model: researched.model, actual_usd: actualCost,
            input_tokens: researched.inputTokens, output_tokens: researched.outputTokens,
          }).eq('id', usageId),
        ])
      if (developmentError) throw developmentError
      if (finishRunError) throw finishRunError
      if (finishUsageError) throw finishUsageError
      result.researched++
      result.operatorsFound += researched.signals.length
      result.commercialFactsFound += researched.commercialFloorspace.length + researched.useClasses.length
    } catch (researchError) {
      const message = researchError instanceof Error ? researchError.message : 'Unknown research failure'
      const now = new Date().toISOString()
      await Promise.all([
        input.db.from('developments').update({
          research_state: 'failed', research_started_at: null,
        }).eq('id', row.development_id),
        input.db.from('planning_classification_runs').update({
          status: 'failed', error: message, cost_usd: reservation, finished_at: now,
        }).eq('id', run.id),
        // Once the provider call begins, charge the reservation: a timeout can arrive after
        // OpenRouter has already completed and billed its web searches or generation.
        input.db.from('planning_ai_usage').update({
          status: 'complete', actual_usd: reservation,
        }).eq('id', usageId),
      ])
      result.failed++
    } finally {
      requestDeadline.cleanup()
    }
  }
  return result
}

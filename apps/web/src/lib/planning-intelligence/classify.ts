import {
  DEFAULT_CLASSIFICATION_RESERVATION_USD,
  DEFAULT_INITIAL_STAGE_BUDGET_USD,
  DEFAULT_MONTHLY_LLM_BUDGET_USD,
  configuredBudget,
} from './budget'
import type { PlanningAdminClient } from './db'
import {
  classifyWithOpenRouter,
  CLASSIFICATION_ATTEMPT_TIMEOUT_MS,
  DEFAULT_OPENROUTER_MODEL,
  MAX_CLASSIFICATION_ATTEMPTS,
  PLANNING_PROMPT_VERSION,
  PLANNING_SCHEMA_VERSION,
} from './openrouter'
import type { PlanningClassification, PlotaApplication } from './types'

interface QueueRow {
  id: string
  provider_id: string
  input_hash: string
  raw: PlotaApplication
  reclaimed: boolean
}

// Long enough for all three schema-compliance attempts to reach their individual transport
// deadlines, plus a full minute for database writes and scheduling delay.
export const CLASSIFICATION_ITEM_TIMEOUT_MS =
  CLASSIFICATION_ATTEMPT_TIMEOUT_MS * MAX_CLASSIFICATION_ATTEMPTS + 60_000
// The lease is deliberately longer than the complete worst-case queue item. A fresh lease
// must never be reclaimed merely because a provider call is slow.
export const CLASSIFICATION_LEASE_MS = CLASSIFICATION_ITEM_TIMEOUT_MS + 60_000

function classificationItemDeadline(): { signal: AbortSignal; cleanup: () => void } {
  const controller = new AbortController()
  const timeout = setTimeout(() => {
    controller.abort(new Error('OpenRouter classification item timed out'))
  }, CLASSIFICATION_ITEM_TIMEOUT_MS)
  return { signal: controller.signal, cleanup: () => clearTimeout(timeout) }
}

export interface ClassificationBatchResult {
  considered: number
  classified: number
  failed: number
  deferredBudget: number
}

async function linkedDevelopment(db: PlanningAdminClient, applicationId: string): Promise<string> {
  const { data, error } = await db
    .from('development_applications')
    .select('development_id')
    .eq('planning_application_id', applicationId)
    .single()
  if (error) throw error
  return data.development_id as string
}

/**
 * `developments.summary` is read by a human, so it must be a sentence.
 *
 * The model twice returned the bare literal "mixed_use" for substantiveProposal, which
 * meant a 113-dwelling regeneration scheme carried "mixed_use" as its entire summary. A
 * single snake_case token is never prose, so it is rejected in favour of the application's
 * own description: less polished, but true and readable. The prompt asks for prose too;
 * this is the guard for when the model ignores it.
 *
 * The retired opportunityType vocabulary is gone, but the guard is not keyed to it: any
 * lone slug-shaped token fails, which still catches the current enums ("yes", "unclear")
 * and whatever a later schema introduces.
 */
export function developmentSummary(
  substantiveProposal: string | null | undefined,
  description: string | null | undefined
): string | null {
  const proposal = (substantiveProposal ?? '').trim()
  const looksLikeEnum = /^[a-z0-9]+(?:_[a-z0-9]+)*$/.test(proposal)
  if (proposal.length > 0 && !looksLikeEnum) return proposal
  const fallback = (description ?? '').trim()
  return fallback.length > 0 ? fallback.slice(0, 400) : null
}

/**
 * Whether this record earns the expensive second pass: document retrieval and web search to
 * work out which operator is behind it.
 *
 * Derived here rather than asked of the model. The v4 schema asked directly, with
 * `needsWebResearch`, and got 6 true answers out of 183 -- one of them on a low-relevance
 * record. A rule in code is cheap, auditable, and tunable against a measured budget, which
 * a model field pretending to be a budget decision is not.
 */
export function shouldEscalate(classification: PlanningClassification): boolean {
  return classification.relevance === 'high' && classification.commercialSpace.creates === 'yes'
}

/**
 * An observation is only worth storing when the source actually states a figure.
 *
 * Because the model must return a number for every observation it emits, an unquantified
 * figure previously arrived as 0 -- one live record asserted `commercial_floorspace = 0`
 * at 0.85 confidence beside evidence reading "new health centre (Class E), pharmacy
 * (Class E), and two commercial units". Once stored, that is indistinguishable from a real
 * measured zero and would be summed as one.
 *
 * So a null value, or an `unknown` action, never becomes a row. The gap is not discarded
 * either: it is raised as an unanswered question, which is what a reviewer needs to see.
 */
export function partitionObservations(classification: PlanningClassification) {
  const storable: PlanningClassification['observations'] = []
  const gaps: string[] = []
  for (const observation of classification.observations) {
    if (observation.value === null || observation.action === 'unknown') {
      gaps.push(
        `${observation.metric} (${observation.scope}) is referred to but not quantified in the application text.`
      )
      continue
    }
    storable.push(observation)
  }
  return { storable, gaps: [...new Set(gaps)] }
}

async function persistClassification(
  db: PlanningAdminClient,
  application: QueueRow,
  developmentId: string,
  classification: PlanningClassification,
  runId: string
) {
  const now = new Date().toISOString()
  const { storable, gaps } = partitionObservations(classification)
  const escalateForResearch = shouldEscalate(classification)
  const [{ error: appError }, { error: developmentError }] = await Promise.all([
    db.from('planning_applications').update({
      classification_state: 'classified',
      classification_started_at: null,
      review_state: 'pending',
      updated_at: now,
    }).eq('id', application.id),
    db.from('developments').update({
      relevance: classification.relevance,
      confidence: classification.confidence,
      summary: developmentSummary(classification.substantiveProposal, application.raw.description),
      creates_commercial_space: classification.commercialSpace.creates,
      commercial_use_classes: classification.commercialSpace.useClasses,
      // Kept beside Plota's own figure rather than overwriting it. The two disagree often,
      // both are evidence, and a reviewer needs to see both.
      model_dwelling_count: classification.dwellings.count,
      model_dwelling_basis: classification.dwellings.basis,
      escalate_for_research: escalateForResearch,
      research_state: escalateForResearch ? 'queued' : 'not_eligible',
      research_started_at: null,
      unanswered_questions: [...classification.unansweredQuestions, ...gaps],
      review_state: 'pending',
      updated_at: now,
    }).eq('id', developmentId),
  ])
  if (appError) throw appError
  if (developmentError) throw developmentError

  // A changed input supersedes unreviewed machine observations. Human-approved evidence
  // is retained and can only be changed explicitly through the review endpoint.
  const { error: deleteObservationsError } = await db
    .from('development_observations')
    .delete()
    .eq('planning_application_id', application.id)
    .eq('review_state', 'pending')
  if (deleteObservationsError) throw deleteObservationsError

  if (storable.length > 0) {
    const { error } = await db.from('development_observations').insert(
      storable.map((observation) => ({
        development_id: developmentId,
        planning_application_id: application.id,
        metric: observation.metric,
        scope: observation.scope,
        action: observation.action,
        value: observation.value,
        unit: observation.unit,
        evidence_excerpt: observation.evidence,
        confidence: observation.confidence,
        review_state: 'pending',
      }))
    )
    if (error) throw error
  }

  const { error: deleteSignalsError } = await db
    .from('development_brand_signals')
    .delete()
    .eq('planning_application_id', application.id)
    .eq('review_state', 'pending')
  if (deleteSignalsError) throw deleteSignalsError

  if (classification.brandMentions.length > 0) {
    const { error } = await db.from('development_brand_signals').insert(
      classification.brandMentions.map((mention) => ({
        development_id: developmentId,
        planning_application_id: application.id,
        brand_id: null,
        observed_name: mention.name,
        role: mention.role,
        evidence_source: 'description',
        evidence_excerpt: mention.evidence,
        confidence: mention.confidence,
        review_state: 'pending',
        planning_outcome: application.raw.stage ?? null,
      }))
    )
    if (error) throw error
  }

  // The raw output remains the authoritative model artefact; the rows above are a
  // reviewable projection for product queries.
  const { error: runError } = await db
    .from('planning_classification_runs')
    .update({ output: classification, development_id: developmentId })
    .eq('id', runId)
  if (runError) throw runError
}

export async function classifyPlanningBatch(input: {
  db: PlanningAdminClient
  apiKey: string
  model?: string
  limit?: number
}): Promise<ClassificationBatchResult> {
  const model = input.model ?? process.env.OPENROUTER_PLANNING_MODEL ?? DEFAULT_OPENROUTER_MODEL
  const monthlyBudget = configuredBudget(
    'PLANNING_LLM_MONTHLY_BUDGET_USD',
    DEFAULT_MONTHLY_LLM_BUDGET_USD
  )
  const stageBudget = configuredBudget(
    'PLANNING_LLM_INITIAL_BUDGET_USD',
    DEFAULT_INITIAL_STAGE_BUDGET_USD
  )
  const reservation = configuredBudget(
    'PLANNING_LLM_CLASSIFICATION_RESERVATION_USD',
    DEFAULT_CLASSIFICATION_RESERVATION_USD
  )
  if (
    model !== DEFAULT_OPENROUTER_MODEL &&
    process.env.PLANNING_LLM_CLASSIFICATION_RESERVATION_USD === undefined
  ) {
    throw new Error(
      'A custom OpenRouter model requires PLANNING_LLM_CLASSIFICATION_RESERVATION_USD so the hard budget remains valid'
    )
  }
  const limit = Math.max(1, Math.min(input.limit ?? 20, 100))

  const result: ClassificationBatchResult = {
    considered: 0,
    classified: 0,
    failed: 0,
    deferredBudget: 0,
  }

  for (let index = 0; index < limit; index++) {
    const staleBefore = new Date(Date.now() - CLASSIFICATION_LEASE_MS).toISOString()
    const { data, error } = await input.db.rpc('claim_next_planning_classification', {
      p_stale_before: staleBefore,
    })
    if (error) throw error
    if (!data) break
    const application = data as QueueRow
    result.considered++
    const developmentId = await linkedDevelopment(input.db, application.id)
    const { data: run, error: runError } = await input.db
      .from('planning_classification_runs')
      .upsert({
        planning_application_id: application.id,
        development_id: developmentId,
        stage: 'initial',
        provider: 'openrouter',
        model,
        prompt_version: PLANNING_PROMPT_VERSION,
        schema_version: PLANNING_SCHEMA_VERSION,
        input_hash: application.input_hash,
        status: 'running',
        error: null,
        started_at: new Date().toISOString(),
        finished_at: null,
      }, {
        onConflict: 'planning_application_id,stage,provider,model,prompt_version,schema_version,input_hash',
      })
      .select('id,status')
      .single()
    if (runError) throw runError

    const { data: usageId, error: reserveError } = await input.db.rpc(
      'reserve_planning_ai_usage',
      {
        p_planning_application_id: application.id,
        p_classification_run_id: run.id,
        p_stage: 'initial',
        p_provider: 'openrouter',
        p_model: model,
        p_reserved_usd: reservation,
        p_monthly_budget_usd: monthlyBudget,
        p_stage_budget_usd: stageBudget,
      }
    )
    if (reserveError) throw reserveError
    if (!usageId) {
      result.deferredBudget++
      await Promise.all([
        input.db.from('planning_applications').update({
          classification_state: 'deferred_budget', classification_started_at: null,
        }).eq('id', application.id),
        input.db.from('planning_classification_runs').update({
          status: 'deferred_budget',
          finished_at: new Date().toISOString(),
        }).eq('id', run.id),
      ])
      // Every following call would face the same cap, so stop instead of creating a
      // deferred run for the rest of the queue.
      break
    }

    const deadline = classificationItemDeadline()
    try {
      const classified = await classifyWithOpenRouter(application.raw, {
        apiKey: input.apiKey,
        model,
        signal: deadline.signal,
      })
      await persistClassification(
        input.db,
        application,
        developmentId,
        classified.classification,
        run.id
      )
      const actualCost = classified.costUsd ?? reservation
      const now = new Date().toISOString()
      const [{ error: finishRunError }, { error: finishUsageError }] = await Promise.all([
        input.db.from('planning_classification_runs').update({
          status: 'complete',
          model: classified.model,
          input_tokens: classified.inputTokens,
          output_tokens: classified.outputTokens,
          cost_usd: actualCost,
          finished_at: now,
        }).eq('id', run.id),
        input.db.from('planning_ai_usage').update({
          status: 'complete',
          model: classified.model,
          actual_usd: actualCost,
          input_tokens: classified.inputTokens,
          output_tokens: classified.outputTokens,
        }).eq('id', usageId),
      ])
      if (finishRunError) throw finishRunError
      if (finishUsageError) throw finishUsageError
      result.classified++
    } catch (classificationError) {
      const message = classificationError instanceof Error
        ? classificationError.message
        : 'Unknown classification failure'
      await Promise.all([
        input.db.from('planning_applications').update({
          classification_state: 'failed', classification_started_at: null,
        }).eq('id', application.id),
        input.db.from('planning_classification_runs').update({
          status: 'failed', error: message, cost_usd: reservation,
          finished_at: new Date().toISOString(),
        }).eq('id', run.id),
        // Once a call starts, conservatively charge its full reservation. Some failures
        // happen after a provider has generated (and billed for) an invalid answer; treating
        // them as free would let retries push the account beyond the hard ceiling.
        input.db.from('planning_ai_usage').update({
          status: 'complete', actual_usd: reservation,
        }).eq('id', usageId),
      ])
      result.failed++
    } finally {
      deadline.cleanup()
    }
  }
  return result
}

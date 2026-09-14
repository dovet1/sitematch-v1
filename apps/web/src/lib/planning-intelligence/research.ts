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
import {
  attemptOutcome,
  findingsFromDescription,
  findingsFromResearch,
  nextFactRows,
  type FactAttempt,
  type FactKey,
  type FactFinding,
  type FactRow,
} from './facts'
import { collectCouncilResearchSources } from './research-sources'
import type { PlotaApplication } from './types'

/** Attempts per development, counted at claim time. The last failure hands the scheme to admin. */
export const RESEARCH_ATTEMPT_LIMIT = 2

interface ResearchQueueRow {
  development_id: string
  planning_application_id: string
  input_hash: string
  raw: PlotaApplication
  attempt?: number
  attempt_limit?: number
}

export interface ResearchBatchResult {
  considered: number
  researched: number
  failed: number
  deferredBudget: number
  /** Distinct developments with a proposed occupier/operator found in this batch. */
  operatorsFound: number
  commercialFactsFound: number
}

export const RESEARCH_LEASE_MS = RESEARCH_REQUEST_TIMEOUT_MS + 120_000

function deadline(): { signal: AbortSignal; cleanup: () => void } {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(new Error('Planning research timed out')), RESEARCH_REQUEST_TIMEOUT_MS)
  return { signal: controller.signal, cleanup: () => clearTimeout(timeout) }
}

/**
 * Research evidence is additive. A repeat run used to delete pending research rows before
 * inserting its own, so a run that found nothing erased what an earlier run had found. Rows are
 * now inserted only when the same evidence is not already stored.
 */
async function addResearchSignals(
  db: PlanningAdminClient,
  row: ResearchQueueRow,
  signals: Awaited<ReturnType<typeof researchOperatorWithOpenRouter>>['signals']
) {
  if (signals.length === 0) return
  const { data: stored, error: readError } = await db.from('development_brand_signals')
    .select('observed_name,role,evidence_url')
    .eq('development_id', row.development_id)
    .in('evidence_source', ['council_page', 'document', 'web'])
  if (readError) throw readError
  const seen = new Set((stored ?? []).map((signal: { observed_name: string; role: string; evidence_url: string | null }) =>
    `${signal.observed_name.toLowerCase()}|${signal.role}|${signal.evidence_url}`))
  const fresh = signals.filter(signal => !seen.has(`${signal.name.toLowerCase()}|${signal.role}|${signal.evidenceUrl}`))
  if (fresh.length === 0) return

  const { error } = await db.from('development_brand_signals').insert(fresh.map((signal) => ({
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

async function addResearchFloorspace(
  db: PlanningAdminClient,
  row: ResearchQueueRow,
  findings: Awaited<ReturnType<typeof researchOperatorWithOpenRouter>>['commercialFloorspace']
) {
  if (findings.length === 0) return
  const { data: stored, error: readError } = await db.from('development_observations')
    .select('scope,value,measurement_basis,evidence_url')
    .eq('development_id', row.development_id)
    .eq('metric', 'commercial_floorspace')
    .not('evidence_url', 'is', null)
  if (readError) throw readError
  const seen = new Set((stored ?? []).map((o: { scope: string; value: number | string; measurement_basis: string | null; evidence_url: string }) =>
    `${o.scope}|${Number(o.value)}|${o.measurement_basis}|${o.evidence_url}`))
  const fresh = findings.filter(f => !seen.has(`${f.scope}|${f.sqm}|${f.measurementBasis}|${f.evidenceUrl}`))
  if (fresh.length === 0) return

  const actionByScope = {
    existing: 'retain', lost: 'remove', proposed: 'create', net: 'change',
  } as const
  const { error } = await db.from('development_observations').insert(fresh.map((finding) => ({
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

const FACT_COLUMNS = 'fact,state,reason,value,findings,attempts,decided_by,decided_at'

// Roles written when a family is grouped into one development: significant amendments are read
// with documents; paperwork on the timeline is quoted as context only.
const SIGNIFICANT_ROLES = new Set(['amendment', 'member'])
const MAX_MEMBER_DOCUMENT_SETS = 2

/** The rest of the development's family, so the scheme is researched once, not per application. */
async function familyContext(db: PlanningAdminClient, row: ResearchQueueRow) {
  const { data, error } = await db.from('development_applications')
    .select('role,planning_applications(id,reference,description,raw)')
    .eq('development_id', row.development_id)
  if (error) throw error
  type Member = { role: string; planning_applications: { id: string; reference: string; description: string | null; raw: PlotaApplication } | null }
  const members = ((data ?? []) as unknown as Member[])
    .filter(member => member.planning_applications && member.planning_applications.id !== row.planning_application_id)
  return {
    related: members.map(member => ({
      reference: member.planning_applications!.reference,
      relationship: SIGNIFICANT_ROLES.has(member.role) ? 'amendment to this scheme' : 'follow-up paperwork on this scheme',
      description: (member.planning_applications!.description ?? '').slice(0, 1500),
    })),
    documentSubjects: members.filter(member => SIGNIFICANT_ROLES.has(member.role))
      .slice(0, MAX_MEMBER_DOCUMENT_SETS).map(member => member.planning_applications!.raw),
  }
}

/** Merge this attempt into the checklist. Returns the rows written. */
async function recordFacts(
  db: PlanningAdminClient,
  developmentId: string,
  incoming: Record<FactKey, FactFinding[]>,
  attempt: FactAttempt
): Promise<FactRow[]> {
  const { data: stored, error } = await db.from('development_facts').select(FACT_COLUMNS).eq('development_id', developmentId)
  if (error) throw error
  const rows = nextFactRows({ stored: (stored ?? []) as FactRow[], incoming, attempt })
  const { error: writeError } = await db.rpc('planning_record_development_facts', {
    p_development_id: developmentId, p_rows: rows,
  })
  if (writeError) throw writeError
  return rows
}

const NO_FINDINGS = findingsFromResearch(
  { signals: [], useClasses: [], commercialFloorspace: [], siteAreas: [], partyClues: [] },
  { runId: null, at: new Date(0).toISOString() }
)

export async function researchPlanningBatch(input: {
  db: PlanningAdminClient
  apiKey: string
  model?: string
  limit?: number
  /** Claim only these developments, for a pilot. Omitted claims from the whole queue. */
  developmentIds?: string[]
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
  const developmentsWithOperators = new Set<string>()

  for (let index = 0; index < limit; index++) {
    const { data, error } = await input.db.rpc('claim_next_planning_research', {
      p_stale_before: new Date(Date.now() - RESEARCH_LEASE_MS).toISOString(),
      p_attempt_limit: RESEARCH_ATTEMPT_LIMIT,
      p_development_ids: input.developmentIds ?? null,
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
    let collected: Awaited<ReturnType<typeof collectCouncilResearchSources>> | null = null
    try {
      const family = await familyContext(input.db, row)
      collected = await collectCouncilResearchSources(row.raw)
      for (const member of family.documentSubjects) {
        const memberSources = await collectCouncilResearchSources(member)
        collected = {
          sources: [...collected.sources, ...memberSources.sources],
          warnings: [...collected.warnings, ...memberSources.warnings.map(warning => `${member.reference}: ${warning}`)],
        }
      }
      const researched = await researchOperatorWithOpenRouter({
        application: row.raw,
        sources: collected.sources,
        relatedApplications: family.related,
        apiKey: input.apiKey,
        model,
        signal: requestDeadline.signal,
      })
      await addResearchSignals(input.db, row, researched.signals)
      await addResearchFloorspace(input.db, row, researched.commercialFloorspace)
      const actualCost = researched.costUsd ?? reservation
      const now = new Date().toISOString()
      const documentsRetrieved = collected.sources.filter(source => source.kind === 'document').length
      const incoming = findingsFromResearch(researched, { runId: run.id, at: now })
      const described = findingsFromDescription(row.raw.description, { councilUrl: row.raw.links?.council ?? null, at: now })
      incoming.existing_use_class.push(...described.existing_use_class)
      incoming.proposed_use_class.push(...described.proposed_use_class)
      const facts = await recordFacts(input.db, row.development_id, incoming, {
        runId: run.id, at: now,
        outcome: attemptOutcome({
          documentsRetrieved,
          councilPageRetrieved: collected.sources.some(source => source.kind === 'council_page'),
          failed: false, attemptLimitReached: false, warnings: collected.warnings,
        }),
        documentsRetrieved, retrievalWarnings: collected.warnings, webSearches: researched.webSearchRequests,
      })
      const factValue = (fact: FactKey) => {
        const found = facts.find(row => row.fact === fact)
        return found?.state === 'found' && found.value && 'useClasses' in found.value ? found.value.useClasses : null
      }
      const existingUseClasses = factValue('existing_use_class')
      const proposedUseClasses = factValue('proposed_use_class')
      const unresolved = facts.some(fact => fact.state === 'not_found_after_research' || fact.state === 'conflicting')
      const [{ error: developmentError }, { error: finishRunError }, { error: finishUsageError }] =
        await Promise.all([
          input.db.from('developments').update({
            research_state: 'complete', research_started_at: null,
            research_outcome: unresolved ? 'facts_unresolved' : 'all_found', research_finished_at: now,
            // Written only when the checklist holds a value, which accumulates across runs, so a
            // run that finds nothing no longer blanks what an earlier run found.
            ...(existingUseClasses ? { existing_commercial_use_classes: existingUseClasses } : {}),
            ...(proposedUseClasses ? { proposed_commercial_use_classes: proposedUseClasses } : {}),
            last_enriched_at: now, updated_at: now,
          }).eq('id', row.development_id),
          input.db.from('planning_classification_runs').update({
            status: 'complete', model: researched.model,
            output: {
              signals: researched.signals,
              siteAreas: researched.siteAreas ?? [],
              partyClues: researched.partyClues ?? [],
              researchWarnings: researched.researchWarnings ?? [],
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
      if (researched.signals.some(signal =>
        signal.role === 'proposed_occupier' || signal.role === 'proposed_operator'
      )) {
        developmentsWithOperators.add(row.development_id)
      }
      result.operatorsFound = developmentsWithOperators.size
      result.commercialFactsFound += researched.commercialFloorspace.length + researched.useClasses.length
    } catch (researchError) {
      const message = researchError instanceof Error ? researchError.message : 'Unknown research failure'
      const now = new Date().toISOString()
      // The last attempt ends research and hands every unanswered fact to admin with the reason;
      // an earlier one stays failed for the queue to retry. If the hand-off itself cannot be
      // written, the row stays failed and the claim function finishes it on the next pass.
      let attemptLimitReached = (row.attempt ?? 1) >= (row.attempt_limit ?? RESEARCH_ATTEMPT_LIMIT)
      if (attemptLimitReached) {
        const documentsRetrieved = collected?.sources.filter(source => source.kind === 'document').length ?? 0
        try {
          await recordFacts(input.db, row.development_id, NO_FINDINGS, {
            runId: run.id, at: now, outcome: 'attempt_limit',
            documentsRetrieved, retrievalWarnings: [...(collected?.warnings ?? []), message], webSearches: 0,
          })
        } catch {
          attemptLimitReached = false
        }
      }
      await Promise.all([
        input.db.from('developments').update(attemptLimitReached
          ? { research_state: 'complete', research_started_at: null, research_outcome: 'attempt_limit', research_finished_at: now }
          : { research_state: 'failed', research_started_at: null }
        ).eq('id', row.development_id),
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
      // Failed items remain eligible for the SQL queue until their attempt limit. Stop this
      // invocation so it cannot immediately reclaim the same item and spend again on a failure.
      break
    } finally {
      requestDeadline.cleanup()
    }
  }
  return result
}

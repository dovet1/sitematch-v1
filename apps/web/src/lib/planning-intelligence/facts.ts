import { createHash } from 'crypto'
import type { PlanningResearchResult } from './types'

/**
 * The completeness checklist for one scheme. See docs/planning-pilot-completion-plan.md, step 2.
 *
 * Each fact is complete only on its own evidence: the existing area never answers the proposed
 * one, a unit or phase figure never answers a whole-development fact, and an applicant, developer
 * or agent never answers the operator. Findings accumulate across runs and are never erased; the
 * state is recomputed from all of them. An admin decision fixes the state and value, and later
 * machine findings are attached beside it for review, never over it.
 */
export const FACT_KEYS = [
  'operator',
  'existing_use_class',
  'proposed_use_class',
  'existing_floorspace',
  'proposed_floorspace',
  'net_floorspace',
  'site_area',
] as const
export type FactKey = typeof FACT_KEYS[number]

export type FactState =
  | 'not_checked'
  | 'found'
  | 'not_found_after_research'
  | 'conflicting'
  | 'unavailable'
  | 'not_applicable'

/** Why research ended without a fact. Shown to the admin as the reason for the task. */
export type UnresolvedReason =
  | 'documents_inaccessible'
  | 'documents_silent'
  | 'provider_failure'
  | 'attempt_limit'

/** What a figure describes. Only a whole-development or unstated extent completes a fact. */
export type FigureExtent = 'whole_development' | 'building' | 'unit' | 'phase' | 'unspecified'
export type MeasurementBasis = 'gross_internal' | 'net_internal' | 'gross_external' | 'unspecified'
export type AreaUnit = 'sqm' | 'sqft' | 'hectares' | 'acres'

export interface FactSource {
  kind: 'description' | 'council_page' | 'document' | 'web' | 'derived' | 'manual'
  url: string | null
  excerpt: string | null
  page: string | null
}

export interface FactFinding {
  /** Stable identity, so the same finding from a repeat run is stored once. */
  key: string
  origin: 'classifier' | 'research' | 'admin'
  /** False for context that must never complete the fact: an applicant beside an operator, a
   * unit figure beside a whole-development one, floorspace lost beside the existing area. */
  completes: boolean
  /** operator: a name. Use classes: a class. Areas: square metres, with the original kept. */
  name?: string
  role?: string
  useClass?: string
  sqm?: number
  original?: { value: number; unit: AreaUnit }
  extent?: FigureExtent
  basis?: MeasurementBasis
  note?: string
  source: FactSource
  confidence: number | null
  runId: string | null
  observedAt: string
  /** Set by an admin choosing between conflicting values. A rejected finding is kept, unused. */
  rejected?: boolean
}

export interface FactAttempt {
  runId: string | null
  at: string
  outcome: 'found' | UnresolvedReason
  documentsRetrieved: number
  retrievalWarnings: string[]
  webSearches: number
}

export interface FactRow {
  fact: FactKey
  state: FactState
  reason: UnresolvedReason | null
  value: FactValue | null
  findings: FactFinding[]
  attempts: FactAttempt[]
  decided_by: string | null
  decided_at: string | null
}

export type FactValue =
  | { names: string[] }
  | { useClasses: string[] }
  | { sqm: number; basis: MeasurementBasis; extent: FigureExtent; original?: { value: number; unit: AreaUnit } }

const SQM_PER_UNIT: Record<AreaUnit, number> = {
  sqm: 1, sqft: 0.09290304, hectares: 10_000, acres: 4046.8564224,
}

export function toSquareMetres(value: number, unit: AreaUnit): number {
  return Math.round(value * SQM_PER_UNIT[unit] * 100) / 100
}

function findingKey(fact: FactKey, parts: Array<string | number | null | undefined>): string {
  return createHash('sha1').update(JSON.stringify([fact, ...parts])).digest('hex').slice(0, 20)
}

function normalName(name: string): string {
  return name.toLowerCase().replace(/\b(ltd|limited|plc|llp|uk|group)\b\.?/g, '').replace(/[^a-z0-9]+/g, ' ').trim()
}

export function normalUseClass(useClass: string): string {
  return useClass.replace(/^\s*(?:use\s+)?class\s+/i, '').replace(/\s+/g, '').toUpperCase()
    .replace(/^SUIGENERIS$/, 'Sui Generis')
}

const COMPLETING_EXTENTS = new Set<FigureExtent>(['whole_development', 'unspecified'])

/** Turn one research result into findings per fact. Nothing here decides a state. */
export function findingsFromResearch(
  result: Pick<PlanningResearchResult, 'signals' | 'useClasses' | 'commercialFloorspace' | 'siteAreas' | 'partyClues'>,
  context: { runId: string | null; at: string }
): Record<FactKey, FactFinding[]> {
  const out = Object.fromEntries(FACT_KEYS.map(key => [key, [] as FactFinding[]])) as Record<FactKey, FactFinding[]>
  const base = (source: FactSource, confidence: number | null) => ({
    origin: 'research' as const, source, confidence, runId: context.runId, observedAt: context.at,
  })

  for (const signal of result.signals) {
    const operator = signal.role === 'proposed_occupier' || signal.role === 'proposed_operator'
    out.operator.push({
      ...base({ kind: signal.evidenceSource, url: signal.evidenceUrl, excerpt: signal.evidenceExcerpt, page: null }, signal.confidence),
      key: findingKey('operator', [normalName(signal.name), signal.role, signal.evidenceUrl]),
      completes: operator, name: signal.name, role: signal.role,
    })
  }
  for (const clue of result.partyClues ?? []) {
    out.operator.push({
      ...base({ kind: clue.evidenceSource, url: clue.evidenceUrl, excerpt: clue.evidenceExcerpt, page: clue.evidencePage }, clue.confidence),
      key: findingKey('operator', [normalName(clue.name), clue.role, clue.evidenceUrl]),
      completes: false, name: clue.name, role: clue.role,
    })
  }
  for (const finding of result.useClasses) {
    const fact: FactKey = finding.phase === 'existing' ? 'existing_use_class' : 'proposed_use_class'
    out[fact].push({
      ...base({ kind: finding.evidenceSource, url: finding.evidenceUrl, excerpt: finding.evidenceExcerpt, page: finding.evidencePage }, finding.confidence),
      key: findingKey(fact, [normalUseClass(finding.useClass), finding.evidenceUrl]),
      completes: true, useClass: finding.useClass,
    })
  }
  for (const finding of result.commercialFloorspace) {
    const extent: FigureExtent = finding.extent ?? 'unspecified'
    // Floorspace lost is not the existing area: a partial change of use loses part of it.
    const fact: FactKey = finding.scope === 'net' ? 'net_floorspace'
      : finding.scope === 'proposed' ? 'proposed_floorspace' : 'existing_floorspace'
    out[fact].push({
      ...base({ kind: finding.evidenceSource, url: finding.evidenceUrl, excerpt: finding.evidenceExcerpt, page: finding.evidencePage }, finding.confidence),
      key: findingKey(fact, [finding.scope, finding.sqm, finding.measurementBasis, extent, finding.evidenceUrl]),
      completes: finding.scope !== 'lost' && COMPLETING_EXTENTS.has(extent),
      sqm: finding.sqm, basis: finding.measurementBasis, extent,
      note: finding.scope === 'lost' ? 'Floor area lost by change of use or demolition' : undefined,
    })
  }
  for (const finding of result.siteAreas ?? []) {
    const extent: FigureExtent = finding.extent ?? 'unspecified'
    out.site_area.push({
      ...base({ kind: finding.evidenceSource, url: finding.evidenceUrl, excerpt: finding.evidenceExcerpt, page: finding.evidencePage }, finding.confidence),
      key: findingKey('site_area', [finding.value, finding.unit, finding.phase, extent, finding.evidenceUrl]),
      completes: COMPLETING_EXTENTS.has(extent),
      sqm: toSquareMetres(finding.value, finding.unit), original: { value: finding.value, unit: finding.unit },
      extent, basis: 'unspecified',
      note: finding.phase === 'unspecified' ? undefined : `Stated as the ${finding.phase} site area`,
    })
  }
  return out
}

/** Union by key. An existing finding wins, so an admin's rejection of it survives a repeat run. */
export function mergeFindings(existing: FactFinding[], incoming: FactFinding[]): FactFinding[] {
  const seen = new Set(existing.map(finding => finding.key))
  return [...existing, ...incoming.filter(finding => !seen.has(finding.key) && seen.add(finding.key))]
}

// Gross internal is what the standard form asks for, so it is the figure shown when several
// bases are stated. Different bases are different measurements, never a conflict.
const BASIS_PREFERENCE: MeasurementBasis[] = ['gross_internal', 'unspecified', 'gross_external', 'net_internal']

function sameFigure(a: number, b: number): boolean {
  return Math.abs(a - b) <= Math.max(1, Math.max(Math.abs(a), Math.abs(b)) * 0.01)
}

type Resolution = Pick<FactRow, 'state' | 'value'>

function resolveArea(findings: FactFinding[]): Resolution | null {
  const usable = findings.filter(f => f.completes && !f.rejected && typeof f.sqm === 'number')
  for (const basis of BASIS_PREFERENCE) {
    const figures = usable.filter(f => (f.basis ?? 'unspecified') === basis)
    if (figures.length === 0) continue
    const distinct = figures.filter((f, i) => figures.findIndex(o => sameFigure(o.sqm!, f.sqm!)) === i)
    if (distinct.length > 1) return { state: 'conflicting', value: null }
    // A whole-development figure is preferred to an unstated extent for the same basis.
    const chosen = figures.find(f => f.extent === 'whole_development') ?? figures[0]
    return {
      state: 'found',
      value: { sqm: chosen.sqm!, basis, extent: chosen.extent ?? 'unspecified', ...(chosen.original ? { original: chosen.original } : {}) },
    }
  }
  return null
}

/**
 * Net is stated, or derived from existing and proposed figures with the same extent and basis.
 * The derivation is added as its own finding, so the admin sees where the number came from.
 */
export function derivedNetFinding(facts: Record<FactKey, FactFinding[]>, at: string): FactFinding | null {
  const existing = resolveArea(facts.existing_floorspace)
  const proposed = resolveArea(facts.proposed_floorspace)
  if (existing?.state !== 'found' || proposed?.state !== 'found') return null
  const e = existing.value as Extract<FactValue, { sqm: number }>
  const p = proposed.value as Extract<FactValue, { sqm: number }>
  if (e.basis !== p.basis || e.extent !== p.extent) return null
  const sqm = Math.round((p.sqm - e.sqm) * 100) / 100
  return {
    key: findingKey('net_floorspace', ['derived', e.sqm, p.sqm, e.basis, e.extent]),
    origin: 'research', completes: true, sqm, basis: e.basis, extent: e.extent,
    note: `Derived: proposed ${p.sqm} m² less existing ${e.sqm} m²`,
    source: { kind: 'derived', url: null, excerpt: null, page: null },
    confidence: null, runId: null, observedAt: at,
  }
}

export function resolveFindings(fact: FactKey, findings: FactFinding[]): Resolution | null {
  const usable = findings.filter(f => f.completes && !f.rejected)
  if (fact === 'operator') {
    const names = [...new Map(usable.filter(f => f.name).map(f => [normalName(f.name!), f.name!])).values()]
    return names.length > 0 ? { state: 'found', value: { names } } : null
  }
  if (fact === 'existing_use_class' || fact === 'proposed_use_class') {
    const classes = [...new Map(usable.filter(f => f.useClass).map(f => [normalUseClass(f.useClass!), f.useClass!])).values()]
    return classes.length > 0 ? { state: 'found', value: { useClasses: classes } } : null
  }
  return resolveArea(findings)
}

/**
 * Given the stored rows and one finished research attempt, the rows to write. Every fact that
 * research did not answer leaves `not_checked` with the attempt's reason, so the admin queue sees
 * it whatever went wrong. Admin-decided rows gain findings and attempts but keep their decision.
 */
export function nextFactRows(input: {
  stored: FactRow[]
  incoming: Record<FactKey, FactFinding[]>
  attempt: FactAttempt
}): FactRow[] {
  const stored = new Map(input.stored.map(row => [row.fact, row]))
  const merged = Object.fromEntries(FACT_KEYS.map(fact => [
    fact, mergeFindings(stored.get(fact)?.findings ?? [], input.incoming[fact] ?? []),
  ])) as Record<FactKey, FactFinding[]>
  const net = derivedNetFinding(merged, input.attempt.at)
  if (net) merged.net_floorspace = mergeFindings(merged.net_floorspace, [net])

  return FACT_KEYS.map(fact => {
    const previous = stored.get(fact)
    const findings = merged[fact]
    const attempts = [...(previous?.attempts ?? []), input.attempt]
    if (previous?.decided_by) return { ...previous, findings, attempts }
    if (previous?.state === 'not_applicable') return { ...previous, findings, attempts }
    const resolved = resolveFindings(fact, findings)
    if (resolved) return { fact, ...resolved, reason: null, findings, attempts, decided_by: null, decided_at: null }
    const reason = input.attempt.outcome === 'found' ? 'documents_silent' : input.attempt.outcome
    return { fact, state: 'not_found_after_research', value: null, reason, findings, attempts, decided_by: null, decided_at: null }
  })
}

/**
 * The attempt's outcome for facts it did not answer. Blocked documents are named as such only
 * when no document text was read at all; if documents were read and did not state the fact, the
 * documents were silent, which is a different task for the admin.
 */
export function attemptOutcome(input: {
  documentsRetrieved: number
  councilPageRetrieved: boolean
  failed: boolean
  attemptLimitReached: boolean
}): FactAttempt['outcome'] {
  if (input.failed) return input.attemptLimitReached ? 'attempt_limit' : 'provider_failure'
  if (input.documentsRetrieved === 0) return 'documents_inaccessible'
  return 'documents_silent'
}

export const FACT_LABELS: Record<FactKey, string> = {
  operator: 'Operator or occupier',
  existing_use_class: 'Existing use class',
  proposed_use_class: 'Proposed use class',
  existing_floorspace: 'Existing commercial floor area',
  proposed_floorspace: 'Proposed commercial floor area',
  net_floorspace: 'Net change in commercial floor area',
  site_area: 'Site area',
}

export const REASON_LABELS: Record<UnresolvedReason, string> = {
  documents_inaccessible: 'The council documents could not be accessed.',
  documents_silent: 'The documents that could be read did not state it.',
  provider_failure: 'The research attempt failed before it finished.',
  attempt_limit: 'Research stopped after reaching its attempt limit.',
}

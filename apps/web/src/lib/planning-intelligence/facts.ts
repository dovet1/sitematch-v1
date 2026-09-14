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
  /** `dataset`: an official structured record, such as the London Datahub. */
  kind: 'description' | 'council_page' | 'document' | 'web' | 'dataset' | 'derived' | 'manual'
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

// A plain FNV-1a hash rather than node's crypto, because the admin page imports this module in the
// browser. Keys only need to be stable and unlikely to collide within one fact's findings.
function fnv1a(text: string, seed: number): string {
  let hash = seed >>> 0
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash.toString(16).padStart(8, '0')
}

function findingKey(fact: FactKey, parts: Array<string | number | null | undefined>): string {
  const text = JSON.stringify([fact, ...parts])
  return fnv1a(text, 0x811c9dc5) + fnv1a(text, 0x050c5d1f)
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
      sqm: toSquareMetres(finding.value, finding.unit),
      ...(finding.unit === 'sqm' ? {} : { original: { value: finding.value, unit: finding.unit } }),
      extent, basis: 'unspecified',
      note: finding.phase === 'unspecified' ? undefined : `Stated as the ${finding.phase} site area`,
    })
  }
  return out
}

// Use classes as written in UK planning descriptions. A bare single letter is too common to read as a
// class, so "E" or "F" alone needs the word Class before it; coded forms such as B8 or E(g)(iii) do not.
const CLASS_CODE = String.raw`(?:[A-G]\.?\d[A-Z]?(?:\([a-z]\))?|E\([a-g]\)(?:\([ivx]+\))?|Sui\s+Generis)`
const CLASS_WORD = String.raw`(?:Use\s+)?Class(?:es)?\s+(?:[A-G](?:\.?\d[A-Z]?)?(?:\([a-z]\))?(?:\([ivx]+\))?|\d{1,2}[A-Z]?|Sui\s+Generis)`
const CLASS_TOKEN = new RegExp(String.raw`\b${CLASS_WORD}|\b${CLASS_CODE}(?![\w(])`, 'gi')
const EXISTING_CUE = /\b(?:existing|former|current|previous)\b[^.;]{0,60}$/i

/**
 * Use classes the application's own description states. The description is the applicant's legal
 * wording of the proposal, so an explicit class there is evidence, and it is often the only
 * evidence where council documents are blocked. Only explicit classes are read, never a class
 * inferred from an activity. "from X to Y" wording splits existing from proposed; without it a
 * class is existing only when an existing-use word precedes it.
 */
export function findingsFromDescription(
  description: string | null | undefined,
  context: { councilUrl: string | null; at: string }
): Pick<Record<FactKey, FactFinding[]>, 'existing_use_class' | 'proposed_use_class'> {
  const out = { existing_use_class: [] as FactFinding[], proposed_use_class: [] as FactFinding[] }
  const text = (description ?? '').replace(/\s+/g, ' ')
  const from = text.search(/\bfrom\b/i)
  const to = from >= 0 ? text.slice(from).search(/\b(?:to|into)\b/i) : -1
  const boundary = from >= 0 && to >= 0 ? from + to : -1
  const seen = new Set<string>()
  for (const match of text.matchAll(CLASS_TOKEN)) {
    const index = match.index ?? 0
    const useClass = match[0].replace(/^(?:Use\s+)?Class(?:es)?\s+/i, '').replace(/\s+/g, ' ')
    const phase = boundary >= 0
      ? (index > from && index < boundary ? 'existing' : index >= boundary ? 'proposed' : null)
      : (EXISTING_CUE.test(text.slice(Math.max(0, index - 80), index)) ? 'existing' : 'proposed')
    if (!phase) continue
    const fact: FactKey = phase === 'existing' ? 'existing_use_class' : 'proposed_use_class'
    const id = `${fact}|${normalUseClass(useClass)}`
    if (seen.has(id)) continue
    seen.add(id)
    out[fact].push({
      key: findingKey(fact, ['description', normalUseClass(useClass)]),
      origin: 'research', completes: true, useClass,
      source: { kind: 'description', url: context.councilUrl, excerpt: text.slice(Math.max(0, index - 90), index + match[0].length + 40).trim(), page: null },
      confidence: 0.8, runId: null, observedAt: context.at,
      note: 'Stated in the application description',
    })
  }
  return out
}

/**
 * Merge new findings into stored rows without recording a research attempt, and recompute states.
 * A fact that stays unanswered keeps its previous state and reason; admin decisions are untouched.
 */
export function refreshFactRows(stored: FactRow[], incoming: Partial<Record<FactKey, FactFinding[]>>): FactRow[] {
  return stored.map(row => {
    const findings = mergeFindings(row.findings, incoming[row.fact] ?? [])
    if (row.decided_by || row.state === 'not_applicable') return { ...row, findings }
    const resolved = resolveFindings(row.fact, findings)
    return resolved ? { ...row, ...resolved, reason: null, findings } : { ...row, findings }
  })
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
    const withClass = usable.filter(f => f.useClass)
    // A scheme can have several classes, so one source listing two is not a conflict. Two sources
    // that name no class in common are: a council's stale land-use field against the application's
    // own wording, say.
    const bySource = new Map<string, Set<string>>()
    for (const finding of withClass) {
      const source = `${finding.source.kind}|${finding.source.url ?? ''}`
      bySource.set(source, (bySource.get(source) ?? new Set()).add(normalUseClass(finding.useClass!)))
    }
    const sets = [...bySource.values()]
    if (sets.some((a, i) => sets.slice(i + 1).some(b => ![...a].some(item => b.has(item))))) {
      return { state: 'conflicting', value: null }
    }
    const classes = [...new Map(withClass.map(f => [normalUseClass(f.useClass!), f.useClass!])).values()]
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
 * The attempt's outcome for facts it did not answer. Documents count as inaccessible when none
 * were read, or when the collector reports the application documents themselves were blocked or
 * missing (a portal disallowed by robots.txt, or no application PDF): a council page alone rarely
 * states areas. Otherwise documents were read and did not state the fact, which is a different
 * task for the admin.
 */
const DOCUMENTS_BLOCKED = /disallowed by robots\.txt|No application PDF retrieved|could not be read|returned [45]\d\d/i

export function attemptOutcome(input: {
  documentsRetrieved: number
  councilPageRetrieved: boolean
  failed: boolean
  attemptLimitReached: boolean
  warnings?: string[]
}): FactAttempt['outcome'] {
  if (input.failed) return input.attemptLimitReached ? 'attempt_limit' : 'provider_failure'
  if (input.documentsRetrieved === 0) return 'documents_inaccessible'
  if ((input.warnings ?? []).some(warning => DOCUMENTS_BLOCKED.test(warning))) return 'documents_inaccessible'
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

export interface AdminFactInput {
  fact: FactKey
  names?: string[]
  useClasses?: string[]
  area?: { value: number; unit: AreaUnit; extent: FigureExtent; basis: MeasurementBasis }
  source: { url: string | null; excerpt: string | null; page: string | null }
}

/**
 * The value and evidence finding for a fact an admin adds. Evidence is required: a source URL or
 * an excerpt naming where the figure came from. The same rules bind the admin as the machine, so a
 * unit or phase area cannot be entered as a whole-development fact.
 */
export function adminFactValue(input: AdminFactInput, reviewerId: string, at: string): { value: FactValue; finding: FactFinding } {
  if (!input.source.url && !input.source.excerpt?.trim()) {
    throw new Error('Add a source link or quote the evidence for this fact.')
  }
  const base = {
    origin: 'admin' as const, completes: true, confidence: 1, runId: null, observedAt: at,
    source: { kind: 'manual' as const, ...input.source }, note: `Added by admin ${reviewerId}`,
  }
  if (input.fact === 'operator') {
    const names = (input.names ?? []).map(name => name.trim()).filter(Boolean)
    if (names.length === 0) throw new Error('Enter the operator or occupier name.')
    return { value: { names }, finding: { ...base, key: findingKey('operator', ['admin', ...names.map(normalName), at]), name: names.join(', '), role: 'proposed_occupier' } }
  }
  if (input.fact === 'existing_use_class' || input.fact === 'proposed_use_class') {
    const useClasses = (input.useClasses ?? []).map(value => value.trim()).filter(Boolean)
    if (useClasses.length === 0) throw new Error('Enter at least one use class.')
    return { value: { useClasses }, finding: { ...base, key: findingKey(input.fact, ['admin', ...useClasses.map(normalUseClass), at]), useClass: useClasses.join(', ') } }
  }
  const area = input.area
  if (!area || !Number.isFinite(area.value)) throw new Error('Enter the area.')
  if (area.value < 0 && input.fact !== 'net_floorspace') throw new Error('Only a net change can be negative.')
  if (!COMPLETING_EXTENTS.has(area.extent)) {
    throw new Error('A unit, building or phase figure cannot complete this fact. Record it as a note, or mark the fact unavailable.')
  }
  const sqm = toSquareMetres(area.value, area.unit)
  const original = area.unit === 'sqm' ? undefined : { value: area.value, unit: area.unit }
  return {
    value: { sqm, basis: area.basis, extent: area.extent, ...(original ? { original } : {}) },
    finding: { ...base, key: findingKey(input.fact, ['admin', sqm, area.basis, area.extent, at]), sqm, basis: area.basis, extent: area.extent, ...(original ? { original } : {}) },
  }
}

/** The value an admin picks from conflicting findings; every other completing finding is rejected. */
export function chosenFactValue(row: Pick<FactRow, 'fact' | 'findings'>, key: string): { value: FactValue; rejectKeys: string[] } {
  const chosen = row.findings.find(finding => finding.key === key)
  if (!chosen || !chosen.completes) throw new Error('That finding cannot be chosen for this fact.')
  // An area is one figure, so every other figure is rejected. A use class is chosen by source: the
  // chosen source's classes are kept together and other sources' classes rejected.
  const sameSource = (finding: FactFinding) => finding.source.kind === chosen.source.kind && finding.source.url === chosen.source.url
  const rejectKeys = row.findings
    .filter(finding => finding.completes && !finding.rejected && finding.key !== key)
    .filter(finding => chosen.sqm !== undefined ? finding.sqm !== undefined : !sameSource(finding))
    .map(finding => finding.key)
  const resolved = resolveFindings(row.fact, row.findings.map(finding => rejectKeys.includes(finding.key) ? { ...finding, rejected: true } : finding))
  if (!resolved?.value || resolved.state !== 'found') throw new Error('That finding does not give a value for this fact.')
  return { value: resolved.value, rejectKeys }
}

/**
 * The machine state a fact returns to when an admin reopens it: recomputed from research findings
 * only, with the admin's own findings and rejections set aside, and the last attempt's reason. The
 * database function alone would leave it `not_checked`, which drops it out of the open queue.
 */
export function reopenedFactState(row: Pick<FactRow, 'fact' | 'findings' | 'attempts'>): Pick<FactRow, 'state' | 'value' | 'reason'> {
  const machine = row.findings.filter(f => f.origin !== 'admin').map(f => ({ ...f, rejected: false }))
  const resolved = resolveFindings(row.fact, machine)
  if (resolved) return { ...resolved, reason: null }
  const last = row.attempts.at(-1)
  if (!last) return { state: 'not_checked', value: null, reason: null }
  return { state: 'not_found_after_research', value: null, reason: last.outcome === 'found' ? 'documents_silent' : last.outcome }
}

export interface PublicFact {
  fact: FactKey
  label: string
  state: 'found' | 'unavailable' | 'not_applicable' | 'not_established'
  value: string | null
  confirmedByAdmin: boolean
  sources: Array<{ kind: FactSource['kind']; url: string | null; page: string | null }>
}

/**
 * What the product shows for a scheme. Only the evidence that completes a fact is published, so an
 * applicant's or agent's name recorded as context never appears. Open and conflicting facts read as
 * not established; nothing is shown until research or an admin has looked at the scheme.
 */
export function publicFacts(rows: Array<Pick<FactRow, 'fact' | 'state' | 'value' | 'findings' | 'decided_by'>>): PublicFact[] {
  if (!rows.some(row => row.state !== 'not_checked')) return []
  return FACT_KEYS.map(fact => {
    const row = rows.find(item => item.fact === fact)
    const state: PublicFact['state'] = row && (row.state === 'found' || row.state === 'unavailable' || row.state === 'not_applicable')
      ? row.state : 'not_established'
    const sources = state === 'found'
      ? (row?.findings ?? []).filter(f => f.completes && !f.rejected)
        .map(f => ({ kind: f.source.kind, url: f.source.url && /^https?:\/\//i.test(f.source.url) ? f.source.url : null, page: f.source.page }))
        // One link per document and page: the description and the council page share a URL.
        .filter((source, index, all) => all.findIndex(o => (o.url ?? o.kind) === (source.url ?? source.kind) && o.page === source.page) === index)
        .slice(0, 5)
      : []
    return {
      fact, label: FACT_LABELS[fact], state,
      value: state === 'found' ? formatFactValue(row?.value ?? null) : null,
      confirmedByAdmin: Boolean(row?.decided_by),
      sources,
    }
  })
}

export function formatFactValue(value: FactValue | null): string | null {
  if (!value) return null
  if ('names' in value) return value.names.join(', ')
  if ('useClasses' in value) return value.useClasses.join(', ')
  const original = value.original && value.original.unit !== 'sqm' ? ` (stated as ${value.original.value.toLocaleString('en-GB')} ${value.original.unit})` : ''
  const extent = value.extent === 'unspecified' ? '' : ` — ${value.extent.replaceAll('_', ' ')}`
  const basis = value.basis === 'unspecified' ? '' : `, ${value.basis.replaceAll('_', ' ')}`
  return `${value.sqm.toLocaleString('en-GB')} m²${original}${extent}${basis}`
}

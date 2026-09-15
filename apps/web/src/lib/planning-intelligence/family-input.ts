import { createHash } from 'crypto'
import type { PlotaApplication } from './types'

/**
 * Grouped classification: what the model reads for a development with more than one application.
 * See docs/planning-pilot-completion-plan.md, step 3a, and the linking plan's step 5.
 *
 * - The main application in full, as a single application is read today.
 * - The significant changes (amendments, reserved matters, linked consents), newest first, capped,
 *   each with its own reference so every figure can name where it came from.
 * - Paperwork as counts and a latest date only. Its text is never sent: condition submissions say
 *   nothing about what the scheme is, and a run of them invites reading progress into paperwork.
 * - When the original is missing, which references the family cites instead.
 */

export const FAMILY_MAX_CHANGES = 8
export const FAMILY_DESCRIPTION_CHARS = 1200

export interface FamilyMember {
  role: string
  raw: PlotaApplication
}

export interface FamilyChange {
  reference: string
  kind: 'amendment' | 'linked_consent'
  procedure: string | null
  planningRoute: string | null
  dateReceived: string | null
  stage: string | null
  description: string
  statedDwellingCount: number | null
  statedFloorspaceSqm: number | null
}

export interface FamilyInput {
  originalHeld: boolean
  /** References the family cites for an original we do not hold. */
  citedOriginals: string[]
  main: Record<string, unknown>
  changes: FamilyChange[]
  /** Significant changes beyond the cap, so the model knows the list is not complete. */
  earlierChangesNotShown: number
  paperwork: { conditionSubmissions: number; minorAmendments: number; latestDate: string | null }
}

const SIGNIFICANT = new Set(['amendment', 'member'])

function trimmed(text: string | null | undefined): string {
  const value = (text ?? '').replace(/\s+/g, ' ').trim()
  return value.length > FAMILY_DESCRIPTION_CHARS ? `${value.slice(0, FAMILY_DESCRIPTION_CHARS)}…` : value
}

function latest(a: string | null, b: string | null | undefined): string | null {
  if (!b) return a
  return !a || b > a ? b : a
}

export function buildFamilyInput(input: {
  mainInput: Record<string, unknown>
  members: FamilyMember[]
  originalHeld: boolean
  citedOriginals?: string[]
}): FamilyInput {
  const significant = input.members
    .filter((member) => SIGNIFICANT.has(member.role))
    .sort((a, b) => (b.raw.date_received ?? '').localeCompare(a.raw.date_received ?? '') || a.raw.reference.localeCompare(b.raw.reference))
  const paperwork = { conditionSubmissions: 0, minorAmendments: 0, latestDate: null as string | null }
  for (const member of input.members) {
    if (member.role === 'condition') paperwork.conditionSubmissions++
    else if (member.role === 'related') paperwork.minorAmendments++
    else continue
    paperwork.latestDate = latest(paperwork.latestDate, member.raw.date_received)
  }
  return {
    originalHeld: input.originalHeld,
    citedOriginals: [...(input.citedOriginals ?? [])].sort(),
    main: input.mainInput,
    changes: significant.slice(0, FAMILY_MAX_CHANGES).map((member) => ({
      reference: member.raw.reference,
      kind: member.role === 'member' ? 'linked_consent' : 'amendment',
      procedure: member.raw.procedure ?? null,
      planningRoute: member.raw.planning_route ?? null,
      dateReceived: member.raw.date_received ?? null,
      stage: member.raw.stage ?? null,
      description: trimmed(member.raw.description),
      statedDwellingCount: member.raw.dwelling_count ?? null,
      statedFloorspaceSqm: member.raw.floorspace_sqm ?? null,
    })),
    earlierChangesNotShown: Math.max(0, significant.length - FAMILY_MAX_CHANGES),
    paperwork,
  }
}

/**
 * The fingerprint of what the scheme is: the main application and its significant changes. The
 * paperwork summary is left out on purpose, so a condition submission arriving never makes a
 * family's grade look stale. Re-grading is decided by what joins, not by this hash.
 */
export function familyInputHash(input: FamilyInput): string {
  const scheme = { originalHeld: input.originalHeld, citedOriginals: input.citedOriginals, main: input.main, changes: input.changes, earlierChangesNotShown: input.earlierChangesNotShown }
  return createHash('sha256').update(JSON.stringify(scheme)).digest('hex')
}

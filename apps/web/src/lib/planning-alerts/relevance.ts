import type {
  PlanningAlertApplication,
  PlanningAlertApplicationRelevance,
} from './types'

function normalise(value: string | null | undefined): string {
  return (value ?? '')
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/&(?:#x27|apos);/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

function contains(text: string, pattern: RegExp): boolean {
  return pattern.test(text)
}

const COMMERCIAL_OR_INSTITUTIONAL_USE = /\b(?:retail|shop|bar|pub|restaurant|caf[eé]|foodstore|supermarket|hotel|leisure|gym|health club|office|industrial|warehouse|trade warehouse|trade counter|logistics|factory|employment|commercial|care home|residential institution|nursery|school|education|student accommodation|hmo|house in multiple occupation)\b/
const DEVELOPMENT_ACTION = /\b(?:erection|construction|development|redevelopment|conversion|change of use|demolition and (?:erection|construction)|new build)\b/
const RESIDENTIAL_SCHEME = /\b(?:dwellings?|homes?|houses?|flats?|apartments?|bungalows?|residential development)\b/
const PROCEDURAL_UPDATE = /\b(?:discharge|part discharge|variation of condition|non material amendment|reserved matters|approval of details|condition\s+\d+)\b/
const DOMESTIC_CONTEXT = /\b(?:dwellinghouse|dwelling|householder|domestic|garage|conservatory|porch|loft|rear extension|side extension)\b/

function housingUnitCount(text: string): number | null {
  const pattern = /\b(\d+)\s*(?:no\.?\s*)?(?:new\s+)?(?:dwellings?|homes?|houses?|flats?|apartments?|residential units?)\b/g
  let largest: number | null = null
  let match = pattern.exec(text)
  while (match) {
    const count = Number(match[1])
    if (Number.isFinite(count)) largest = Math.max(largest ?? 0, count)
    match = pattern.exec(text)
  }
  return largest
}

/**
 * A transparent, deterministic first pass. It deliberately ranks rather than
 * removes applications so users can still inspect low-relevance results.
 */
export function classifyCommercialRelevance(
  application: PlanningAlertApplication
): PlanningAlertApplicationRelevance {
  const applicationType = normalise(application.applicationType)
  const description = normalise(application.description)
  const text = normalise(`${application.address} ${application.description}`)
  const unitCount = housingUnitCount(text)
  const hasCommercialUse = contains(text, COMMERCIAL_OR_INSTITUTIONAL_USE)
  const hasDevelopmentAction = contains(description, DEVELOPMENT_ACTION)
  const isProcedural = applicationType === 'discharge conditions' || contains(description, PROCEDURAL_UPDATE)

  if (applicationType === 'householder') {
    return { level: 'low', reason: 'Routine householder application' }
  }

  if (applicationType === 'tree works') {
    return { level: 'low', reason: 'Tree works' }
  }

  if (applicationType === 'advertisement') {
    return { level: 'low', reason: 'Minor signage or advertisement application' }
  }

  if (isProcedural) {
    if ((unitCount ?? 0) >= 10 || hasCommercialUse || /\b(?:mixed use|major|strategic)\b/.test(text)) {
      return { level: 'watchlist', reason: 'Progress update for a significant scheme' }
    }
    return { level: 'low', reason: 'Administrative follow-up to an existing permission' }
  }

  if ((unitCount ?? 0) >= 10 || /\b(?:major development|strategic development|mixed use)\b/.test(text)) {
    return {
      level: 'priority',
      reason: unitCount ? `Significant residential scheme (${unitCount} homes)` : 'Major or mixed-use development',
    }
  }

  if (/\bchange of use\b/.test(description) && hasCommercialUse) {
    return { level: 'priority', reason: 'Commercial or institutional change of use' }
  }

  if (hasCommercialUse && hasDevelopmentAction && !contains(description, DOMESTIC_CONTEXT)) {
    return { level: 'priority', reason: 'New commercial or institutional development' }
  }

  if (hasCommercialUse) {
    return { level: 'watchlist', reason: 'Commercial property activity' }
  }

  if (contains(text, RESIDENTIAL_SCHEME) || (unitCount ?? 0) > 0) {
    return { level: 'watchlist', reason: 'Smaller residential development' }
  }

  if (applicationType === 'full planning' || applicationType === 'outline planning' || applicationType === 'prior approval') {
    return { level: 'watchlist', reason: 'Development proposal requiring review' }
  }

  if (applicationType === 'lawful development' || applicationType === 'listed building') {
    return { level: 'low', reason: 'Minor or administrative application' }
  }

  return { level: 'low', reason: 'No strong commercial property signal detected' }
}

export function withCommercialRelevance(
  application: PlanningAlertApplication
): PlanningAlertApplication {
  return {
    ...application,
    relevance: classifyCommercialRelevance(application),
  }
}

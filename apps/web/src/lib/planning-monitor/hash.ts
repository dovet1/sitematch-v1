import { createHash } from 'crypto'
import { CAPABILITIES, canonicalJson, normaliseCriteria, type FilterCapabilities, type MonitorCriteria } from './criteria'

/**
 * Identity of a criteria document under a capability version. Responses carry it so the list,
 * count and clusters can tell a stale answer from a current one, and caches key on it.
 * Server-only: the client never needs to compute it.
 */
export function criteriaHash(criteria: MonitorCriteria, capabilities: FilterCapabilities = CAPABILITIES): string {
  return createHash('sha256')
    .update(`${capabilities.version}:${canonicalJson(normaliseCriteria(criteria))}`)
    .digest('hex')
    .slice(0, 32)
}

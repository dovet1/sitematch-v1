/**
 * Advanced Filtering System - Type Definitions
 *
 * Supports natural language filter building with operators:
 * - HAVE: BUA contains store
 * - DON'T HAVE: BUA doesn't contain store
 * - HAVE WITHIN: Store within distance of BUA
 * - DON'T HAVE WITHIN: No store within distance of BUA
 */

export type FilterOperator = 'has' | 'has_not' | 'has_within' | 'has_not_within'
export type Connector = 'and' | 'or'
export type TargetType = 'fascia' | 'category'
export type MatchingLogic = 'any' | 'all' // For multiple targets in same rule

export interface FilterRule {
  id: string
  operator: FilterOperator
  targetType: TargetType
  targetIds: string[] // UUIDs of fascias or categories
  distance?: number // in meters, for proximity operators
  matchingLogic: MatchingLogic // 'any' = OR, 'all' = AND within same rule
  connector?: Connector // how this rule connects to the NEXT rule
}

export interface FilterSet {
  rules: FilterRule[]
}

/**
 * Helper type for frontend display
 */
export interface FilterRuleDisplay extends FilterRule {
  targetNames: string[] // Human-readable names for display
}

/**
 * Constants
 */
export const DISTANCE_PRESETS = [1000, 3000, 5000, 10000] as const // 1km, 3km, 5km, 10km
export const MAX_RULES = 10

/**
 * Operator display names
 */
export const OPERATOR_LABELS: Record<FilterOperator, string> = {
  has: 'HAVE',
  has_not: "DON'T HAVE",
  has_within: 'HAVE WITHIN',
  has_not_within: "DON'T HAVE WITHIN",
}

/**
 * Check if operator is a proximity type
 */
export function isProximityOperator(operator: FilterOperator): boolean {
  return operator === 'has_within' || operator === 'has_not_within'
}

/**
 * Get default distance for proximity operators
 */
export function getDefaultDistance(): number {
  return 5000 // 5km
}

/**
 * Create empty filter rule
 */
export function createEmptyRule(): FilterRule {
  return {
    id: crypto.randomUUID(),
    operator: 'has',
    targetType: 'fascia',
    targetIds: [],
    matchingLogic: 'any',
    connector: 'and',
  }
}

/**
 * Validate filter rule
 */
export function validateRule(rule: FilterRule): string | null {
  if (rule.targetIds.length === 0) {
    return 'Please select at least one store or category'
  }

  if (isProximityOperator(rule.operator) && !rule.distance) {
    return 'Please select a distance'
  }

  if (isProximityOperator(rule.operator) && rule.distance) {
    if (rule.distance < 100 || rule.distance > 50000) {
      return 'Distance must be between 100m and 50km'
    }
  }

  return null
}

/**
 * Validate entire filter set
 */
export function validateFilterSet(filterSet: FilterSet): string | null {
  if (filterSet.rules.length === 0) {
    return null // Empty is valid
  }

  if (filterSet.rules.length > MAX_RULES) {
    return `Maximum ${MAX_RULES} rules allowed`
  }

  for (let i = 0; i < filterSet.rules.length; i++) {
    const error = validateRule(filterSet.rules[i])
    if (error) {
      return `Rule ${i + 1}: ${error}`
    }
  }

  return null
}

/**
 * Check for conflicting rules (e.g., has AND has_not same store)
 */
export function detectConflicts(filterSet: FilterSet): string[] {
  const conflicts: string[] = []
  const rules = filterSet.rules

  for (let i = 0; i < rules.length; i++) {
    for (let j = i + 1; j < rules.length; j++) {
      const rule1 = rules[i]
      const rule2 = rules[j]

      // Check for direct conflicts: has vs has_not with same targets
      if (
        rule1.targetType === rule2.targetType &&
        ((rule1.operator === 'has' && rule2.operator === 'has_not') ||
          (rule1.operator === 'has_not' && rule2.operator === 'has'))
      ) {
        const overlap = rule1.targetIds.filter(id => rule2.targetIds.includes(id))
        if (overlap.length > 0) {
          conflicts.push(
            `Rules ${i + 1} and ${j + 1} conflict: can't both include and exclude the same ${rule1.targetType}`
          )
        }
      }
    }
  }

  return conflicts
}

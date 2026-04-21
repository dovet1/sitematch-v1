import { type FilterRule, isProximityOperator } from '@/types/filters'

/**
 * Generate natural language summary from filter rules
 * Used by both UI preview and CSV export to ensure consistency
 *
 * Example outputs:
 * - "Show locations that have Tesco OR Sainsbury's"
 * - "Show locations that have Tesco AND don't have Aldi AND have Starbucks within 5km"
 */
export function generateFilterSummary(
  rules: FilterRule[],
  targetNames: Record<string, string>
): string {
  if (rules.length === 0) {
    return ''
  }

  const parts: string[] = []

  for (let i = 0; i < rules.length; i++) {
    const rule = rules[i]
    const rulePart = generateRulePart(rule, targetNames)

    parts.push(rulePart)

    // Add connector to next rule (if not last)
    if (i < rules.length - 1 && rule.connector) {
      parts.push(rule.connector.toUpperCase())
    }
  }

  return `Show locations that ${parts.join(' ')}`
}

/**
 * Generate text for a single rule
 */
function generateRulePart(rule: FilterRule, targetNames: Record<string, string>): string {
  // Get human-readable names for targets
  const names = rule.targetIds
    .map(id => targetNames[id] || id)
    .filter(Boolean)

  if (names.length === 0) {
    return '...' // Placeholder for empty rule
  }

  // Format target list based on matching logic
  let targetText: string
  if (names.length === 1) {
    targetText = names[0]
  } else if (rule.matchingLogic === 'all') {
    // ALL logic: "Tesco AND Sainsbury's"
    if (names.length === 2) {
      targetText = `${names[0]} AND ${names[1]}`
    } else {
      targetText = `${names.slice(0, -1).join(', ')}, AND ${names[names.length - 1]}`
    }
  } else {
    // ANY logic (default): "Tesco OR Sainsbury's"
    if (names.length === 2) {
      targetText = `${names[0]} OR ${names[1]}`
    } else {
      targetText = `${names.slice(0, -1).join(', ')}, OR ${names[names.length - 1]}`
    }
  }

  // Add parentheses for multi-target rules
  if (names.length > 1) {
    targetText = `(${targetText})`
  }

  // Build rule text based on operator
  switch (rule.operator) {
    case 'has':
      return `have ${targetText}`

    case 'has_not':
      return `don't have ${targetText}`

    case 'has_within':
      return `have ${targetText} within ${formatDistance(rule.distance)}`

    case 'has_not_within':
      return `don't have ${targetText} within ${formatDistance(rule.distance)}`

    default:
      return targetText
  }
}

/**
 * Format distance in meters to human-readable form
 */
function formatDistance(distance: number | undefined): string {
  if (!distance) return '5km' // Default fallback

  if (distance >= 1000) {
    return `${distance / 1000}km`
  }
  return `${distance}m`
}

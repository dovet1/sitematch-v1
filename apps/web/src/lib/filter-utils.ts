/**
 * Filter Utilities for Store Pin Badge System
 *
 * Converts FilterSet to API parameters and generates badge mapping
 * for linking numbered badges between sidebar and map pins.
 */

import type { FilterSet, FilterOperator } from '@/types/filters'
import { getAllFasciaIdsInCategory, type CategoryNode } from './category-tree-utils'

export interface TargetWithMetadata {
  targetId: string           // UUID of fascia/category
  targetName: string         // Human-readable name
  badgeNumber: number        // Sequential number (1, 2, 3...)
  color: 'green' | 'red'     // Based on operator
  operator: FilterOperator   // Original operator for context
  ruleIndex: number          // Which rule it belongs to
  targetType: 'fascia' | 'category'  // Type of target
}

export interface ViewportParams {
  includeBrandIds: string[]
  includeCategories: string[]
  excludeBrandIds: string[]
  excludeCategories: string[]
  proximityIncludeBrandIds: string[]
  proximityIncludeCategories: string[]
  proximityExcludeBrandIds: string[]
  proximityExcludeCategories: string[]
}

/**
 * Converts FilterSet to viewport API parameters
 * Groups targets by operator type and target type for API consumption
 */
export function convertFilterSetToViewportParams(filterSet: FilterSet): ViewportParams {
  const params: ViewportParams = {
    includeBrandIds: [],
    includeCategories: [],
    excludeBrandIds: [],
    excludeCategories: [],
    proximityIncludeBrandIds: [],
    proximityIncludeCategories: [],
    proximityExcludeBrandIds: [],
    proximityExcludeCategories: []
  }

  filterSet.rules.forEach(rule => {
    const isFascia = rule.targetType === 'fascia'

    switch (rule.operator) {
      case 'has':
        if (isFascia) {
          params.includeBrandIds.push(...rule.targetIds)
        } else {
          params.includeCategories.push(...rule.targetIds)
        }
        break

      case 'has_not':
        if (isFascia) {
          params.excludeBrandIds.push(...rule.targetIds)
        } else {
          params.excludeCategories.push(...rule.targetIds)
        }
        break

      case 'has_within':
        if (isFascia) {
          params.proximityIncludeBrandIds.push(...rule.targetIds)
        } else {
          params.proximityIncludeCategories.push(...rule.targetIds)
        }
        break

      case 'has_not_within':
        if (isFascia) {
          params.proximityExcludeBrandIds.push(...rule.targetIds)
        } else {
          params.proximityExcludeCategories.push(...rule.targetIds)
        }
        break
    }
  })

  // Deduplicate all arrays
  return {
    includeBrandIds: Array.from(new Set(params.includeBrandIds)),
    includeCategories: Array.from(new Set(params.includeCategories)),
    excludeBrandIds: Array.from(new Set(params.excludeBrandIds)),
    excludeCategories: Array.from(new Set(params.excludeCategories)),
    proximityIncludeBrandIds: Array.from(new Set(params.proximityIncludeBrandIds)),
    proximityIncludeCategories: Array.from(new Set(params.proximityIncludeCategories)),
    proximityExcludeBrandIds: Array.from(new Set(params.proximityExcludeBrandIds)),
    proximityExcludeCategories: Array.from(new Set(params.proximityExcludeCategories))
  }
}

/**
 * Generates badge metadata for all targets across all rules
 * Assigns sequential badge numbers (1, 2, 3...) and determines colors
 */
export function generateTargetBadgeMapping(
  filterSet: FilterSet,
  targetNames: Record<string, string>
): TargetWithMetadata[] {
  const mapping: TargetWithMetadata[] = []
  let badgeNumber = 1

  filterSet.rules.forEach((rule, ruleIndex) => {
    // Determine color based on operator
    const color: 'green' | 'red' =
      (rule.operator === 'has' || rule.operator === 'has_within') ? 'green' : 'red'

    // Create badge metadata for each target in this rule
    rule.targetIds.forEach(targetId => {
      mapping.push({
        targetId,
        targetName: targetNames[targetId] || targetId,
        badgeNumber: badgeNumber++,
        color,
        operator: rule.operator,
        ruleIndex,
        targetType: rule.targetType
      })
    })
  })

  return mapping
}

/**
 * Helper to check if any filters are present that should show pins
 */
export function hasActiveFilters(params: ViewportParams): boolean {
  return (
    params.includeBrandIds.length > 0 ||
    params.includeCategories.length > 0 ||
    params.excludeBrandIds.length > 0 ||
    params.excludeCategories.length > 0 ||
    params.proximityIncludeBrandIds.length > 0 ||
    params.proximityIncludeCategories.length > 0 ||
    params.proximityExcludeBrandIds.length > 0 ||
    params.proximityExcludeCategories.length > 0
  )
}

/**
 * Expands category selections into individual fascia IDs for display
 * @param filterSet The filter set with rules
 * @param categoryTree The full category tree with fascias
 * @returns Expanded filter set with categories converted to fascias (deduplicated per rule)
 */
export function expandTargetsToFascias(
  filterSet: FilterSet,
  categoryTree: CategoryNode[]
): FilterSet {
  const expandedRules = filterSet.rules.map(rule => {
    if (rule.targetType === 'fascia') {
      // Already fascia-level, keep as-is
      return rule
    }

    // Expand category IDs to fascia IDs
    const fasciaIds = new Set<string>()

    rule.targetIds.forEach(categoryId => {
      const fasciasInCategory = getAllFasciaIdsInCategory(categoryId, categoryTree)
      fasciasInCategory.forEach(fasciaId => fasciaIds.add(fasciaId))
    })

    // Also include any existing fascia IDs in the rule
    rule.targetIds.forEach(id => {
      // If it's already a fascia ID (not a category), include it
      // This handles the edge case where rules might have mixed types
      if (rule.targetType === 'fascia') {
        fasciaIds.add(id)
      }
    })

    // Return new rule with expanded fascia IDs
    return {
      ...rule,
      targetType: 'fascia' as const,
      targetIds: Array.from(fasciaIds)
    }
  })

  return {
    ...filterSet,
    rules: expandedRules
  }
}

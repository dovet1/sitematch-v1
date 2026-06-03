'use client'

import { useState } from 'react'
import { Plus, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { FilterRule } from './FilterRule'
import { FilterPreview } from './FilterPreview'
import {
  type FilterSet,
  type FilterRule as FilterRuleType,
  createEmptyRule,
  validateRule,
  validateFilterSet,
  detectConflicts,
  MAX_RULES,
} from '@/types/filters'
import { cn } from '@/lib/utils'
import type { TargetWithMetadata } from '@/lib/filter-utils'
import type { CategoryNode } from '@/lib/category-tree-utils'

interface FilterBuilderProps {
  filterSet: FilterSet
  onChange: (filterSet: FilterSet) => void
  targetNames?: Record<string, string> // Map of targetId -> name for display
  targetBadgeMapping: TargetWithMetadata[] // Badge mapping for numbered pins
  companiesVisibility?: Record<string, boolean>
  categoriesVisibility?: Record<string, boolean>
  onCompaniesVisibilityChange?: (visibility: Record<string, boolean>) => void
  onCategoriesVisibilityChange?: (visibility: Record<string, boolean>) => void
  onCategoryTreeLoaded?: (tree: CategoryNode[]) => void
  hideHeader?: boolean // Hide the internal header when wrapped in external collapsible
}

/**
 * FilterBuilder - Main filter builder UI component
 *
 * Natural language filter builder using Option C pattern:
 * - Progressive disclosure (start simple, add complexity)
 * - Reads like English with natural operators
 * - Live preview shows query in plain English
 * - Max 10 rules enforced
 * - Premium glassmorphism design
 *
 * Example usage:
 * "Show BUAs that HAVE (Tesco OR Sainsbury's) AND DON'T HAVE Aldi"
 */
export function FilterBuilder({
  filterSet,
  onChange,
  targetNames = {},
  targetBadgeMapping,
  companiesVisibility,
  categoriesVisibility,
  onCompaniesVisibilityChange,
  onCategoriesVisibilityChange,
  onCategoryTreeLoaded,
  hideHeader = false,
}: FilterBuilderProps) {
  const [showValidation, setShowValidation] = useState(false)

  const addRule = () => {
    if (filterSet.rules.length >= MAX_RULES) {
      return // Max rules reached
    }

    const newRule = createEmptyRule()
    onChange({
      ...filterSet,
      rules: [...filterSet.rules, newRule],
    })
  }

  const updateRule = (index: number, updated: FilterRuleType) => {
    const newRules = [...filterSet.rules]
    newRules[index] = updated
    onChange({
      ...filterSet,
      rules: newRules,
    })
  }

  const removeRule = (index: number) => {
    onChange({
      ...filterSet,
      rules: filterSet.rules.filter((_, i) => i !== index),
    })
  }

  const clearAllRules = () => {
    onChange({
      ...filterSet,
      rules: [],
    })
    setShowValidation(false)
  }

  // Validate all rules
  const validationError = validateFilterSet(filterSet)
  const conflicts = detectConflicts(filterSet)
  const hasErrors = validationError !== null || conflicts.length > 0
  const nearMaxRules = filterSet.rules.length >= MAX_RULES - 1

  return (
    <div className="space-y-6">
      {/* Header - Conditionally rendered */}
      {!hideHeader && (
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-lg text-violet-900">
              Filter Criteria
            </h3>
            <p className="text-sm text-gray-600 mt-0.5">
              Show locations that match these conditions
            </p>
          </div>

          {filterSet.rules.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearAllRules}
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              Clear all
            </Button>
          )}
        </div>
      )}

      {/* Keep "Clear all" button accessible when header is hidden */}
      {hideHeader && filterSet.rules.length > 0 && (
        <div className="flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={clearAllRules}
            className="text-red-600 hover:text-red-700 hover:bg-red-50"
          >
            Clear all
          </Button>
        </div>
      )}

      {/* Natural Language Preview - Moved to top for better visibility */}
      {filterSet.rules.length > 0 && (
        <FilterPreview rules={filterSet.rules} targetNames={targetNames} />
      )}

      {/* Rules List */}
      {filterSet.rules.length === 0 ? (
        <div className="border-2 border-dashed border-sm-border rounded-sm-card p-8 text-center bg-sm-violet-tint-soft">
          <p className="text-sm text-sm-ink2 mb-4">
            No filters applied. Click below to add your first filter.
          </p>
          <Button onClick={addRule} variant="outline" className="border-sm-violet text-sm-violet hover:bg-sm-violet-tint-soft font-semibold">
            <Plus className="h-4 w-4 mr-2" />
            Add First Filter
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {filterSet.rules.map((rule, index) => (
            <FilterRule
              key={rule.id}
              rule={rule}
              onChange={(updated) => updateRule(index, updated)}
              onRemove={() => removeRule(index)}
              showConnector={index < filterSet.rules.length - 1}
              targetNames={targetNames}
              targetBadgeMapping={targetBadgeMapping.filter(t => t.ruleIndex === index)}
              companiesVisibility={companiesVisibility}
              categoriesVisibility={categoriesVisibility}
              onCompaniesVisibilityChange={onCompaniesVisibilityChange}
              onCategoriesVisibilityChange={onCategoriesVisibilityChange}
              onCategoryTreeLoaded={onCategoryTreeLoaded}
            />
          ))}
        </div>
      )}

      {/* Add Rule Button */}
      {filterSet.rules.length > 0 && filterSet.rules.length < MAX_RULES && (
        <Button
          onClick={addRule}
          variant="outline"
          className="w-full border-sm-violet text-sm-violet hover:bg-sm-violet-tint-soft transition-colors font-semibold"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Filter Rule
          <span className="ml-2 text-xs text-sm-ink3">
            ({filterSet.rules.length}/{MAX_RULES})
          </span>
        </Button>
      )}

      {/* Max rules warning */}
      {nearMaxRules && filterSet.rules.length < MAX_RULES && (
        <Alert className="border-amber-200 bg-amber-50">
          <AlertCircle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800 text-sm">
            You're approaching the maximum of {MAX_RULES} filter rules.
          </AlertDescription>
        </Alert>
      )}

      {/* Max rules reached */}
      {filterSet.rules.length >= MAX_RULES && (
        <Alert className="border-red-200 bg-red-50">
          <AlertCircle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800 text-sm">
            Maximum of {MAX_RULES} filter rules reached. Remove a rule to add more.
          </AlertDescription>
        </Alert>
      )}

      {/* Validation Errors */}
      {showValidation && hasErrors && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {validationError && <div>{validationError}</div>}
            {conflicts.length > 0 && (
              <div className="mt-2">
                <strong>Conflicts detected:</strong>
                <ul className="list-disc list-inside mt-1">
                  {conflicts.map((conflict, idx) => (
                    <li key={idx} className="text-sm">{conflict}</li>
                  ))}
                </ul>
              </div>
            )}
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}

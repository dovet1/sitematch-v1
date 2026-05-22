'use client'

import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { OperatorSelector } from './OperatorSelector'
import { InlineTargetSelector } from './InlineTargetSelector'
import {
  type FilterRule as FilterRuleType,
  isProximityOperator,
} from '@/types/filters'
import type { TargetWithMetadata } from '@/lib/filter-utils'
import type { CategoryNode } from '@/lib/category-tree-utils'

interface FilterRuleProps {
  rule: FilterRuleType
  onChange: (updated: FilterRuleType) => void
  onRemove: () => void
  showConnector: boolean
  targetNames?: Record<string, string>
  targetBadgeMapping: TargetWithMetadata[]
  companiesVisibility?: Record<string, boolean>
  categoriesVisibility?: Record<string, boolean>
  onCompaniesVisibilityChange?: (visibility: Record<string, boolean>) => void
  onCategoriesVisibilityChange?: (visibility: Record<string, boolean>) => void
  onCategoryTreeLoaded?: (tree: CategoryNode[]) => void
}

export function FilterRule({
  rule,
  onChange,
  onRemove,
  showConnector,
  targetNames = {},
  targetBadgeMapping,
  companiesVisibility,
  categoriesVisibility,
  onCompaniesVisibilityChange,
  onCategoriesVisibilityChange,
  onCategoryTreeLoaded,
}: FilterRuleProps) {
  const handleOperatorChange = (newOperator: string) => {
    const updated: FilterRuleType = {
      ...rule,
      operator: newOperator as FilterRuleType['operator'],
    }

    // Set default distance for proximity operators
    if (isProximityOperator(updated.operator) && !updated.distance) {
      updated.distance = 5000 // Default 5km
    }

    // Clear distance for non-proximity operators
    if (!isProximityOperator(updated.operator)) {
      delete updated.distance
    }

    onChange(updated)
  }

  const handleDistanceChange = (newDistance: number) => {
    onChange({
      ...rule,
      distance: newDistance,
    })
  }

  const handleTargetTypeChange = (newType: string) => {
    onChange({
      ...rule,
      targetType: newType as 'fascia' | 'category',
      targetIds: [], // Clear selections when switching type
    })
  }

  const handleTargetIdsChange = (newIds: string[], newType?: 'fascia' | 'category') => {
    onChange({
      ...rule,
      targetIds: newIds,
      ...(newType && { targetType: newType }),
    })
  }

  const handleConnectorChange = (newConnector: string) => {
    onChange({
      ...rule,
      connector: newConnector as 'and' | 'or',
    })
  }

  return (
    <div className="space-y-4">
      {/* Rule Card */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold text-gray-900">
              Filter Rule
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={onRemove}
              className="h-8 w-8 p-0 hover:bg-red-50 hover:text-red-600"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Operator Selector */}
          <OperatorSelector
            value={rule.operator}
            onChange={handleOperatorChange}
            distance={rule.distance}
            onDistanceChange={handleDistanceChange}
            matchingLogic={rule.matchingLogic}
            onMatchingLogicChange={(newLogic) => {
              onChange({
                ...rule,
                matchingLogic: newLogic,
              })
            }}
            targetCount={rule.targetIds.length}
          />

          {/* Target Selector */}
          <InlineTargetSelector
            targetType={rule.targetType}
            selectedIds={rule.targetIds}
            onTypeChange={handleTargetTypeChange}
            onSelectionChange={handleTargetIdsChange}
            targetNames={targetNames}
            targetBadgeMapping={targetBadgeMapping}
            companiesVisibility={companiesVisibility}
            categoriesVisibility={categoriesVisibility}
            onCompaniesVisibilityChange={onCompaniesVisibilityChange}
            onCategoriesVisibilityChange={onCategoriesVisibilityChange}
            onCategoryTreeLoaded={onCategoryTreeLoaded}
          />
        </CardContent>
      </Card>

      {/* Connector */}
      {showConnector && (
        <div className="flex items-center justify-center py-2">
          <Select
            value={rule.connector || 'and'}
            onValueChange={handleConnectorChange}
          >
            <SelectTrigger className="w-32 h-9 bg-white border-violet-300 text-sm font-medium">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="and">AND</SelectItem>
              <SelectItem value="or">OR</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  )
}

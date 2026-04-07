'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { EnhancedCompanySelector } from './EnhancedCompanySelector'
import {
  type FilterRule as FilterRuleType,
  OPERATOR_LABELS,
  isProximityOperator,
  DISTANCE_PRESETS,
} from '@/types/filters'
import { cn } from '@/lib/utils'

interface FilterRuleProps {
  rule: FilterRuleType
  onChange: (updated: FilterRuleType) => void
  onRemove: () => void
  showConnector: boolean
  targetNames?: Record<string, string> // Map of targetId -> name for display
}

/**
 * FilterRule - Individual filter rule row component
 *
 * Displays a single filter rule with:
 * - Operator selector (HAVE, DON'T HAVE, HAVE WITHIN, DON'T HAVE WITHIN)
 * - Distance selector (for proximity operators)
 * - Store/category chips with selector modal
 * - Matching logic (Any/All for OR/AND within same rule)
 * - Connector to next rule (AND/OR)
 * - Remove button
 */
export function FilterRule({
  rule,
  onChange,
  onRemove,
  showConnector,
  targetNames = {},
}: FilterRuleProps) {
  const [selectorOpen, setSelectorOpen] = useState(false)

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

  const handleDistanceChange = (newDistance: string) => {
    onChange({
      ...rule,
      distance: Number(newDistance),
    })
  }

  const handleTargetTypeChange = (newType: string) => {
    onChange({
      ...rule,
      targetType: newType as 'fascia' | 'category',
      targetIds: [], // Clear selections when switching type
    })
  }

  const handleMatchingLogicChange = (newLogic: string) => {
    onChange({
      ...rule,
      matchingLogic: newLogic as 'any' | 'all',
    })
  }

  const handleConnectorChange = (newConnector: string) => {
    onChange({
      ...rule,
      connector: newConnector as 'and' | 'or',
    })
  }

  const handleRemoveTarget = (targetId: string) => {
    onChange({
      ...rule,
      targetIds: rule.targetIds.filter((id) => id !== targetId),
    })
  }

  const handleCompaniesChange = (ids: string[]) => {
    onChange({
      ...rule,
      targetIds: ids,
    })
  }

  const handleCategoriesChange = (ids: string[]) => {
    onChange({
      ...rule,
      targetIds: ids,
    })
  }

  const selectedTargets = rule.targetIds.map((id) => ({
    id,
    name: targetNames[id] || id,
  }))

  return (
    <div className="space-y-3">
      {/* Main rule card with premium glassmorphism */}
      <div className="p-4 rounded-lg border border-violet-200/50 bg-white/70 backdrop-blur-sm shadow-sm hover:shadow-md transition-shadow duration-200">
        <div className="flex items-start gap-3">
          {/* Left section: Operator + Distance */}
          <div className="flex flex-col gap-2 min-w-[200px]">
            {/* Operator Dropdown */}
            <Select value={rule.operator} onValueChange={handleOperatorChange}>
              <SelectTrigger className="bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="has">{OPERATOR_LABELS.has}</SelectItem>
                <SelectItem value="has_not">{OPERATOR_LABELS.has_not}</SelectItem>
                <SelectItem value="has_within">{OPERATOR_LABELS.has_within}</SelectItem>
                <SelectItem value="has_not_within">{OPERATOR_LABELS.has_not_within}</SelectItem>
              </SelectContent>
            </Select>

            {/* Distance selector (only for proximity operators) */}
            {isProximityOperator(rule.operator) && (
              <Select
                value={rule.distance?.toString() || '5000'}
                onValueChange={handleDistanceChange}
              >
                <SelectTrigger className="bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DISTANCE_PRESETS.map((distance) => (
                    <SelectItem key={distance} value={distance.toString()}>
                      {distance >= 1000 ? `${distance / 1000} km` : `${distance} m`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Target type selector */}
            <Select value={rule.targetType} onValueChange={handleTargetTypeChange}>
              <SelectTrigger className="bg-white text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fascia">Stores</SelectItem>
                <SelectItem value="category">Categories</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Middle section: Selected targets */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap gap-2 mb-2">
              {selectedTargets.map((target) => (
                <Badge
                  key={target.id}
                  variant="secondary"
                  className="bg-violet-100 hover:bg-violet-200 text-violet-900 transition-colors max-w-[200px]"
                  title={target.name}
                >
                  <span className="truncate">{target.name}</span>
                  <button
                    onClick={() => handleRemoveTarget(target.id)}
                    className="ml-1.5 hover:text-violet-700 flex-shrink-0"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectorOpen(true)}
                className="h-6 text-xs"
              >
                + Add {rule.targetType === 'fascia' ? 'stores' : 'categories'}
              </Button>
            </div>

            {/* Matching logic (for multi-select within same rule) */}
            {selectedTargets.length > 1 && (
              <div className="flex items-center gap-3 text-xs text-gray-600">
                <Label className="text-xs">Match:</Label>
                <RadioGroup
                  value={rule.matchingLogic}
                  onValueChange={handleMatchingLogicChange}
                  className="flex items-center gap-3"
                >
                  <div className="flex items-center space-x-1.5">
                    <RadioGroupItem value="any" id={`${rule.id}-any`} />
                    <Label htmlFor={`${rule.id}-any`} className="text-xs cursor-pointer">
                      Any (OR)
                    </Label>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <RadioGroupItem value="all" id={`${rule.id}-all`} />
                    <Label htmlFor={`${rule.id}-all`} className="text-xs cursor-pointer">
                      All (AND)
                    </Label>
                  </div>
                </RadioGroup>
              </div>
            )}
          </div>

          {/* Right section: Remove button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={onRemove}
            className="h-8 w-8 hover:bg-red-50 hover:text-red-600 transition-colors flex-shrink-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Connector to next rule */}
      {showConnector && (
        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-violet-200 to-transparent" />
          <Select
            value={rule.connector || 'and'}
            onValueChange={handleConnectorChange}
          >
            <SelectTrigger className="w-24 h-8 text-xs bg-white border-violet-200">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="and">AND</SelectItem>
              <SelectItem value="or">OR</SelectItem>
            </SelectContent>
          </Select>
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-violet-200 to-transparent" />
        </div>
      )}

      {/* Enhanced Company Selector Modal */}
      {selectorOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
            <div className="p-4 border-b bg-gradient-to-r from-violet-50 to-purple-50">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-lg text-violet-900">
                  Select {rule.targetType === 'fascia' ? 'Stores' : 'Categories'}
                </h3>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSelectorOpen(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="p-4 overflow-y-auto max-h-[calc(80vh-8rem)]">
              <EnhancedCompanySelector
                selectedCompanies={rule.targetType === 'fascia' ? rule.targetIds : []}
                selectedCategories={rule.targetType === 'category' ? rule.targetIds : []}
                onCompaniesChange={handleCompaniesChange}
                onCategoriesChange={handleCategoriesChange}
                mode="include"
              />
            </div>

            <div className="p-4 border-t bg-gray-50 flex justify-end">
              <Button onClick={() => setSelectorOpen(false)}>
                Done
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

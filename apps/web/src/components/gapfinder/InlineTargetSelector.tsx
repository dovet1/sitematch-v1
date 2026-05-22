'use client'

import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { UnifiedCategorySelector } from './UnifiedCategorySelector'
import { getFasciaMarkerColor } from '@/lib/sitesketcher/colors'
import type { TargetWithMetadata } from '@/lib/filter-utils'
import type { CategoryNode } from '@/lib/category-tree-utils'

interface InlineTargetSelectorProps {
  targetType: 'fascia' | 'category'
  selectedIds: string[]
  onTypeChange: (type: 'fascia' | 'category') => void
  onSelectionChange: (ids: string[], type?: 'fascia' | 'category') => void
  targetNames: Record<string, string>
  targetBadgeMapping: TargetWithMetadata[]
  companiesVisibility?: Record<string, boolean>
  categoriesVisibility?: Record<string, boolean>
  onCompaniesVisibilityChange?: (visibility: Record<string, boolean>) => void
  onCategoriesVisibilityChange?: (visibility: Record<string, boolean>) => void
  onCategoryTreeLoaded?: (tree: CategoryNode[]) => void
}

export function InlineTargetSelector({
  targetType,
  selectedIds,
  onTypeChange,
  onSelectionChange,
  targetNames,
  targetBadgeMapping,
  companiesVisibility,
  categoriesVisibility,
  onCompaniesVisibilityChange,
  onCategoriesVisibilityChange,
  onCategoryTreeLoaded
}: InlineTargetSelectorProps) {
  // UnifiedCategorySelector shows both categories and fascias in a single tree
  const handleCompaniesChange = (ids: string[]) => {
    onSelectionChange(ids, 'fascia')
  }

  const handleCategoriesChange = (ids: string[]) => {
    onSelectionChange(ids, 'category')
  }

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium text-gray-700">
        Select brands or categories:
      </Label>

      <div className="border rounded-lg p-2 bg-gray-50">
        <UnifiedCategorySelector
          selectedCompanies={targetType === 'fascia' ? selectedIds : []}
          onCompaniesChange={handleCompaniesChange}
          selectedCategories={targetType === 'category' ? selectedIds : []}
          onCategoriesChange={handleCategoriesChange}
          mode="include"
          companiesVisibility={companiesVisibility}
          categoriesVisibility={categoriesVisibility}
          onCompaniesVisibilityChange={onCompaniesVisibilityChange}
          onCategoriesVisibilityChange={onCategoriesVisibilityChange}
          onCategoryTreeLoaded={onCategoryTreeLoaded}
        />
      </div>

      {/* Selection summary with numbered badges */}
      {targetBadgeMapping.length > 0 && (
        <div className="p-2 bg-violet-50 rounded-lg border border-violet-200">
          <div className="flex flex-wrap gap-1.5 max-h-[200px] overflow-y-auto">
            {targetBadgeMapping
              .filter(badge => {
                // Apply visibility filtering
                const isHidden = companiesVisibility?.[badge.targetId] === false ||
                                categoriesVisibility?.[badge.targetId] === false
                return !isHidden
              })
              .map(badge => (
                <div
                  key={badge.targetId}
                  className="flex items-center gap-1.5 bg-white rounded-full px-2.5 py-1 shadow-sm"
                >
                  <Badge
                    className="h-5 w-5 flex items-center justify-center rounded-full text-xs font-bold p-0 text-white"
                    style={{ backgroundColor: getFasciaMarkerColor(badge.targetId) }}
                  >
                    {badge.badgeNumber}
                  </Badge>
                  <span className="text-xs font-medium text-gray-700">
                    {badge.targetName}
                  </span>
                </div>
              ))
            }
          </div>
        </div>
      )}
    </div>
  )
}

'use client'

import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { EnhancedCompanySelector } from './EnhancedCompanySelector'
import type { TargetWithMetadata } from '@/lib/filter-utils'

interface InlineTargetSelectorProps {
  targetType: 'fascia' | 'category'
  selectedIds: string[]
  onTypeChange: (type: 'fascia' | 'category') => void
  onSelectionChange: (ids: string[]) => void
  targetNames: Record<string, string>
  targetBadgeMapping: TargetWithMetadata[]
}

export function InlineTargetSelector({
  targetType,
  selectedIds,
  onTypeChange,
  onSelectionChange,
  targetNames,
  targetBadgeMapping
}: InlineTargetSelectorProps) {
  // EnhancedCompanySelector has its own tabs, so we just need to pass the correct selections
  const handleCompaniesChange = (ids: string[]) => {
    onTypeChange('fascia')
    onSelectionChange(ids)
  }

  const handleCategoriesChange = (ids: string[]) => {
    onTypeChange('category')
    onSelectionChange(ids)
  }

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium text-gray-700">
        Select stores or categories:
      </Label>

      <div className="border rounded-lg p-2 max-h-[280px] overflow-y-auto bg-gray-50">
        <EnhancedCompanySelector
          selectedCompanies={targetType === 'fascia' ? selectedIds : []}
          onCompaniesChange={handleCompaniesChange}
          selectedCategories={targetType === 'category' ? selectedIds : []}
          onCategoriesChange={handleCategoriesChange}
          mode="include"
        />
      </div>

      {/* Selection summary with numbered badges */}
      {selectedIds.length > 0 && (
        <div className="p-2 bg-violet-50 rounded-lg border border-violet-200">
          <div className="flex flex-wrap gap-1.5">
            {selectedIds.map(id => {
              const badge = targetBadgeMapping.find(b => b.targetId === id)
              return (
                <div
                  key={id}
                  className="flex items-center gap-1.5 bg-white rounded-full px-2.5 py-1 shadow-sm"
                >
                  <Badge
                    className={`h-5 w-5 flex items-center justify-center rounded-full text-xs font-bold p-0 ${
                      badge?.color === 'green'
                        ? 'bg-emerald-500 text-white'
                        : 'bg-red-500 text-white'
                    }`}
                  >
                    {badge?.badgeNumber || '?'}
                  </Badge>
                  <span className="text-xs font-medium text-gray-700">
                    {targetNames[id] || id}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

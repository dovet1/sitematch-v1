'use client'

import { Label } from '@/components/ui/label'
import { EnhancedCompanySelector } from './EnhancedCompanySelector'

interface InlineTargetSelectorProps {
  targetType: 'fascia' | 'category'
  selectedIds: string[]
  onTypeChange: (type: 'fascia' | 'category') => void
  onSelectionChange: (ids: string[]) => void
  targetNames: Record<string, string>
}

export function InlineTargetSelector({
  targetType,
  selectedIds,
  onTypeChange,
  onSelectionChange,
  targetNames
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

      {/* Selection summary */}
      {selectedIds.length > 0 && (
        <div className="p-2 bg-violet-50 rounded-lg border border-violet-200">
          <div className="flex items-center gap-2 text-xs text-violet-900">
            <span className="font-medium">✓ Selected:</span>
            <span className="font-normal">
              {selectedIds.slice(0, 3).map(id => targetNames[id] || id).join(', ')}
              {selectedIds.length > 3 && ` +${selectedIds.length - 3} more`}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

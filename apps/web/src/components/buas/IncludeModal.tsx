'use client'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { EnhancedCompanySelector } from './EnhancedCompanySelector'

interface IncludeModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  includeCompanies: string[]  // Fascia IDs
  includeCategories: number[]
  onIncludeCompaniesChange: (ids: string[]) => void
  onIncludeCategoriesChange: (ids: number[]) => void
}

export function IncludeModal({
  open,
  onOpenChange,
  includeCompanies,
  includeCategories,
  onIncludeCompaniesChange,
  onIncludeCategoriesChange,
}: IncludeModalProps) {
  const handleClearAll = () => {
    onIncludeCompaniesChange([])
    onIncludeCategoriesChange([])
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Include Filters</DialogTitle>
          <DialogDescription>
            Only show BUAs that have at least one of the selected stores or categories
          </DialogDescription>
        </DialogHeader>

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto px-1">
          <EnhancedCompanySelector
            selectedCompanies={includeCompanies}
            selectedCategories={includeCategories}
            onCompaniesChange={onIncludeCompaniesChange}
            onCategoriesChange={onIncludeCategoriesChange}
            mode="include"
          />
        </div>

        {/* Footer Actions */}
        <div className="flex justify-between border-t pt-4 mt-4">
          <Button variant="outline" onClick={handleClearAll}>
            Clear All
          </Button>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={() => onOpenChange(false)}>
              Apply
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

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

interface ExcludeModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  excludeCompanies: string[]  // Fascia IDs
  excludeCategories: number[]
  onExcludeCompaniesChange: (ids: string[]) => void
  onExcludeCategoriesChange: (ids: number[]) => void
}

export function ExcludeModal({
  open,
  onOpenChange,
  excludeCompanies,
  excludeCategories,
  onExcludeCompaniesChange,
  onExcludeCategoriesChange,
}: ExcludeModalProps) {
  const handleClearAll = () => {
    onExcludeCompaniesChange([])
    onExcludeCategoriesChange([])
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Exclude Filters</DialogTitle>
          <DialogDescription>
            Hide BUAs that have any of the selected stores or categories
          </DialogDescription>
        </DialogHeader>

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto px-1">
          <EnhancedCompanySelector
            selectedCompanies={excludeCompanies}
            selectedCategories={excludeCategories}
            onCompaniesChange={onExcludeCompaniesChange}
            onCategoriesChange={onExcludeCategoriesChange}
            mode="exclude"
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

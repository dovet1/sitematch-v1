'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Plus, X } from 'lucide-react'
import { EnhancedCompanySelector } from './EnhancedCompanySelector'

export interface ProximityRule {
  distance: number  // in meters: 1000, 3000, 5000, 10000
  brandIds?: string[]  // Fascia UUIDs
  categoryIds?: string[]  // Category UUIDs
}

interface ProximityModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  proximityExclude: ProximityRule[]
  onProximityExcludeChange: (rules: ProximityRule[]) => void
}

export function ProximityModal({
  open,
  onOpenChange,
  proximityExclude,
  onProximityExcludeChange,
}: ProximityModalProps) {
  const [localProximityRules, setLocalProximityRules] = useState<ProximityRule[]>(proximityExclude)

  const handleClearAll = () => {
    setLocalProximityRules([])
    onProximityExcludeChange([])
  }

  const handleApply = () => {
    onProximityExcludeChange(localProximityRules)
    onOpenChange(false)
  }

  const addProximityRule = () => {
    setLocalProximityRules([
      ...localProximityRules,
      { distance: 5000, brandIds: [], categoryIds: [] }
    ])
  }

  const removeProximityRule = (index: number) => {
    setLocalProximityRules(localProximityRules.filter((_, i) => i !== index))
  }

  const updateRuleDistance = (index: number, distance: number) => {
    const newRules = [...localProximityRules]
    newRules[index] = { ...newRules[index], distance }
    setLocalProximityRules(newRules)
  }

  const updateRuleCompanies = (index: number, brandIds: string[]) => {
    const newRules = [...localProximityRules]
    newRules[index] = { ...newRules[index], brandIds }
    setLocalProximityRules(newRules)
  }

  const updateRuleCategories = (index: number, categoryIds: string[]) => {
    const newRules = [...localProximityRules]
    newRules[index] = { ...newRules[index], categoryIds }
    setLocalProximityRules(newRules)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Proximity Exclusion</DialogTitle>
          <DialogDescription>
            Exclude BUAs that have selected stores within a specified distance
          </DialogDescription>
        </DialogHeader>

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto px-1">
          <div className="space-y-4">
            {/* List of proximity rules */}
            {localProximityRules.length === 0 ? (
              <div className="text-sm text-gray-500 text-center py-8 border-2 border-dashed border-gray-200 rounded-lg">
                No proximity exclusion rules set. Click below to add one.
              </div>
            ) : (
              <div className="space-y-4">
                {localProximityRules.map((rule, index) => (
                  <div key={index} className="border rounded-lg p-4 space-y-3 bg-gray-50">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm">Rule {index + 1}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeProximityRule(index)}
                        className="h-7 w-7 p-0"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>

                    {/* Distance selector */}
                    <div className="space-y-2">
                      <Label className="text-sm">Exclude if stores within:</Label>
                      <Select
                        value={rule.distance.toString()}
                        onValueChange={(val) => updateRuleDistance(index, Number(val))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1000">1 km</SelectItem>
                          <SelectItem value="3000">3 km</SelectItem>
                          <SelectItem value="5000">5 km</SelectItem>
                          <SelectItem value="10000">10 km</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Company/Category selector for this rule */}
                    <div className="space-y-2">
                      <Label className="text-sm">Select stores to check proximity for:</Label>
                      <EnhancedCompanySelector
                        selectedCompanies={rule.brandIds || []}
                        selectedCategories={rule.categoryIds || []}
                        onCompaniesChange={(ids) => updateRuleCompanies(index, ids)}
                        onCategoriesChange={(ids) => updateRuleCategories(index, ids)}
                        mode="proximity"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Add rule button */}
            <Button
              variant="outline"
              onClick={addProximityRule}
              className="w-full"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Proximity Rule
            </Button>
          </div>
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
            <Button onClick={handleApply}>
              Apply
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

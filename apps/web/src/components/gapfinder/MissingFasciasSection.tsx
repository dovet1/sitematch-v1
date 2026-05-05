'use client'

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Badge } from '@/components/ui/badge'
import { ChevronDown, CircleSlash, Loader2, AlertCircle, CheckCircle } from 'lucide-react'
import type { MissingFasciaInfo } from '@/lib/stores'
import { useState } from 'react'

interface MissingFasciasSectionProps {
  missingFascias: MissingFasciaInfo[]
  isLoading: boolean
  error: string | null
}

export function MissingFasciasSection({
  missingFascias,
  isLoading,
  error
}: MissingFasciasSectionProps) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="w-full group">
        <div className="flex items-center justify-between px-4 py-3 hover:bg-gradient-to-r hover:from-violet-50/50 hover:to-purple-50/30 transition-colors rounded-lg">
          <div className="flex items-center gap-2">
            <ChevronDown
              className={`h-4 w-4 text-gray-500 transition-transform ${
                isOpen ? '' : '-rotate-90'
              }`}
            />
            <span className="font-medium text-sm">Missing Brands</span>
            <Badge variant="secondary" className="text-xs">
              {isLoading ? '...' : missingFascias.length}
            </Badge>
          </div>
        </div>
      </CollapsibleTrigger>

      <CollapsibleContent className="px-4 pb-4 pt-2">
        {isLoading ? (
          <div className="flex items-center justify-center py-8 text-gray-500">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            <span className="text-sm">Loading missing fascias...</span>
          </div>
        ) : error ? (
          <div className="flex items-center gap-2 p-4 rounded-lg bg-red-50 border border-red-200">
            <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
            <span className="text-sm text-red-900">{error}</span>
          </div>
        ) : missingFascias.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 px-4 rounded-lg bg-emerald-50 border border-emerald-200">
            <CheckCircle className="h-8 w-8 text-emerald-600 mb-2" />
            <p className="text-sm font-medium text-emerald-900">
              All selected fascias are present
            </p>
            <p className="text-xs text-emerald-700 mt-1 text-center">
              Every fascia in your filter appears in this area
            </p>
          </div>
        ) : (
          <div className="space-y-2 divide-y divide-gray-50">
            {missingFascias.map((fascia) => (
              <div
                key={fascia.fasciaId}
                className="pt-2 first:pt-0 pb-2 hover:bg-gray-50/50 rounded-lg px-2 -mx-2 transition-colors"
              >
                <div className="flex items-start gap-2">
                  <CircleSlash className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm text-gray-900 truncate">
                      {fascia.fasciaName}
                    </div>
                    <div className="text-xs text-gray-600 mt-0.5">
                      Brand: {fascia.brandName}
                    </div>
                    {fascia.categoryName && (
                      <div className="text-xs text-gray-500 mt-0.5">
                        Category: {fascia.categoryName}
                      </div>
                    )}
                    {fascia.nearestStoreDistance && (
                      <div className="text-xs text-gray-500 mt-1">
                        Nearest: {(fascia.nearestStoreDistance / 1000).toFixed(1)}km away
                        {fascia.nearestStoreTown && ` in ${fascia.nearestStoreTown}`}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  )
}

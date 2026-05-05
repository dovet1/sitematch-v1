'use client'

import { useState, useMemo } from 'react'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { ChevronDown, ChevronRight, CircleSlash } from 'lucide-react'
import type { MissingFasciaInfo } from '@/lib/stores'
import { buildMissingFasciasTree, type MissingFasciaCategoryNode, type MissingFasciaBrandNode } from '@/lib/missing-fascia-tree-utils'

interface MissingFasciaTreeProps {
  missingFascias: MissingFasciaInfo[]
}

export function MissingFasciaTree({ missingFascias }: MissingFasciaTreeProps) {
  // Expansion state - categories keyed by categoryId, brands by composite key
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())
  const [expandedBrands, setExpandedBrands] = useState<Set<string>>(new Set())

  // Build tree from flat data
  const tree = useMemo(() => buildMissingFasciasTree(missingFascias), [missingFascias])

  const toggleCategoryExpansion = (categoryId: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev)
      if (next.has(categoryId)) {
        next.delete(categoryId)
      } else {
        next.add(categoryId)
      }
      return next
    })
  }

  const toggleBrandExpansion = (compositeKey: string) => {
    setExpandedBrands(prev => {
      const next = new Set(prev)
      if (next.has(compositeKey)) {
        next.delete(compositeKey)
      } else {
        next.add(compositeKey)
      }
      return next
    })
  }

  const renderCategoryNode = (node: MissingFasciaCategoryNode) => {
    const isCategoryExpanded = expandedCategories.has(node.categoryId)
    const hasBrands = node.brands.length > 0

    return (
      <div key={node.categoryId}>
        <Collapsible
          open={isCategoryExpanded}
          onOpenChange={() => toggleCategoryExpansion(node.categoryId)}
        >
          <div className="flex items-center hover:bg-gray-50 p-2 rounded-md transition-all duration-150">
            <CollapsibleTrigger className="flex-1 flex items-start justify-between cursor-pointer gap-2 text-left">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                {hasBrands && (
                  <div className="flex-shrink-0">
                    {isCategoryExpanded ? (
                      <ChevronDown className="h-4 w-4 text-gray-500 transition-transform duration-150" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-gray-500 transition-transform duration-150" />
                    )}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-gray-900">
                    {node.categoryName}
                  </span>
                  <span className="text-xs text-gray-500 ml-1.5">
                    ({node.brands.length} {node.brands.length === 1 ? 'brand' : 'brands'})
                  </span>
                </div>
              </div>
            </CollapsibleTrigger>
          </div>

          <CollapsibleContent>
            {hasBrands && (
              <div className="ml-8 space-y-1 mt-1">
                {node.brands.map((brandNode) => renderBrandNode(node, brandNode))}
              </div>
            )}
          </CollapsibleContent>
        </Collapsible>
      </div>
    )
  }

  const renderBrandNode = (categoryNode: MissingFasciaCategoryNode, brandNode: MissingFasciaBrandNode) => {
    // Use composite key to isolate expansion per category
    const compositeKey = `${categoryNode.categoryId}:${brandNode.brandId}`
    const isBrandExpanded = expandedBrands.has(compositeKey)
    const hasFascias = brandNode.fascias.length > 0

    return (
      <Collapsible
        key={compositeKey}
        open={isBrandExpanded}
        onOpenChange={() => toggleBrandExpansion(compositeKey)}
      >
        <div className="flex items-center hover:bg-gray-50 p-2 rounded-md transition-all duration-150">
          <CollapsibleTrigger className="flex-1 flex items-start justify-between cursor-pointer gap-2 text-left">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              {hasFascias && (
                <div className="flex-shrink-0">
                  {isBrandExpanded ? (
                    <ChevronDown className="h-4 w-4 text-gray-500 transition-transform duration-150" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-gray-500 transition-transform duration-150" />
                  )}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium text-gray-900">
                  {brandNode.brandName}
                </span>
                <span className="text-xs text-gray-500 ml-1.5">
                  ({brandNode.fascias.length} {brandNode.fascias.length === 1 ? 'type' : 'types'})
                </span>
              </div>
            </div>
          </CollapsibleTrigger>
        </div>

        <CollapsibleContent>
          {hasFascias && (
            <div className="ml-8 space-y-1 mt-1">
              {brandNode.fascias.map((fascia) => (
                <div
                  key={fascia.fasciaId}
                  className="py-2 hover:bg-gray-50/50 rounded-lg px-2 -mx-2 transition-colors"
                >
                  <div className="flex items-start gap-2">
                    <CircleSlash className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm text-gray-900 truncate">
                        {fascia.fasciaName}
                      </div>
                      {fascia.nearestStoreDistance != null && (
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

  return (
    <div className="space-y-2">
      {tree.map((node) => renderCategoryNode(node))}
    </div>
  )
}

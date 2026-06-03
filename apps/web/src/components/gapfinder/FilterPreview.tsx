'use client'

import { FileText } from 'lucide-react'
import { type FilterRule } from '@/types/filters'
import { generateFilterSummary } from '@/lib/buas/generate-filter-summary'

interface FilterPreviewProps {
  rules: FilterRule[]
  targetNames?: Record<string, string> // Map of targetId -> name for display
}

/**
 * FilterPreview - Converts filter rules to natural language
 * Uses shared helper to ensure consistency with CSV export
 *
 * Example outputs:
 * - "Show locations that have Tesco OR Sainsbury's"
 * - "Show locations that have Tesco AND don't have Aldi AND have Starbucks within 5km"
 */
export function FilterPreview({ rules, targetNames = {} }: FilterPreviewProps) {
  if (rules.length === 0) {
    return null
  }

  const preview = generateFilterSummary(rules, targetNames)

  return (
    <div className="p-4 bg-sm-violet-tint border border-sm-border rounded-sm-card shadow-sm">
      <div className="flex items-start gap-3">
        <FileText className="h-5 w-5 text-sm-violet mt-0.5 flex-shrink-0" />
        <div className="text-sm">
          <div className="font-semibold text-sm-ink mb-1">Your Filters in Plain English:</div>
          <div className="text-sm-ink2 leading-relaxed">{preview}</div>
        </div>
      </div>
    </div>
  )
}

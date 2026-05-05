'use client'

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CheckCircle, Download } from 'lucide-react'
import type { ComparisonData, MissingFasciaInfo } from '@/lib/stores'
import { MissingFasciaTree } from './MissingFasciaTree'

interface ComparisonModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  comparisonData: ComparisonData
}

export function ComparisonModal({
  open,
  onOpenChange,
  comparisonData
}: ComparisonModalProps) {
  const handleExportCSV = (data: MissingFasciaInfo[], filename: string) => {
    if (data.length === 0) return

    const headers = ['Fascia Name', 'Brand Name', 'Category', 'Nearest Store Distance (km)', 'Nearest Store Name', 'Nearest Store Town']
    const rows = data.map(f => [
      f.fasciaName,
      f.brandName,
      f.categoryName || '',
      f.nearestStoreDistance ? (f.nearestStoreDistance / 1000).toFixed(2) : '',
      f.nearestStoreName || '',
      f.nearestStoreTown || ''
    ])

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n')

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = filename
    link.click()
    URL.revokeObjectURL(link.href)
  }

  const renderComparisonContent = (
    fascias: MissingFasciaInfo[],
    emptyTitle: string,
    emptyDescription: string,
  ) => {
    if (fascias.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-10 text-center">
          <CheckCircle className="h-9 w-9 text-emerald-600 mb-3" />
          <p className="text-sm font-semibold text-emerald-950">{emptyTitle}</p>
          <p className="text-xs text-emerald-700 mt-1 max-w-sm">{emptyDescription}</p>
        </div>
      )
    }

    return (
      <MissingFasciaTree
        missingFascias={fascias}
        density="modal"
        defaultExpanded="categories"
        showControls
      />
    )
  }

  const summaryItems = [
    {
      label: 'Only missing from Area A',
      count: comparisonData.missingInAOnly.length,
      accent: 'border-violet-200 bg-violet-50 text-violet-800',
    },
    {
      label: 'Only missing from Area B',
      count: comparisonData.missingInBOnly.length,
      accent: 'border-teal-200 bg-teal-50 text-teal-800',
    },
    {
      label: 'Missing from both',
      count: comparisonData.missingInBoth.length,
      accent: 'border-gray-200 bg-gray-50 text-gray-800',
    },
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[84vh] flex flex-col gap-5 border-violet-100 p-0 overflow-hidden">
        <DialogHeader className="border-b border-violet-100 bg-gradient-to-r from-violet-50/80 to-purple-50/50 px-6 pb-5 pt-6 pr-12">
          <DialogTitle className="flex flex-wrap items-center gap-3 text-gray-950">
            Area Comparison
            <div className="flex items-center gap-2 text-sm font-normal">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-200 bg-white/80 px-2.5 py-1 text-xs font-medium text-violet-800">
                <span className="h-2 w-2 rounded-full bg-violet-500" />
                Area A
              </span>
              <span className="text-xs text-gray-400">vs</span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-teal-200 bg-white/80 px-2.5 py-1 text-xs font-medium text-teal-800">
                <span className="h-2 w-2 rounded-full bg-teal-500" />
                Area B
              </span>
            </div>
          </DialogTitle>
          <DialogDescription>
            Compare selected brands by category, brand, and type to see which opportunities are unique to each area.
          </DialogDescription>
        </DialogHeader>

        <div className="px-6">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {summaryItems.map((item) => (
              <div key={item.label} className={`rounded-lg border px-4 py-3 ${item.accent}`}>
                <div className="text-2xl font-semibold leading-none">{item.count}</div>
                <div className="mt-1 text-xs font-medium">{item.label}</div>
              </div>
            ))}
          </div>
        </div>

        <Tabs defaultValue="missing-a" className="flex-1 flex flex-col min-h-0 px-6 pb-6">
          <TabsList className="grid h-auto w-full grid-cols-3 bg-gray-100 p-1">
            <TabsTrigger value="missing-a" className="flex-col gap-1 whitespace-normal px-2 py-2 text-xs leading-tight sm:flex-row sm:text-sm">
              Only missing from A
              <Badge variant="secondary" className="text-xs">
                {comparisonData.missingInAOnly.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="missing-b" className="flex-col gap-1 whitespace-normal px-2 py-2 text-xs leading-tight sm:flex-row sm:text-sm">
              Only missing from B
              <Badge variant="secondary" className="text-xs">
                {comparisonData.missingInBOnly.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="missing-both" className="flex-col gap-1 whitespace-normal px-2 py-2 text-xs leading-tight sm:flex-row sm:text-sm">
              Missing from both
              <Badge variant="secondary" className="text-xs">
                {comparisonData.missingInBoth.length}
              </Badge>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="missing-a" className="flex-1 overflow-y-auto py-5 min-h-0">
            <div className="mb-4 flex items-start justify-between gap-4">
              <p className="text-sm text-gray-600">
                Brands available in Area B but absent from Area A.
              </p>
              {comparisonData.missingInAOnly.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleExportCSV(comparisonData.missingInAOnly, 'missing-in-area-a.csv')}
                >
                  <Download className="h-4 w-4 mr-1" />
                  Export
                </Button>
              )}
            </div>
            {renderComparisonContent(
              comparisonData.missingInAOnly,
              'Area A is not missing any brands Area B has',
              'For the selected filter set, Area A matches the brands present in Area B.'
            )}
          </TabsContent>

          <TabsContent value="missing-b" className="flex-1 overflow-y-auto py-5 min-h-0">
            <div className="mb-4 flex items-start justify-between gap-4">
              <p className="text-sm text-gray-600">
                Brands available in Area A but absent from Area B.
              </p>
              {comparisonData.missingInBOnly.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleExportCSV(comparisonData.missingInBOnly, 'missing-in-area-b.csv')}
                >
                  <Download className="h-4 w-4 mr-1" />
                  Export
                </Button>
              )}
            </div>
            {renderComparisonContent(
              comparisonData.missingInBOnly,
              'Area B is not missing any brands Area A has',
              'For the selected filter set, Area B matches the brands present in Area A.'
            )}
          </TabsContent>

          <TabsContent value="missing-both" className="flex-1 overflow-y-auto py-5 min-h-0">
            <div className="mb-4 flex items-start justify-between gap-4">
              <p className="text-sm text-gray-600">
                Selected brands that are absent from both areas.
              </p>
              {comparisonData.missingInBoth.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleExportCSV(comparisonData.missingInBoth, 'missing-in-both-areas.csv')}
                >
                  <Download className="h-4 w-4 mr-1" />
                  Export
                </Button>
              )}
            </div>
            {renderComparisonContent(
              comparisonData.missingInBoth,
              'Both areas contain all selected brands',
              'There are no shared gaps for the current comparison.'
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}

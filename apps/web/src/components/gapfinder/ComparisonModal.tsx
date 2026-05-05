'use client'

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CircleSlash, Download } from 'lucide-react'
import type { ComparisonData } from '@/lib/stores'

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
  const handleExportCSV = (data: typeof comparisonData.missingInAOnly, filename: string) => {
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
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n')

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = filename
    link.click()
    URL.revokeObjectURL(link.href)
  }

  const renderFasciaList = (fascias: typeof comparisonData.missingInAOnly) => {
    if (fascias.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-12 px-4 text-gray-500">
          <CircleSlash className="h-12 w-12 mb-3 opacity-30" />
          <p className="text-sm font-medium">No missing fascias in this category</p>
        </div>
      )
    }

    return (
      <div className="space-y-2 divide-y divide-gray-50">
        {fascias.map((fascia) => (
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
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="bg-gradient-to-r from-violet-100 to-purple-100 bg-clip-text text-transparent">
              Area Comparison
            </span>
            <div className="flex items-center gap-2 text-sm font-normal">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-violet-500"></span>
                <span className="text-gray-600">Area A</span>
              </span>
              <span className="text-gray-400">vs</span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-teal-500"></span>
                <span className="text-gray-600">Area B</span>
              </span>
            </div>
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="missing-a" className="flex-1 flex flex-col min-h-0">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="missing-a" className="text-xs sm:text-sm">
              Missing in A
              <Badge variant="secondary" className="ml-2 text-xs">
                {comparisonData.missingInAOnly.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="missing-b" className="text-xs sm:text-sm">
              Missing in B
              <Badge variant="secondary" className="ml-2 text-xs">
                {comparisonData.missingInBOnly.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="missing-both" className="text-xs sm:text-sm">
              Missing in Both
              <Badge variant="secondary" className="ml-2 text-xs">
                {comparisonData.missingInBoth.length}
              </Badge>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="missing-a" className="flex-1 overflow-y-auto px-4 py-6 min-h-0">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-gray-600">
                Fascias present in Area B but missing in Area A
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
            {renderFasciaList(comparisonData.missingInAOnly)}
          </TabsContent>

          <TabsContent value="missing-b" className="flex-1 overflow-y-auto px-4 py-6 min-h-0">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-gray-600">
                Fascias present in Area A but missing in Area B
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
            {renderFasciaList(comparisonData.missingInBOnly)}
          </TabsContent>

          <TabsContent value="missing-both" className="flex-1 overflow-y-auto px-4 py-6 min-h-0">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-gray-600">
                Fascias missing in both areas
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
            {renderFasciaList(comparisonData.missingInBoth)}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}

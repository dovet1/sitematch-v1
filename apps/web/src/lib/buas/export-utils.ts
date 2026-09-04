import type { FilterSet } from '@/types/filters'

/**
 * Export matching BUAs to CSV file
 * Triggers browser download of CSV from the export API endpoint
 *
 * @param filters Filter configuration (minPop, maxPop, filterSet)
 * @param targetNames Map of target IDs to names for filter summary
 * @throws Error if export fails
 */
export async function exportBUAsToCSV(
  filters: {
    geography?: 'town' | 'retail_centre'
    minPop?: number
    maxPop?: number
    filterSet: FilterSet
    retailForms?: string[]
    retailClassifications?: string[]
  },
  targetNames: Record<string, string>
): Promise<void> {
  const response = await fetch('/api/public/gaps/export', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ...filters,
      targetNames,
    }),
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Export failed' }))
    console.error('Export API error:', {
      status: response.status,
      statusText: response.statusText,
      error: errorData
    })
    throw new Error(errorData.error || 'Export failed')
  }

  // Get the blob and trigger download
  const blob = await response.blob()
  const url = URL.createObjectURL(blob)

  // Create temporary link and click it
  const link = document.createElement('a')
  link.href = url
  link.download = '' // Filename is set by Content-Disposition header
  document.body.appendChild(link)
  link.click()

  // Cleanup
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

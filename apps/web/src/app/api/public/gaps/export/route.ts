import { NextRequest, NextResponse } from 'next/server'
import { createStoreService } from '@/lib/stores-service'
import { createServerClient } from '@/lib/supabase'
import { generateFilterSummary } from '@/lib/buas/generate-filter-summary'
import type { FilterSet } from '@/types/filters'

export const dynamic = 'force-dynamic'

/**
 * Export all matching BUAs to CSV
 *
 * Request body (JSON) - Same format as /api/public/gaps/find:
 * {
 *   minPop: number,
 *   maxPop: number,
 *   filterSet?: FilterSet,
 *   targetNames?: Record<string, string>  // For generating filter summary
 * }
 *
 * Returns:
 * - CSV file with Content-Disposition header for download
 * - Includes metadata rows (export date, population range, filters)
 * - Includes ALL matching BUAs (not limited to 1,000)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { minPop, maxPop, filterSet, targetNames = {} } = body

    // Validate required fields
    if (typeof minPop !== 'number' || typeof maxPop !== 'number') {
      return NextResponse.json(
        { error: 'minPop and maxPop are required' },
        { status: 400 }
      )
    }

    // Get all matching gsscodes
    const service = await createStoreService()
    const { gsscodes } = await service.getFilteredGssCodes({
      minPop,
      maxPop,
      filterSet
    })

    console.log(`[CSV Export] Fetching ${gsscodes.length} matching BUAs`)

    // Fetch full BUA details for all matching gsscodes
    const supabase = await createServerClient()

    let buas: Array<{ name: string; pop_final: number | null }> = []

    // Only query if we have gsscodes (avoid empty .in() which causes error)
    if (gsscodes.length > 0) {
      // Batch queries if we have many gsscodes (PostgreSQL has limits on IN clause size)
      const BATCH_SIZE = 1000
      const batches: string[][] = []

      for (let i = 0; i < gsscodes.length; i += BATCH_SIZE) {
        batches.push(gsscodes.slice(i, i + BATCH_SIZE))
      }

      console.log(`[CSV Export] Fetching in ${batches.length} batches`)

      // Fetch all batches in parallel
      const batchPromises = batches.map(batch =>
        supabase
          .from('built_up_areas')
          .select('name, pop_final')
          .in('gsscode', batch)
      )

      const results = await Promise.all(batchPromises)

      // Check for errors in any batch
      for (const result of results) {
        if (result.error) {
          console.error('Failed to fetch BUA details for export:', result.error)
          return NextResponse.json(
            { error: `Failed to fetch BUA data: ${result.error.message || 'Unknown error'}` },
            { status: 500 }
          )
        }
      }

      // Combine all results
      buas = results.flatMap(result => result.data || [])

      // Sort by population descending
      buas.sort((a, b) => {
        const popA = a.pop_final ?? 0
        const popB = b.pop_final ?? 0
        return popB - popA
      })

      console.log(`[CSV Export] Successfully fetched ${buas.length} BUAs`)
    }

    // Generate CSV content
    const csv = generateCSV(buas, {
      minPop,
      maxPop,
      filterSet,
      targetNames
    })

    // Generate filename with current date
    const date = new Date().toISOString().split('T')[0] // YYYY-MM-DD
    const filename = `gap-analysis-export-${date}.csv`

    // Return CSV with download headers
    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    console.error('Export API error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * Generate CSV content with metadata and data rows
 */
function generateCSV(
  buas: Array<{ name: string; pop_final: number | null }>,
  filters: {
    minPop: number
    maxPop: number
    filterSet?: FilterSet
    targetNames: Record<string, string>
  }
): string {
  const lines: string[] = []

  // Metadata rows
  const exportDate = new Date().toISOString().split('T')[0] // YYYY-MM-DD
  lines.push(`# Exported At,${exportDate}`)

  // Population range
  const minPopFormatted = filters.minPop.toLocaleString()
  const maxPopFormatted = filters.maxPop.toLocaleString()
  lines.push(`# Population Range,"${minPopFormatted} to ${maxPopFormatted}"`)

  // Filter summary
  if (filters.filterSet && filters.filterSet.rules.length > 0) {
    const summary = generateFilterSummary(filters.filterSet.rules, filters.targetNames)
    lines.push(`# Filters,${escapeCSV(summary)}`)
  } else {
    lines.push(`# Filters,None`)
  }

  // Blank line before data
  lines.push('')

  // Header row
  lines.push('Location Name,Population')

  // Data rows
  for (const bua of buas) {
    const name = escapeCSV(bua.name)
    const population = bua.pop_final !== null
      ? bua.pop_final < 5000
        ? '<5k'
        : bua.pop_final.toLocaleString()
      : 'Unknown'
    lines.push(`${name},"${population}"`)
  }

  return lines.join('\n')
}

/**
 * Escape CSV value by wrapping in quotes and escaping internal quotes
 */
function escapeCSV(value: string): string {
  // Wrap in quotes and escape internal quotes as ""
  return `"${value.replace(/"/g, '""')}"`
}

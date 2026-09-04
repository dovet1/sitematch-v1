import { NextRequest, NextResponse } from 'next/server'
import { createStoreService } from '@/lib/stores-service'
import { requireGapFinderAccess } from '@/lib/gapfinder-access'
import { generateFilterSummary } from '@/lib/buas/generate-filter-summary'
import type { FilterSet } from '@/types/filters'
import { isRetailCentreGapsEnabled } from '@/lib/feature-flags'

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
    const access = await requireGapFinderAccess()
    if (!access.authorized) return access.response

    const body = await request.json()
    const { minPop, maxPop, filterSet, targetNames = {} } = body

    if (body.geography === 'retail_centre') {
      if (!(await isRetailCentreGapsEnabled())) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 })
      }
      const service = await createStoreService()
      const { results } = await service.findRetailCentreGaps({
        filterSet: filterSet ?? { rules: [] },
        retailForms: Array.isArray(body.retailForms) ? body.retailForms : [],
        retailClassifications: Array.isArray(body.retailClassifications)
          ? body.retailClassifications
          : [],
        limit: 50000,
      })
      const csv = generateRetailCentreCSV(results, {
        filterSet,
        targetNames,
        forms: body.retailForms ?? [],
        classifications: body.retailClassifications ?? [],
      })
      const date = new Date().toISOString().split('T')[0]
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="retail-centre-gap-analysis-${date}.csv"`,
        },
      })
    }

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
        access.supabase
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

function generateRetailCentreCSV(
  centres: Array<{
    rc_id: string
    name: string
    classification: string
    form_label: string
    retail_count: number | null
    region_name: string | null
    country: string | null
  }>,
  filters: {
    filterSet?: FilterSet
    targetNames: Record<string, string>
    forms: string[]
    classifications: string[]
  }
): string {
  const lines = [
    `# Exported At,${new Date().toISOString().split('T')[0]}`,
    '# Geography,Retail centres',
    '# Source,GeoDS v4.0 (Open Government Licence)',
    `# Forms,${escapeCSV(filters.forms.length ? filters.forms.join('; ') : 'All')}`,
    `# Classifications,${escapeCSV(filters.classifications.length ? filters.classifications.join('; ') : 'All')}`,
  ]
  if (filters.filterSet?.rules.length) {
    lines.push(`# Filters,${escapeCSV(generateFilterSummary(filters.filterSet.rules, filters.targetNames))}`)
  } else {
    lines.push('# Filters,None')
  }
  lines.push('', 'Retail Centre ID,Name,Classification,Form,Retail Units,Region,Country')
  for (const centre of centres) {
    lines.push([
      centre.rc_id,
      centre.name,
      centre.classification,
      centre.form_label,
      centre.retail_count?.toString() ?? '',
      centre.region_name ?? '',
      centre.country ?? '',
    ].map(escapeCSV).join(','))
  }
  return lines.join('\n')
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

import { NextRequest, NextResponse } from 'next/server'
import { parse } from 'csv-parse/sync'
import { requireAdmin } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase'
import type {
  ImportPreviewResponse,
  CSVRow,
  RowIssue,
  FuzzyBrandMatch,
  DuplicateStoreMatch
} from '@/types/store-import'

export const runtime = 'nodejs'
export const maxDuration = 60 // 60 seconds for preview

// Required CSV columns
const REQUIRED_COLUMNS = ['name', 'address', 'brand', 'category']

// UK coordinate bounds
const UK_LAT_MIN = 49
const UK_LAT_MAX = 61
const UK_LON_MIN = -8
const UK_LON_MAX = 2

export async function POST(request: NextRequest) {
  try {
    // Require admin auth
    await requireAdmin()
    const supabase = await createServerClient()

    // Get file from form data
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Validate file type
    if (!file.name.endsWith('.csv')) {
      return NextResponse.json({ error: 'File must be a CSV' }, { status: 400 })
    }

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large (max 10MB)' }, { status: 400 })
    }

    // Parse CSV
    const fileBuffer = await file.arrayBuffer()
    const csvText = new TextDecoder().decode(fileBuffer)

    let csvRows: CSVRow[]
    try {
      csvRows = parse(csvText, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        cast: (value, context) => {
          // Convert lat/lon to numbers if they're strings
          if (context.column === 'lat' || context.column === 'lon') {
            const num = parseFloat(value)
            return isNaN(num) ? value : num
          }
          return value
        }
      })
    } catch (error: any) {
      return NextResponse.json(
        { error: `CSV parse error: ${error.message}` },
        { status: 400 }
      )
    }

    // Validate required columns
    if (csvRows.length === 0) {
      return NextResponse.json({ error: 'CSV file is empty' }, { status: 400 })
    }

    const firstRow = csvRows[0]
    const missingColumns = REQUIRED_COLUMNS.filter(col => !(col in firstRow))
    if (missingColumns.length > 0) {
      return NextResponse.json(
        { error: `Missing required columns: ${missingColumns.join(', ')}` },
        { status: 400 }
      )
    }

    // Initialize collections
    const errors: RowIssue[] = []
    const warnings: RowIssue[] = []
    const infos: RowIssue[] = []
    const newBrandsSet = new Set<string>()
    const newFasciasSet = new Set<string>()
    const newCategoriesSet = new Set<string>()
    const existingBrandsSet = new Set<string>()
    const existingFasciasSet = new Set<string>()
    const existingCategoriesSet = new Set<string>()

    // Fetch existing entities for validation
    const [brandsResult, fasciasResult, categoriesResult] = await Promise.all([
      supabase.from('brands').select('id, name'),
      supabase.from('fascias').select('id, name, brand_id'),
      supabase.from('categories').select('id, name')
    ])

    const existingBrands = brandsResult.data || []
    const existingFascias = fasciasResult.data || []
    const existingCategories = categoriesResult.data || []

    // Create lookup maps
    const brandMap = new Map(existingBrands.map(b => [b.name.toLowerCase(), b]))
    const categoryMap = new Map(existingCategories.map(c => [c.name.toLowerCase(), c]))

    // Process each row
    const previewRows = csvRows.slice(0, 20).map((row, index) => {
      const rowNumber = index + 1
      const rowIssues: RowIssue[] = []
      let status: 'valid' | 'error' | 'warning' = 'valid'

      // Validate required fields
      for (const field of REQUIRED_COLUMNS) {
        if (!row[field as keyof CSVRow] || String(row[field as keyof CSVRow]).trim() === '') {
          rowIssues.push({
            rowNumber,
            type: 'missing_required_field',
            severity: 'error',
            message: `Missing required field: ${field}`,
            field
          })
          status = 'error'
        }
      }

      // Validate lat/lon if provided (and not empty)
      const hasLat = row.lat !== undefined && row.lat !== null && String(row.lat).trim() !== ''
      const hasLon = row.lon !== undefined && row.lon !== null && String(row.lon).trim() !== ''

      if (hasLat && hasLon) {
        const lat = typeof row.lat === 'number' ? row.lat : parseFloat(String(row.lat))
        const lon = typeof row.lon === 'number' ? row.lon : parseFloat(String(row.lon))

        if (isNaN(lat) || isNaN(lon)) {
          rowIssues.push({
            rowNumber,
            type: 'invalid_coordinates',
            severity: 'error',
            message: 'Invalid lat/lon values (not numbers)',
            field: 'lat,lon'
          })
          status = 'error'
        } else if (lat < UK_LAT_MIN || lat > UK_LAT_MAX || lon < UK_LON_MIN || lon > UK_LON_MAX) {
          rowIssues.push({
            rowNumber,
            type: 'invalid_coordinates',
            severity: 'error',
            message: `Coordinates outside UK bounds (lat: ${lat}, lon: ${lon}). Check if lat/lon are swapped.`,
            field: 'lat,lon',
            suggestion: 'UK bounds: lat 49-61, lon -8 to 2'
          })
          status = 'error'
        }
      }

      return {
        rowNumber,
        data: row,
        issues: rowIssues,
        status
      }
    })

    // Collect all issues from preview rows
    previewRows.forEach(pr => {
      pr.issues.forEach(issue => {
        if (issue.severity === 'error') {
          errors.push(issue)
        } else if (issue.severity === 'warning') {
          warnings.push(issue)
        } else {
          infos.push(issue)
        }
      })
    })

    // Process all rows for entity detection (not just preview)
    for (let i = 0; i < csvRows.length; i++) {
      const row = csvRows[i]
      const brandName = row.brand?.trim()
      const fasciaName = (row.fascia?.trim() || brandName)?.trim()
      const categoryName = row.category?.trim()

      if (!brandName || !categoryName) continue

      // Check for existing brand (case-insensitive)
      const existingBrand = brandMap.get(brandName.toLowerCase())
      if (existingBrand) {
        existingBrandsSet.add(brandName)
      } else {
        // Check for fuzzy match (>90% similarity) using pg_trgm extension
        try {
          const { data: fuzzyMatches } = await supabase
            .from('brands')
            .select('id, name')
            .filter('name', 'ilike', `%${brandName}%`)
            .limit(5)

          if (fuzzyMatches && fuzzyMatches.length > 0) {
            // Calculate similarity on client side or use a simpler approach
            // For now, just check if brand name is very similar (contains or contained)
            const similarBrand = fuzzyMatches.find(b => {
              const lowerBrand = b.name.toLowerCase()
              const lowerInput = brandName.toLowerCase()
              // Check if one contains the other or they differ by only 1-2 characters
              return (
                lowerBrand.includes(lowerInput) ||
                lowerInput.includes(lowerBrand) ||
                Math.abs(lowerBrand.length - lowerInput.length) <= 2
              )
            })

            if (similarBrand && i < 20) { // Only add warnings for preview rows
              warnings.push({
                rowNumber: i + 1,
                type: 'fuzzy_brand_match',
                severity: 'warning',
                message: `Brand "${brandName}" is similar to existing "${similarBrand.name}". Verify this is intentional.`,
                field: 'brand',
                data: { existingBrand: similarBrand.name }
              })
            }
          }
        } catch (error) {
          // Silently fail fuzzy matching if pg_trgm not available
          console.warn('Fuzzy brand matching failed:', error)
        }

        newBrandsSet.add(brandName)
      }

      // Check for existing category
      const existingCategory = categoryMap.get(categoryName.toLowerCase())
      if (existingCategory) {
        existingCategoriesSet.add(categoryName)
      } else {
        newCategoriesSet.add(categoryName)
      }

      // Check for existing fascia
      const existingFascia = existingFascias.find(
        f => f.name.toLowerCase() === fasciaName.toLowerCase()
      )
      if (existingFascia) {
        existingFasciasSet.add(fasciaName)

        // Check if fascia already exists under a different brand
        const fasciaBrand = existingBrands.find(b => b.id === existingFascia.brand_id)
        if (fasciaBrand && fasciaBrand.name.toLowerCase() !== brandName.toLowerCase() && i < 20) {
          infos.push({
            rowNumber: i + 1,
            type: 'fascia_duplication',
            severity: 'info',
            message: `Fascia "${fasciaName}" already exists under brand "${fasciaBrand.name}". A new fascia will be created under "${brandName}".`,
            field: 'fascia'
          })
        }
      } else {
        newFasciasSet.add(fasciaName)
      }
    }

    // Build response
    const response: ImportPreviewResponse = {
      totalRows: csvRows.length,
      validRows: csvRows.length - errors.length,
      rowsWithIssues: errors.length + warnings.length,

      newBrands: Array.from(newBrandsSet),
      newFascias: Array.from(newFasciasSet),
      newCategories: Array.from(newCategoriesSet),
      existingBrands: Array.from(existingBrandsSet),
      existingFascias: Array.from(existingFasciasSet),
      existingCategories: Array.from(existingCategoriesSet),

      errors,
      warnings,
      infos,

      previewRows,

      hasErrors: errors.length > 0,
      hasWarnings: warnings.length > 0,
      canProceed: errors.length < csvRows.length // Can proceed if at least some rows are valid
    }

    return NextResponse.json(response)
  } catch (error: any) {
    console.error('Preview endpoint error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to preview import' },
      { status: 500 }
    )
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { parse } from 'csv-parse/sync'
import { requireAdmin } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase'
import type {
  ImportExecuteResponse,
  CSVRow,
  RowIssue,
  ValidatedStoreRow
} from '@/types/store-import'

export const runtime = 'nodejs'
export const maxDuration = 300 // 5 minutes

// Mapbox geocoding (uses existing token)
const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN

// UK coordinate bounds
const UK_LAT_MIN = 49
const UK_LAT_MAX = 61
const UK_LON_MIN = -8
const UK_LON_MAX = 2

// Geocode an address using Mapbox
async function geocodeAddress(
  address: string,
  town?: string,
  postcode?: string
): Promise<{ lat: number; lon: number }> {
  if (!MAPBOX_TOKEN) {
    throw new Error('Mapbox token not configured')
  }

  // Build query with all available fields for better accuracy
  const queryParts = [address, town || '', postcode || '', 'UK'].filter(
    part => part.trim() !== ''
  )
  const query = encodeURIComponent(queryParts.join(', '))

  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${query}.json?access_token=${MAPBOX_TOKEN}&country=GB,IE&types=address,place&limit=1`

  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Geocoding API error: ${response.statusText}`)
  }

  const data = await response.json()
  if (!data.features || data.features.length === 0) {
    throw new Error('No geocoding results found')
  }

  const [lon, lat] = data.features[0].center
  return { lat, lon }
}

// Batch geocode with rate limiting
async function geocodeBatch(
  rows: Array<{ address: string; town?: string; postcode?: string; rowNumber: number }>
): Promise<Map<number, { lat: number; lon: number }>> {
  const results = new Map<number, { lat: number; lon: number }>()
  const BATCH_SIZE = 50
  const DELAY_MS = 5000 // 5 seconds between batches

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE)

    // Process batch in parallel
    const batchResults = await Promise.allSettled(
      batch.map(async row => {
        const coords = await geocodeAddress(row.address, row.town, row.postcode)
        return { rowNumber: row.rowNumber, coords }
      })
    )

    // Collect successful results
    batchResults.forEach(result => {
      if (result.status === 'fulfilled') {
        results.set(result.value.rowNumber, result.value.coords)
      }
    })

    // Delay between batches (except for last batch)
    if (i + BATCH_SIZE < rows.length) {
      await new Promise(resolve => setTimeout(resolve, DELAY_MS))
    }
  }

  return results
}

// Validate UK coordinates
function isValidUKCoordinates(lat: number, lon: number): boolean {
  return lat >= UK_LAT_MIN && lat <= UK_LAT_MAX && lon >= UK_LON_MIN && lon <= UK_LON_MAX
}

// Resolve or create brand
async function resolveBrand(name: string, supabase: any): Promise<string> {
  // Try exact match (case-insensitive)
  const { data: existing } = await supabase
    .from('brands')
    .select('id')
    .ilike('name', name)
    .single()

  if (existing) return existing.id

  // Create new brand with explicit UUID
  const brandId = crypto.randomUUID()
  const { data: newBrand, error } = await supabase
    .from('brands')
    .insert({ id: brandId, name })
    .select('id')
    .single()

  if (error) throw new Error(`Failed to create brand: ${error.message}`)
  return newBrand.id
}

// Resolve or create fascia
async function resolveFascia(
  name: string,
  brandId: string,
  supabase: any
): Promise<string> {
  // Try exact match within brand
  const { data: existing } = await supabase
    .from('fascias')
    .select('id')
    .eq('brand_id', brandId)
    .ilike('name', name)
    .single()

  if (existing) return existing.id

  // Create new fascia under brand with explicit UUID
  const fasciaId = crypto.randomUUID()
  const { data: newFascia, error } = await supabase
    .from('fascias')
    .insert({ id: fasciaId, name, brand_id: brandId })
    .select('id')
    .single()

  if (error) throw new Error(`Failed to create fascia: ${error.message}`)
  return newFascia.id
}

// Resolve or create category
async function resolveCategory(name: string, supabase: any): Promise<string> {
  // Try exact match
  const { data: existing } = await supabase
    .from('categories')
    .select('id')
    .ilike('name', name)
    .single()

  if (existing) return existing.id

  // Create new category with explicit UUID
  const categoryId = crypto.randomUUID()
  const { data: newCategory, error } = await supabase
    .from('categories')
    .insert({ id: categoryId, name, parent_category_id: null })
    .select('id')
    .single()

  if (error) throw new Error(`Failed to create category: ${error.message}`)
  return newCategory.id
}

// Check for category conflict
async function checkCategoryConflict(
  fasciaId: string,
  categoryId: string,
  supabase: any
): Promise<{ conflict: boolean; existingCategoryName?: string }> {
  const { data: existing } = await supabase
    .from('fascia_categories')
    .select('category_id, categories(name)')
    .eq('fascia_id', fasciaId)
    .eq('is_primary', true)
    .single()

  if (!existing) return { conflict: false }

  if (existing.category_id !== categoryId) {
    return {
      conflict: true,
      existingCategoryName: existing.categories?.name
    }
  }

  return { conflict: false }
}

// Link fascia to category
async function linkFasciaCategory(
  fasciaId: string,
  categoryId: string,
  supabase: any
): Promise<void> {
  const { error } = await supabase.from('fascia_categories').upsert(
    {
      fascia_id: fasciaId,
      category_id: categoryId,
      is_primary: true
    },
    {
      onConflict: 'fascia_id,category_id'
    }
  )

  if (error) throw new Error(`Failed to link fascia to category: ${error.message}`)
}

// Check for duplicate stores
async function checkDuplicate(
  lat: number,
  lon: number,
  brandId: string,
  fasciaId: string,
  supabase: any
): Promise<{ isDuplicate: boolean; storeName?: string; distance?: number }> {
  const { data: nearby } = await supabase.rpc('get_stores_near_point', {
    p_lat: lat,
    p_lon: lon,
    p_radius_m: 50
  })

  if (!nearby || nearby.length === 0) {
    return { isDuplicate: false }
  }

  // Check if any nearby store has same brand or fascia
  const duplicate = nearby.find(
    (store: any) => store.brand_id === brandId || store.fascia_id === fasciaId
  )

  if (duplicate) {
    return {
      isDuplicate: true,
      storeName: duplicate.name,
      distance: Math.round(duplicate.distance || 50)
    }
  }

  return { isDuplicate: false }
}

export async function POST(request: NextRequest) {
  try {
    // Check if this is a dry run
    const url = new URL(request.url)
    const isDryRun = url.searchParams.get('dryRun') === 'true'

    // Require admin auth
    const user = await requireAdmin()
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

    // Parse CSV from file
    const fileBuffer = await file.arrayBuffer()
    const csvText = new TextDecoder().decode(fileBuffer)
    const filename = file.name

    // Parse CSV data
    let csvRows: CSVRow[]
    try {
      csvRows = parse(csvText, {
        columns: true,
        skip_empty_lines: true,
        trim: true
      })
    } catch (error: any) {
      return NextResponse.json(
        { error: `CSV parse error: ${error.message}` },
        { status: 400 }
      )
    }

    // Check geocoding limit
    const rowsNeedingGeocode = csvRows.filter(row => {
      const hasLat = row.lat !== undefined && row.lat !== null && String(row.lat).trim() !== ''
      const hasLon = row.lon !== undefined && row.lon !== null && String(row.lon).trim() !== ''
      return !hasLat || !hasLon
    })
    if (rowsNeedingGeocode.length > 500) {
      return NextResponse.json(
        {
          error: `Too many rows require geocoding (${rowsNeedingGeocode.length}). Maximum 500 rows per import when geocoding is needed. Please split into smaller batches or provide lat/lon in CSV.`
        },
        { status: 400 }
      )
    }

    console.log(
      `Processing ${csvRows.length} rows (${isDryRun ? 'DRY RUN' : 'LIVE IMPORT'})`
    )

    // Geocode missing coordinates
    console.log(`Geocoding ${rowsNeedingGeocode.length} rows...`)
    const geocodedCoords = await geocodeBatch(
      rowsNeedingGeocode.map((row, idx) => ({
        address: row.address,
        town: row.town,
        postcode: row.postcode,
        rowNumber: csvRows.findIndex(r => r === row) + 1
      }))
    )
    console.log(`Geocoding complete. Successfully geocoded: ${geocodedCoords.size} rows`)

    // Process rows
    const validatedRows: ValidatedStoreRow[] = []
    const skippedRows: RowIssue[] = []
    const blockedRows: RowIssue[] = []
    const brandCounts = { created: 0, existing: 0 }
    const fasciaCounts = { created: 0, existing: 0 }
    const categoryCounts = { created: 0, existing: 0 }

    // Track created entities to avoid duplicates
    const createdBrands = new Map<string, string>()
    const createdFascias = new Map<string, string>()
    const createdCategories = new Map<string, string>()

    for (let i = 0; i < csvRows.length; i++) {
      const row = csvRows[i]
      const rowNumber = i + 1

      try {
        // Validate required fields
        if (!row.name || !row.address || !row.brand || !row.category) {
          blockedRows.push({
            rowNumber,
            type: 'missing_required_field',
            severity: 'error',
            message: 'Missing required fields',
            field: !row.name ? 'name' : !row.address ? 'address' : !row.brand ? 'brand' : 'category'
          })
          continue
        }

        // Get coordinates (from CSV or geocoding)
        let lat: number, lon: number
        const hasLat = row.lat !== undefined && row.lat !== null && String(row.lat).trim() !== ''
        const hasLon = row.lon !== undefined && row.lon !== null && String(row.lon).trim() !== ''

        if (hasLat && hasLon) {
          lat = typeof row.lat === 'number' ? row.lat : parseFloat(String(row.lat))
          lon = typeof row.lon === 'number' ? row.lon : parseFloat(String(row.lon))
        } else {
          const geocoded = geocodedCoords.get(rowNumber)
          if (!geocoded) {
            blockedRows.push({
              rowNumber,
              type: 'geocode_failed',
              severity: 'error',
              message: `Could not geocode address: ${row.address}`,
              field: 'address'
            })
            continue
          }
          lat = geocoded.lat
          lon = geocoded.lon
        }

        // Validate coordinates
        if (!isValidUKCoordinates(lat, lon)) {
          blockedRows.push({
            rowNumber,
            type: 'invalid_coordinates',
            severity: 'error',
            message: `Coordinates outside UK bounds (lat: ${lat}, lon: ${lon}). Check if lat/lon are swapped.`,
            field: 'lat,lon'
          })
          continue
        }

        // Resolve entities
        const brandName = row.brand.trim()
        const fasciaName = (row.fascia?.trim() || brandName).trim()
        const categoryName = row.category.trim()

        // Get or create brand
        let brandId = createdBrands.get(brandName.toLowerCase())
        if (!brandId) {
          brandId = await resolveBrand(brandName, supabase)
          createdBrands.set(brandName.toLowerCase(), brandId)
          // Count as created if we just made it
          const { data: brandCheck } = await supabase
            .from('brands')
            .select('created_at')
            .eq('id', brandId)
            .single()
          if (brandCheck && new Date(brandCheck.created_at).getTime() > Date.now() - 10000) {
            brandCounts.created++
          } else {
            brandCounts.existing++
          }
        }

        // Get or create fascia
        let fasciaId = createdFascias.get(`${brandId}:${fasciaName.toLowerCase()}`)
        if (!fasciaId) {
          fasciaId = await resolveFascia(fasciaName, brandId, supabase)
          createdFascias.set(`${brandId}:${fasciaName.toLowerCase()}`, fasciaId)
          const { data: fasciaCheck } = await supabase
            .from('fascias')
            .select('created_at')
            .eq('id', fasciaId)
            .single()
          if (fasciaCheck && new Date(fasciaCheck.created_at).getTime() > Date.now() - 10000) {
            fasciaCounts.created++
          } else {
            fasciaCounts.existing++
          }
        }

        // Get or create category
        let categoryId = createdCategories.get(categoryName.toLowerCase())
        if (!categoryId) {
          categoryId = await resolveCategory(categoryName, supabase)
          createdCategories.set(categoryName.toLowerCase(), categoryId)
          const { data: categoryCheck } = await supabase
            .from('categories')
            .select('created_at')
            .eq('id', categoryId)
            .single()
          if (categoryCheck && new Date(categoryCheck.created_at).getTime() > Date.now() - 10000) {
            categoryCounts.created++
          } else {
            categoryCounts.existing++
          }
        }

        // Check category conflict
        const conflict = await checkCategoryConflict(fasciaId, categoryId, supabase)
        if (conflict.conflict) {
          blockedRows.push({
            rowNumber,
            type: 'category_conflict',
            severity: 'error',
            message: `Fascia '${fasciaName}' already mapped to '${conflict.existingCategoryName}' (CSV says '${categoryName}'). Fix CSV.`,
            field: 'category'
          })
          continue
        }

        // Link fascia to category (if not already linked)
        await linkFasciaCategory(fasciaId, categoryId, supabase)

        // Check for duplicates
        const duplicate = await checkDuplicate(lat, lon, brandId, fasciaId, supabase)
        if (duplicate.isDuplicate) {
          skippedRows.push({
            rowNumber,
            type: 'duplicate',
            severity: 'warning',
            message: `Duplicate: ${duplicate.storeName} (same brand/fascia within ${duplicate.distance}m)`,
            data: { existingStore: duplicate.storeName, distance: duplicate.distance }
          })
          continue
        }

        // Add to validated rows
        validatedRows.push({
          name: row.name.trim(),
          address: row.address.trim(),
          brandName,
          fasciaName,
          categoryName,
          brandId,
          fasciaId,
          categoryId,
          lat,
          lon,
          postcode: row.postcode?.trim(),
          town: row.town?.trim(),
          suburb: row.suburb?.trim(),
          county: row.county?.trim(),
          address_line_1: row.address_line_1?.trim(),
          address_line_2: row.address_line_2?.trim(),
          pqi: row.pqi?.trim(),
          open_date: row.open_date?.trim(),
          size_band: row.size_band?.trim(),
          rowNumber
        })
      } catch (error: any) {
        console.error(`Error processing row ${rowNumber}:`, error)
        blockedRows.push({
          rowNumber,
          type: 'geocode_failed',
          severity: 'error',
          message: `Processing error: ${error.message}`,
          field: 'unknown'
        })
      }
    }

    let insertedCount = 0
    let rebuildTriggered = false

    // Insert stores (unless dry run)
    if (!isDryRun && validatedRows.length > 0) {
      const insertData = validatedRows.map(store => ({
        id: crypto.randomUUID(),
        brand_id: store.brandId,
        fascia_id: store.fasciaId,
        name: store.name,
        lat: store.lat,
        lon: store.lon,
        postcode: store.postcode || null,
        town: store.town || null,
        suburb: store.suburb || null,
        county: store.county || null,
        address_line_1: store.address_line_1 || null,
        address_line_2: store.address_line_2 || null,
        pqi: store.pqi || null,
        open_date: store.open_date || null,
        size_band: store.size_band || null
      }))

      // Batch insert (500 rows per batch)
      const BATCH_SIZE = 500
      for (let i = 0; i < insertData.length; i += BATCH_SIZE) {
        const batch = insertData.slice(i, i + BATCH_SIZE)
        const { error } = await supabase.from('stores').insert(batch)
        if (error) throw new Error(`Store insertion failed: ${error.message}`)
        insertedCount += batch.length
      }

      console.log(`Inserted ${insertedCount} stores`)

      // Trigger rebuild (fire-and-forget - rebuild takes 5-10 min, will timeout if awaited)
      try {
        console.log('Triggering BUA summary rebuild...')
        console.log('User ID:', user.id)

        // Fire-and-forget: Don't await because rebuild takes too long and will timeout
        // The rebuild runs on Supabase server and will continue even after timeout
        supabase.rpc('rebuild_all_bua_summaries', {
          p_user_id: user.id
        }).then(({ error }) => {
          if (error) {
            // This will likely be a timeout error, which is expected and OK
            console.log('Rebuild RPC response (timeout expected):', error.message)
          } else {
            console.log('Rebuild completed (unexpected - should timeout)')
          }
        })

        // Give it a moment to start, then verify it's running
        await new Promise(resolve => setTimeout(resolve, 2000))

        // Verify rebuild started by checking lock table
        const { data: lockData } = await supabase
          .from('rebuild_lock')
          .select('*')
          .eq('lock_name', 'bua_summary_rebuild')
          .maybeSingle()

        if (lockData) {
          console.log('✅ Rebuild started successfully - lock acquired')
          rebuildTriggered = true
        } else {
          console.log('⚠️ Rebuild may not have started - no lock found')
          rebuildTriggered = false
        }
      } catch (error: any) {
        console.error('REBUILD TRIGGER FAILED:', error.message)
        rebuildTriggered = false
      }
    }

    // Log summary
    console.log(`Processing complete:`)
    console.log(`  - Validated: ${validatedRows.length}`)
    console.log(`  - Skipped: ${skippedRows.length}`)
    console.log(`  - Blocked: ${blockedRows.length}`)
    console.log(`  - Total processed: ${validatedRows.length + skippedRows.length + blockedRows.length}`)

    // Log import
    await supabase.from('store_import_logs').insert({
      user_id: user.id,
      filename,
      total_rows: csvRows.length,
      inserted_rows: isDryRun ? 0 : insertedCount,
      skipped_rows: skippedRows.length,
      blocked_rows: blockedRows.length,
      error_report: {
        skipped: skippedRows,
        blocked: blockedRows
      },
      is_dry_run: isDryRun
    })

    const response: ImportExecuteResponse = {
      success: true,
      isDryRun,
      insertedCount: isDryRun ? validatedRows.length : insertedCount,
      skippedCount: skippedRows.length,
      blockedCount: blockedRows.length,
      brandsCreated: isDryRun ? 0 : brandCounts.created,
      fasciasCreated: isDryRun ? 0 : fasciaCounts.created,
      categoriesCreated: isDryRun ? 0 : categoryCounts.created,
      skippedRows,
      blockedRows,
      rebuildTriggered: isDryRun ? false : rebuildTriggered
    }

    return NextResponse.json(response)
  } catch (error: any) {
    console.error('Execute endpoint error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to execute import' },
      { status: 500 }
    )
  }
}

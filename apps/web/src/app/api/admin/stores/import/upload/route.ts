import { NextRequest, NextResponse } from 'next/server'
import { parse } from 'csv-parse/sync'
import { stringify } from 'csv-stringify/sync'
import { requireAdmin } from '@/lib/auth'
import { adminClient } from '@/lib/admin-auth'
import { createServerClient } from '@/lib/supabase'
import type { CSVRow } from '@/types/store-import'

export const runtime = 'nodejs'
export const maxDuration = 300 // 5 minutes

// API Configuration
const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY

// Constants
const MAX_ROWS = 500
const DISTANCE_THRESHOLD_METERS = 10
const UK_LAT_MIN = 49
const UK_LAT_MAX = 61
const UK_LON_MIN = -8
const UK_LON_MAX = 2
const MAPBOX_BATCH_SIZE = 50
const MAPBOX_DELAY_MS = 5000
const GOOGLE_CONCURRENCY = 20
const GOOGLE_TIMEOUT_MS = 5000
const GOOGLE_MAX_RETRIES = 2
const TOTAL_TIMEOUT_CUTOFF_MS = 280000 // 280 seconds

// Types for internal processing
interface ProcessedRow {
  rowNumber: number
  original: CSVRow
  name: string
  address: string
  brand: string
  fascia: string
  category: string
  postcode?: string
  town?: string
  lat?: number
  lon?: number
  // Validation state
  failed: boolean
  failureReason?: string
  // Geocoding results
  mapboxLat?: number
  mapboxLon?: number
  // What Mapbox said about the quality of that hit. Null for a row whose coordinates
  // came from the CSV, because nothing graded those.
  mapboxAccuracy?: string | null
  // Google validation results
  googleLat?: number
  googleLon?: number
  googlePlaceId?: string
  distance?: number
  // Retry flow tracking
  isRetryRow?: boolean  // True if google_place_id provided in CSV
  skipGoogleValidation?: boolean  // True if retry row should skip Google validation
  // Entity IDs (Phase 2)
  brandId?: string
  fasciaId?: string
  categoryId?: string
}

interface SuccessfulStore {
  name: string
  address: string
  brand: string
  fascia: string
  category: string
}

interface UploadResponse {
  success: boolean
  successfulStores: SuccessfulStore[]
  failedStoresCSV: string
  insertedCount: number
  failedCount: number
  rebuildTriggered: boolean
  queuedForFloorArea: number
}

// Utility: Validate UK coordinates
function isValidUKCoordinates(lat: number, lon: number): boolean {
  return lat >= UK_LAT_MIN && lat <= UK_LAT_MAX && lon >= UK_LON_MIN && lon <= UK_LON_MAX
}

// Utility: Calculate distance using Haversine formula
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3 // Earth radius in meters
  const φ1 = (lat1 * Math.PI) / 180
  const φ2 = (lat2 * Math.PI) / 180
  const Δφ = ((lat2 - lat1) * Math.PI) / 180
  const Δλ = ((lon2 - lon1) * Math.PI) / 180

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return R * c
}

// Mapbox accuracies that put the point on the building rather than near it. Anything
// else — interpolated along a street, or a `place` result with no accuracy at all — is
// a coordinate a human should look at before it is trusted for anything spatial.
const PRECISE_GEOCODE = new Set(['rooftop', 'parcel', 'point'])

// Utility: Sleep helper
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

// PHASE 1: Geocoding with Mapbox
async function geocodeAddress(
  address: string,
  town?: string,
  postcode?: string
): Promise<{ lat: number; lon: number; accuracy: string | null }> {
  const queryParts = [address, town || '', postcode || '', 'UK'].filter(
    part => part.trim() !== ''
  )
  const query = encodeURIComponent(queryParts.join(', '))

  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${query}.json?access_token=${MAPBOX_TOKEN}&country=GB,IE&types=address,place&limit=1&permanent=true`

  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Geocoding failed: ${response.statusText}`)
  }

  const data = await response.json()
  if (!data.features || data.features.length === 0) {
    throw new Error('No geocoding results found')
  }

  const [lon, lat] = data.features[0].center
  // Mapbox grades its own hit: rooftop, parcel, point, interpolated, street. A `place`
  // result carries no accuracy at all, which is itself the answer — that coordinate is a
  // town centre, not a shop. Recorded verbatim, in Mapbox's own vocabulary; see the note
  // where it is written to `pqi`.
  const accuracy: string | null = data.features[0].properties?.accuracy ?? null
  return { lat, lon, accuracy }
}

async function batchGeocodeMapbox(rows: ProcessedRow[]): Promise<void> {
  const rowsNeedingGeocode = rows.filter(r => !r.failed && r.lat == null && r.lon == null)

  console.log(`Geocoding ${rowsNeedingGeocode.length} rows with Mapbox...`)

  for (let i = 0; i < rowsNeedingGeocode.length; i += MAPBOX_BATCH_SIZE) {
    const batch = rowsNeedingGeocode.slice(i, i + MAPBOX_BATCH_SIZE)

    const results = await Promise.allSettled(
      batch.map(async row => {
        const coords = await geocodeAddress(row.address, row.town, row.postcode)
        return { row, coords }
      })
    )

    results.forEach((result, index) => {
      const row = batch[index]
      if (result.status === 'fulfilled') {
        row.mapboxLat = result.value.coords.lat
        row.mapboxLon = result.value.coords.lon
        row.mapboxAccuracy = result.value.coords.accuracy
      } else {
        row.failed = true
        row.failureReason = 'Geocoding failed'
      }
    })

    // Delay between batches
    if (i + MAPBOX_BATCH_SIZE < rowsNeedingGeocode.length) {
      await sleep(MAPBOX_DELAY_MS)
    }
  }
}

// PHASE 1: Google Places validation with retry logic
async function validateWithGooglePlaces(
  storeName: string,
  address: string,
  mapboxLat: number,
  mapboxLon: number,
  town?: string,
  postcode?: string,
  retryCount = 0
): Promise<{
  success: boolean
  placeId?: string
  lat?: number
  lon?: number
  distance?: number
  error?: string
}> {
  try {
    const queryParts = [storeName, address, town || '', postcode || '', 'UK'].filter(
      part => part.trim() !== ''
    )
    const textQuery = queryParts.join(', ')

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), GOOGLE_TIMEOUT_MS)

    const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_PLACES_API_KEY!,
        'X-Goog-FieldMask': 'places.id,places.location'
      },
      body: JSON.stringify({
        textQuery,
        locationBias: {
          circle: {
            center: { latitude: mapboxLat, longitude: mapboxLon },
            radius: 5000.0
          }
        }
      }),
      signal: controller.signal
    })

    clearTimeout(timeoutId)

    // Handle 429 with exponential backoff
    if (response.status === 429 && retryCount < GOOGLE_MAX_RETRIES) {
      const backoffMs = 1000 * Math.pow(2, retryCount) // 1s, 2s
      await sleep(backoffMs)
      return validateWithGooglePlaces(storeName, address, mapboxLat, mapboxLon, town, postcode, retryCount + 1)
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => null)
      if (response.status === 429 || errorData?.error?.status === 'RESOURCE_EXHAUSTED') {
        return { success: false, error: 'Google Places quota exceeded' }
      }
      return { success: false, error: `Google API error: ${response.status}` }
    }

    const data = await response.json()

    if (!data.places || data.places.length === 0) {
      return { success: false, error: 'No Google Places results found' }
    }

    const place = data.places[0]
    const googleLat = place.location.latitude
    const googleLon = place.location.longitude
    const distance = calculateDistance(mapboxLat, mapboxLon, googleLat, googleLon)

    return {
      success: true,
      placeId: place.id,
      lat: googleLat,
      lon: googleLon,
      distance
    }
  } catch (error: any) {
    if (error.name === 'AbortError') {
      return { success: false, error: 'Google Places request timeout' }
    }
    if (retryCount < GOOGLE_MAX_RETRIES) {
      const backoffMs = 1000 * Math.pow(2, retryCount)
      await sleep(backoffMs)
      return validateWithGooglePlaces(storeName, address, mapboxLat, mapboxLon, town, postcode, retryCount + 1)
    }
    return { success: false, error: error.message }
  }
}

async function batchValidateGoogle(rows: ProcessedRow[], startTime: number): Promise<void> {
  const rowsNeedingValidation = rows.filter(r =>
    !r.failed &&
    !r.skipGoogleValidation &&
    (r.mapboxLat != null || r.lat != null) &&
    (r.mapboxLon != null || r.lon != null)
  )

  console.log(`Validating ${rowsNeedingValidation.length} rows with Google Places...`)

  // Log skipped retry rows for visibility
  const skippedRetryCount = rows.filter(r => !r.failed && r.skipGoogleValidation).length
  if (skippedRetryCount > 0) {
    console.log(`Skipping Google validation for ${skippedRetryCount} retry rows (google_place_id provided)`)
  }

  for (let i = 0; i < rowsNeedingValidation.length; i += GOOGLE_CONCURRENCY) {
    // Check timeout
    const elapsed = Date.now() - startTime
    if (elapsed > TOTAL_TIMEOUT_CUTOFF_MS) {
      console.warn(`Timeout approaching (${elapsed}ms), stopping Google validation`)
      // Mark remaining rows as failed
      for (let j = i; j < rowsNeedingValidation.length; j++) {
        const row = rowsNeedingValidation[j]
        row.failed = true
        row.failureReason = 'Timeout - not validated'
      }
      break
    }

    const batch = rowsNeedingValidation.slice(i, i + GOOGLE_CONCURRENCY)

    const results = await Promise.allSettled(
      batch.map(async row => {
        const lat = row.mapboxLat ?? row.lat!
        const lon = row.mapboxLon ?? row.lon!
        const result = await validateWithGooglePlaces(
          row.name,
          row.address,
          lat,
          lon,
          row.town,
          row.postcode
        )
        return { row, result }
      })
    )

    results.forEach((result, index) => {
      const row = batch[index]
      if (result.status === 'fulfilled') {
        const { result: googleResult } = result.value
        if (googleResult.success) {
          row.googleLat = googleResult.lat
          row.googleLon = googleResult.lon
          row.googlePlaceId = googleResult.placeId
          row.distance = googleResult.distance

          // Check distance threshold
          if (googleResult.distance && googleResult.distance >= DISTANCE_THRESHOLD_METERS) {
            row.failed = true
            row.failureReason = `Distance validation failed (${Math.round(googleResult.distance)}m)`
          }
        } else {
          row.failed = true
          row.failureReason = googleResult.error || 'Google validation failed'
        }
      } else {
        row.failed = true
        row.failureReason = 'Google validation error'
      }
    })
  }
}

// PHASE 1: Check category conflicts (read-only)
async function checkCategoryConflicts(rows: ProcessedRow[], supabase: any): Promise<void> {
  const successfulRows = rows.filter(r => !r.failed)

  for (const row of successfulRows) {
    // First, look up if this fascia exists under this brand
    const { data: existingFascia } = await supabase
      .from('fascias')
      .select('id, brand_id')
      .ilike('name', row.fascia)
      .single()

    if (existingFascia) {
      // Get the brand for this row
      const { data: brand } = await supabase
        .from('brands')
        .select('id')
        .ilike('name', row.brand)
        .single()

      // Check if fascia is under this brand
      if (brand && existingFascia.brand_id === brand.id) {
        // Check if this fascia has a different primary category
        const { data: existing } = await supabase
          .from('fascia_categories')
          .select('category_id, categories(name)')
          .eq('fascia_id', existingFascia.id)
          .eq('is_primary', true)
          .single()

        if (existing) {
          const { data: csvCategory } = await supabase
            .from('categories')
            .select('id')
            .ilike('name', row.category)
            .single()

          if (csvCategory && existing.category_id !== csvCategory.id) {
            row.failed = true
            row.failureReason = `Category conflict: fascia '${row.fascia}' already linked to '${existing.categories?.name}'`
          }
        }
      }
    }
  }
}

// PHASE 2: Resolve or create brand
async function resolveBrand(name: string, supabase: any): Promise<string> {
  const { data: existing } = await supabase
    .from('brands')
    .select('id')
    .ilike('name', name)
    .single()

  if (existing) return existing.id

  const brandId = crypto.randomUUID()
  const { data: newBrand, error } = await supabase
    .from('brands')
    .insert({ id: brandId, name })
    .select('id')
    .single()

  if (error) throw new Error(`Failed to create brand: ${error.message}`)
  return newBrand.id
}

// PHASE 2: Resolve or create fascia
async function resolveFascia(name: string, brandId: string, supabase: any): Promise<string> {
  const { data: existing } = await supabase
    .from('fascias')
    .select('id')
    .eq('brand_id', brandId)
    .ilike('name', name)
    .single()

  if (existing) return existing.id

  const fasciaId = crypto.randomUUID()
  const { data: newFascia, error } = await supabase
    .from('fascias')
    .insert({ id: fasciaId, name, brand_id: brandId })
    .select('id')
    .single()

  if (error) throw new Error(`Failed to create fascia: ${error.message}`)
  return newFascia.id
}

// PHASE 2: Resolve or create category
async function resolveCategory(name: string, supabase: any): Promise<string> {
  const { data: existing } = await supabase
    .from('categories')
    .select('id')
    .ilike('name', name)
    .single()

  if (existing) return existing.id

  const categoryId = crypto.randomUUID()
  const { data: newCategory, error } = await supabase
    .from('categories')
    .insert({ id: categoryId, name, parent_category_id: null })
    .select('id')
    .single()

  if (error) throw new Error(`Failed to create category: ${error.message}`)
  return newCategory.id
}

// PHASE 2: Link fascia to category
async function linkFasciaCategory(fasciaId: string, categoryId: string, supabase: any): Promise<void> {
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

// Generate failed CSV
function generateFailedCSV(rows: ProcessedRow[]): string {
  const failedRows = rows.filter(r => r.failed)

  if (failedRows.length === 0) {
    return ''
  }

  // Get all original CSV columns from the first row
  const firstOriginal = failedRows[0].original
  const originalColumns = Object.keys(firstOriginal)

  // Diagnostic columns to append
  const diagnosticColumns = [
    'failure_reason',
    'mapbox_lat',
    'mapbox_lon',
    'google_lat',
    'google_lon',
    'google_place_id'
  ]

  // De-duplicate columns - remove diagnostics that already exist in original
  const columnsToAppend = diagnosticColumns.filter(col => !originalColumns.includes(col))
  const allColumns = [...originalColumns, ...columnsToAppend]

  // Build CSV data - prefer processed values over originals for diagnostic columns
  const csvData = failedRows.map(row => {
    const output: Record<string, string> = { ...row.original }

    // Overwrite/add diagnostic columns with processed values
    output.failure_reason = row.failureReason || 'Unknown error'
    output.mapbox_lat = row.mapboxLat?.toString() || ''
    output.mapbox_lon = row.mapboxLon?.toString() || ''
    output.google_lat = row.googleLat?.toString() || ''
    output.google_lon = row.googleLon?.toString() || ''
    output.google_place_id = row.googlePlaceId || ''

    return output
  })

  return stringify(csvData, {
    header: true,
    columns: allColumns
  })
}

export async function POST(request: NextRequest) {
  const startTime = Date.now()

  try {
    // Require admin auth
    const user = await requireAdmin()
    const supabase = await createServerClient()

    // Get file from form data
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (!file.name.endsWith('.csv')) {
      return NextResponse.json({ error: 'File must be a CSV' }, { status: 400 })
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large (max 10MB)' }, { status: 400 })
    }

    // Parse CSV
    const fileBuffer = await file.arrayBuffer()
    const csvText = new TextDecoder().decode(fileBuffer)
    const filename = file.name

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

    // PREFLIGHT CHECK 1: Hard row limit
    if (csvRows.length > MAX_ROWS) {
      return NextResponse.json(
        { error: `CSV exceeds ${MAX_ROWS} row limit (found ${csvRows.length} rows)` },
        { status: 400 }
      )
    }

    // PREFLIGHT CHECK 2: Check if any rows will need Google validation
    const rowsNeedingGoogleValidation = csvRows.filter(row => {
      const hasLat = row.lat !== undefined && row.lat !== null && String(row.lat).trim() !== ''
      const hasLon = row.lon !== undefined && row.lon !== null && String(row.lon).trim() !== ''
      const hasGooglePlaceId = row.google_place_id && String(row.google_place_id).trim() !== ''

      // Need Google validation if:
      // 1. Missing coordinates (will be geocoded, then validated), OR
      // 2. Has coordinates but no google_place_id (treat as new)
      return (!hasLat || !hasLon) || (hasLat && hasLon && !hasGooglePlaceId)
    })

    // PREFLIGHT CHECK 2a: Google API key (CONDITIONAL - only if needed)
    if (rowsNeedingGoogleValidation.length > 0 && !GOOGLE_PLACES_API_KEY) {
      return NextResponse.json(
        { error: 'Google Places API key not configured on server' },
        { status: 503 }
      )
    }

    // PREFLIGHT CHECK 3: Mapbox token (if needed)
    const rowsNeedingGeocode = csvRows.filter(row => {
      const hasLat = row.lat !== undefined && row.lat !== null && String(row.lat).trim() !== ''
      const hasLon = row.lon !== undefined && row.lon !== null && String(row.lon).trim() !== ''
      return !hasLat || !hasLon
    })

    if (rowsNeedingGeocode.length > 0 && !MAPBOX_TOKEN) {
      return NextResponse.json(
        { error: 'Mapbox token not configured on server' },
        { status: 503 }
      )
    }

    console.log(`Processing ${csvRows.length} rows...`)

    // ==================================================================
    // PHASE 1: VALIDATE (Read-Only - No Database Writes)
    // ==================================================================

    // Step 1: Parse and validate CSV structure
    const processedRows: ProcessedRow[] = csvRows.map((row, index) => {
      const processedRow: ProcessedRow = {
        rowNumber: index + 1,
        original: row,
        name: row.name?.trim() || '',
        address: row.address?.trim() || '',
        brand: row.brand?.trim() || '',
        fascia: (row.fascia?.trim() || row.brand?.trim() || ''),
        category: row.category?.trim() || '',
        postcode: row.postcode?.trim(),
        town: row.town?.trim(),
        failed: false,
        isRetryRow: false,
        skipGoogleValidation: false
      }

      // Validate required fields
      if (!processedRow.name || !processedRow.address || !processedRow.brand || !processedRow.category) {
        processedRow.failed = true
        processedRow.failureReason = 'Missing required fields'
        return processedRow
      }

      // Check for google_place_id in CSV (retry row detection)
      const csvGooglePlaceId = row.google_place_id?.trim()
      if (csvGooglePlaceId && csvGooglePlaceId.length > 0) {
        processedRow.isRetryRow = true
        processedRow.googlePlaceId = csvGooglePlaceId
      }

      // Check for existing coordinates
      const hasLat = row.lat !== undefined && row.lat !== null && String(row.lat).trim() !== ''
      const hasLon = row.lon !== undefined && row.lon !== null && String(row.lon).trim() !== ''

      // Validate retry row format: if google_place_id is present, lat/lon must also be present
      if (processedRow.isRetryRow && (!hasLat || !hasLon)) {
        processedRow.failed = true
        processedRow.failureReason = 'Retry row must have both lat and lon (google_place_id was provided)'
        return processedRow
      }

      if (hasLat && hasLon) {
        const lat = typeof row.lat === 'number' ? row.lat : parseFloat(String(row.lat))
        const lon = typeof row.lon === 'number' ? row.lon : parseFloat(String(row.lon))

        if (!isValidUKCoordinates(lat, lon)) {
          processedRow.failed = true
          processedRow.failureReason = `Invalid coordinates (lat: ${lat}, lon: ${lon})`
          return processedRow
        }

        processedRow.lat = lat
        processedRow.lon = lon
        processedRow.mapboxLat = lat  // Use CSV coords as "Mapbox" coords for validation
        processedRow.mapboxLon = lon

        // If retry row with google_place_id and valid coordinates, skip Google validation
        if (processedRow.isRetryRow) {
          processedRow.skipGoogleValidation = true
        }
      }

      return processedRow
    })

    // Step 2: Mapbox Geocoding
    await batchGeocodeMapbox(processedRows)

    // Step 3: Google Places Validation with Rate Limiting
    await batchValidateGoogle(processedRows, startTime)

    // Step 4: Category Conflict Check
    await checkCategoryConflicts(processedRows, supabase)

    // Step 5: Classify rows before any writes
    const successfulRows = processedRows.filter(r => !r.failed)
    const preWriteFailedRows = processedRows.filter(r => r.failed)
    const retryRowCount = processedRows.filter(r => r.isRetryRow).length
    const skippedValidationCount = processedRows.filter(r => r.skipGoogleValidation).length

    console.log(`Phase 1 complete: ${successfulRows.length} successful, ${preWriteFailedRows.length} failed`)
    if (retryRowCount > 0) {
      console.log(`Retry rows detected: ${retryRowCount} (skipped Google validation: ${skippedValidationCount})`)
    }

    // ==================================================================
    // PHASE 2: MUTATE (Database Writes for Validated Rows Only)
    // ==================================================================

    let insertedCount = 0
    let rebuildTriggered = false
    let queuedForFloorArea = 0

    if (successfulRows.length > 0) {
      console.log('Phase 2: Creating entities and inserting stores...')

      // Track created entities to avoid duplicates
      const brandCache = new Map<string, string>()
      const fasciaCache = new Map<string, string>()
      const categoryCache = new Map<string, string>()

      for (const row of successfulRows) {
        try {
          // Get or create brand
          const brandKey = row.brand.toLowerCase()
          if (!brandCache.has(brandKey)) {
            const brandId = await resolveBrand(row.brand, supabase)
            brandCache.set(brandKey, brandId)
          }
          row.brandId = brandCache.get(brandKey)!

          // Get or create fascia
          const fasciaKey = `${row.brandId}:${row.fascia.toLowerCase()}`
          if (!fasciaCache.has(fasciaKey)) {
            const fasciaId = await resolveFascia(row.fascia, row.brandId, supabase)
            fasciaCache.set(fasciaKey, fasciaId)
          }
          row.fasciaId = fasciaCache.get(fasciaKey)!

          // Get or create category
          const categoryKey = row.category.toLowerCase()
          if (!categoryCache.has(categoryKey)) {
            const categoryId = await resolveCategory(row.category, supabase)
            categoryCache.set(categoryKey, categoryId)
          }
          row.categoryId = categoryCache.get(categoryKey)!

          // Link fascia to category
          await linkFasciaCategory(row.fasciaId, row.categoryId, supabase)
        } catch (error: any) {
          console.error(`Failed to create entities for row ${row.rowNumber}:`, error.message)
          // Move to failed rows
          row.failed = true
          row.failureReason = `Entity creation failed: ${error.message}`
        }
      }

      // Re-filter successful rows after entity creation
      const rowsToInsert = successfulRows.filter(r => !r.failed)
      const postEntityFailedRows = processedRows.filter(r => r.failed)

      if (rowsToInsert.length > 0) {
        // Prepare store inserts
        const insertData = rowsToInsert.map(row => ({
          id: crypto.randomUUID(),
          brand_id: row.brandId!,
          fascia_id: row.fasciaId!,
          name: row.name,
          lat: row.mapboxLat ?? row.lat!,
          lon: row.mapboxLon ?? row.lon!,
          postcode: row.postcode || null,
          town: row.town || null,
          suburb: null,
          county: null,
          address_line_1: row.address,
          address_line_2: null,
          // What the geocoder actually said, in the geocoder's own words. NOT normalised
          // to the existing 'Rooftop' / 'Third Party' / 'Building' values: those came
          // from a different source, and the 25m spatial radius was calibrated on that
          // population alone (plan §4.5). Writing Mapbox's 'rooftop' as 'Rooftop' would
          // silently enrol these stores in a calibration never measured for them — the
          // exact mistake §4.5 talks us out of. Lower case keeps the two populations
          // distinguishable, and the health page groups whatever it finds.
          pqi: row.mapboxAccuracy ?? null,
          open_date: null,
          size_band: null,
          google_place_id: row.googlePlaceId || null,
          // Was there an independent check on this point, and was the geocode precise?
          // A row whose coordinates came from the CSV skipped Google validation, and a
          // coarse Mapbox hit is a street or a town centre rather than a building. Either
          // is worth a human's eye; both were previously recorded as `false` regardless,
          // which is what made the column read as a signal while carrying none.
          geocode_needs_review:
            row.skipGoogleValidation === true || !PRECISE_GEOCODE.has(row.mapboxAccuracy ?? '')
        }))

        // Batch insert stores
        const BATCH_SIZE = 500
        for (let i = 0; i < insertData.length; i += BATCH_SIZE) {
          const batch = insertData.slice(i, i + BATCH_SIZE)
          const { error } = await supabase.from('stores').insert(batch)
          if (error) {
            console.error('Store insertion error:', error.message)
            throw new Error(`Store insertion failed: ${error.message}`)
          }
          insertedCount += batch.length
        }

        queuedForFloorArea = insertData.filter((r) => (r.postcode || '').trim() !== '').length
        console.log(`Inserted ${insertedCount} stores (${queuedForFloorArea} queued for floor-area matching)`)

        // Insert import log
        await supabase.from('store_import_logs').insert({
          user_id: user.id,
          filename,
          total_rows: csvRows.length,
          inserted_rows: insertedCount,
          skipped_rows: 0,
          blocked_rows: postEntityFailedRows.length,
          error_report: {
            skipped: [],
            blocked: postEntityFailedRows.map(r => ({
              rowNumber: r.rowNumber,
              type: 'validation_failed',
              severity: 'error',
              message: r.failureReason || 'Unknown error',
              field: 'unknown'
            }))
          },
          is_dry_run: false
        })

        // Kick floor-area matching for the stores just inserted, fire-and-forget.
        //
        // The daily cron would pick these up anyway — the queue is derived, so nothing is
        // lost if this request never lands — but "anyway" can be up to 24 hours, and an
        // admin who has just imported 400 stores should not have to wait a day to see
        // whether they got sizes. This makes the cron a backstop rather than the only
        // route, which is the same shape as the existing cache_rebuild_queue and its
        // sweeper.
        //
        // Deliberately not awaited and deliberately not inline: this route already spends
        // its 300s budget on geocoding, Google validation and entity resolution, and a
        // matching failure inside it would be hard to see and harder to retry. Failure
        // here costs latency, never correctness.
        const matchUrl = process.env.NEXT_PUBLIC_SITE_URL
          || process.env.NEXT_PUBLIC_BASE_URL
          || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null)
        if (matchUrl && process.env.CRON_SECRET) {
          fetch(`${matchUrl}/api/cron/match-store-floor-areas`, {
            headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
          }).catch((err) => {
            console.warn('Floor-area match trigger failed; the daily cron will catch it:', err?.message)
          })
        }

        // Queue the expensive BUA rebuild instead of tying it to this already-long
        // import request. The cron is the backstop; the extra request below usually
        // starts it immediately in a separate server invocation.
        console.log('Queueing BUA summary rebuild...')
        const rebuildClient = adminClient()
        const { error: queueError } = await rebuildClient
          .from('cache_rebuild_queue')
          .insert({ reason: 'store_import' })

        // 23505 means another pending row already covers this import.
        if (queueError && queueError.code !== '23505') {
          console.error('Failed to queue BUA summary rebuild:', queueError.message)
        } else {
          rebuildTriggered = true

          if (matchUrl && process.env.CRON_SECRET) {
            fetch(`${matchUrl}/api/cron/process-cache-rebuilds`, {
              headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
            }).catch((err) => {
              console.warn('Immediate BUA rebuild trigger failed; the cron will retry:', err?.message)
            })
          }
        }
      }
    }

    const finalFailedRows = processedRows.filter(r => r.failed)
    const finalSuccessfulRows = processedRows.filter(r => !r.failed)

    // Generate failed CSV
    const failedCSV = generateFailedCSV(processedRows)

    // Build successful stores list
    const successfulStores: SuccessfulStore[] = finalSuccessfulRows
      .map(r => ({
        name: r.name,
        address: r.address,
        brand: r.brand,
        fascia: r.fascia,
        category: r.category
      }))

    const response: UploadResponse = {
      success: true,
      successfulStores,
      failedStoresCSV: failedCSV,
      insertedCount,
      failedCount: finalFailedRows.length,
      rebuildTriggered,
      // Every inserted store with a postcode is in the floor-area queue by construction:
      // the queue is derived from having no match row, and a new store has none. A store
      // without a postcode is not queued, because the matcher looks up candidates by
      // postcode and has nothing to offer it.
      queuedForFloorArea
    }

    const elapsed = Date.now() - startTime
    console.log(`Total processing time: ${Math.round(elapsed / 1000)}s`)

    return NextResponse.json(response)
  } catch (error: any) {
    console.error('Upload endpoint error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to process import' },
      { status: 500 }
    )
  }
}

// Store Import Types
// Purpose: Type definitions for the simplified store import pipeline

// CSV Row as parsed from file
export interface CSVRow {
  name: string
  address: string
  brand: string
  fascia?: string
  category: string
  postcode?: string
  town?: string
  suburb?: string
  county?: string
  lat?: number | string
  lon?: number | string
  google_place_id?: string  // For retry imports with manually corrected coordinates
  address_line_1?: string
  address_line_2?: string
  pqi?: string
  open_date?: string
  size_band?: string
  // Allow arbitrary additional columns
  [key: string]: any
}

// Validated and enriched row ready for import
export interface ValidatedStoreRow {
  // Original CSV data
  name: string
  address: string
  brandName: string
  fasciaName: string
  categoryName: string

  // Resolved entity IDs
  brandId: string
  fasciaId: string
  categoryId: string

  // Geocoded/validated coordinates
  lat: number
  lon: number

  // Optional fields
  postcode?: string
  town?: string
  suburb?: string
  county?: string
  address_line_1?: string
  address_line_2?: string
  pqi?: string
  open_date?: string
  size_band?: string

  // Metadata
  rowNumber: number

  // Google validation (NEW - compliance-safe approach)
  googlePlaceId?: string
  geocodeNeedsReview?: boolean
}

// Issue types
export type IssueType =
  | 'missing_required_field'
  | 'invalid_coordinates'
  | 'category_conflict'
  | 'geocode_failed'
  | 'fuzzy_brand_match'
  | 'fascia_duplication'
  | 'google_validation_warning'   // NEW: Large distance between Mapbox and Google
  | 'google_validation_failed'    // NEW: Google API failed
  | 'google_quota_exceeded'       // NEW: Google quota exceeded

export type IssueSeverity = 'error' | 'warning' | 'info'

// Issue details for a single row
export interface RowIssue {
  rowNumber: number
  type: IssueType
  severity: IssueSeverity
  message: string
  field?: string
  suggestion?: string
  data?: Record<string, any>
}

// Successful store in response
export interface SuccessfulStore {
  name: string
  address: string
  brand: string
  fascia: string
  category: string
}

// Upload/Import response from new simplified API
export interface UploadResponse {
  success: boolean
  successfulStores: SuccessfulStore[]
  failedStoresCSV: string  // CSV string with all failed rows + failure reasons
  insertedCount: number
  failedCount: number
  rebuildTriggered: boolean
  // Inserted stores that carry a postcode, and so are in the floor-area matching queue.
  // Optional because a response from a deploy that predates it will not carry the field.
  queuedForFloorArea?: number
  error?: string
}

// LEGACY: Preview response from old API (will be removed)
export interface ImportPreviewResponse {
  // Summary counts
  totalRows: number
  validRows: number
  rowsWithIssues: number

  // Entity changes
  newBrands: string[]
  newFascias: string[]
  newCategories: string[]
  existingBrands: string[]
  existingFascias: string[]
  existingCategories: string[]

  // Issues breakdown
  errors: RowIssue[]   // Blocking issues (will be blocked/skipped)
  warnings: RowIssue[] // Non-blocking warnings (user should verify)
  infos: RowIssue[]    // Informational notices

  // Preview data (first 20 rows with validation status)
  previewRows: Array<{
    rowNumber: number
    data: CSVRow
    issues: RowIssue[]
    status: 'valid' | 'error' | 'warning'
  }>

  // Validation flags
  hasErrors: boolean
  hasWarnings: boolean
  canProceed: boolean
}

// LEGACY: Execute response from old API (will be removed)
export interface ImportExecuteResponse {
  success: boolean
  isDryRun: boolean

  // Import results
  insertedCount: number
  skippedCount: number
  blockedCount: number

  // Entity changes
  brandsCreated: number
  fasciasCreated: number
  categoriesCreated: number

  // Detailed results
  skippedRows: RowIssue[]
  blockedRows: RowIssue[]

  // NEW: Validation warnings (for dry-run mode)
  validationWarnings?: RowIssue[]
  googleValidationsAttempted?: number
  googleValidationsSucceeded?: number

  // Cache statistics (for live import)
  cacheHits?: number
  cacheMisses?: number

  // Rebuild status
  rebuildTriggered: boolean
  rebuildMessage?: string

  // Log reference
  importLogId?: string

  // Error if failed
  error?: string
}

// Rebuild response from API
export interface RebuildResponse {
  success: boolean
  progress: string[]
  message?: string
  error?: string
}

// Import log entry
export interface ImportLog {
  id: string
  user_id: string | null
  filename: string
  total_rows: number
  inserted_rows: number
  skipped_rows: number
  blocked_rows: number
  error_report: {
    skipped: RowIssue[]
    blocked: RowIssue[]
  } | null
  is_dry_run: boolean
  created_at: string
}

// Fuzzy match result
export interface FuzzyBrandMatch {
  existingBrandId: string
  existingBrandName: string
  csvBrandName: string
  similarity: number
}

// Category conflict
export interface CategoryConflict {
  fasciaName: string
  fasciaId: string
  existingCategoryName: string
  existingCategoryId: string
  csvCategoryName: string
  csvCategoryId: string
}

// Google validation result (NEW)
export interface GoogleValidationResult {
  success: boolean
  placeId?: string
  location?: { lat: number; lon: number }
  formattedAddress?: string
  distanceMeters?: number
  error?: string
  quotaExceeded?: boolean
}

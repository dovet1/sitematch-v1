// Store Import Types
// Purpose: Type definitions for the store import pipeline

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
  address_line_1?: string
  address_line_2?: string
  pqi?: string
  open_date?: string
  size_band?: string
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
}

// Issue types
export type IssueType =
  | 'missing_required_field'
  | 'invalid_coordinates'
  | 'duplicate'
  | 'category_conflict'
  | 'geocode_failed'
  | 'fuzzy_brand_match'
  | 'fascia_duplication'

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

// Preview response from API
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

// Execute response from API
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

// Duplicate store match
export interface DuplicateStoreMatch {
  existingStoreId: string
  existingStoreName: string
  existingBrandId: string
  existingFasciaId: string
  distance: number
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

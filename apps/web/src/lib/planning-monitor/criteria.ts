import { z } from 'zod'

/**
 * Planning Monitor criteria, version 1.
 *
 * Saved with every patch revision, so the meaning of a stored v1 document must never change.
 * Filters added later (use class, site area, floorspace, commercial category, operator) arrive
 * as new optional groups behind a server-owned capability. Their absence means "no restriction",
 * never "the fact must exist", and a document naming a group the server has not enabled is
 * rejected rather than silently broadened. See docs/planning-monitor-implementation-plan.md §4.
 */
export const CRITERIA_VERSION = 1

/** The confirmed launch floor: residential schemes of 15 or more homes. Users may raise it, never lower it. */
export const MIN_RESIDENTIAL_DWELLINGS = 15
export const DWELLING_PRESETS = [15, 50, 100] as const

/** Plota's normalised decision stages. `other` also covers `decided` without a recorded outcome. */
export const STAGES = ['pending', 'approved', 'refused', 'withdrawn', 'other'] as const
export type MonitorStage = (typeof STAGES)[number]

/**
 * Procedures offered at launch, each mapped to Plota's normalised `procedure` values. Follow-on
 * paperwork (discharges and amendments) is a single choice because a user thinks of it as one kind.
 */
export const PROCEDURES = {
  full: ['full'],
  outline: ['outline'],
  reserved_matters: ['reserved-matters'],
  prior_approval: ['prior-approval'],
  paperwork: ['discharge', 'amendment'],
  other: ['other', 'lawful-dev-cert', 'listed-building', 'advert-consent', 'householder', 'tree-works',
    'eia-opinion', 'pre-application', 'planning-obligation'],
} as const
export type MonitorProcedure = keyof typeof PROCEDURES

/** The existing Planning tab's commercial scheme contract (`commercial_work`), less `minor`. */
export const COMMERCIAL_WORK = ['new', 'extension', 'to-commercial', 'between', 'loss'] as const
export type CommercialWork = (typeof COMMERCIAL_WORK)[number]

export const DATE_FIELDS = ['received', 'validated', 'decided'] as const
export type DateField = (typeof DATE_FIELDS)[number]

export const DATE_PRESETS = ['7d', '30d', '90d', 'this_year', 'all', 'custom'] as const
export type DatePreset = (typeof DATE_PRESETS)[number]

export const MAX_STORE_RADIUS_METERS = 50_000
export const MAX_KEYWORDS = 10
export const MAX_KEYWORD_LENGTH = 60
export const MAX_BRANDS = 25

/**
 * Groups reserved for the enrichment follow-on. Named here so a v1 document that carries one is
 * refused with a clear message instead of being parsed as an unknown key and dropped.
 */
export const FOLLOW_ON_FILTERS = ['useClasses', 'siteArea', 'floorspace', 'commercialCategories', 'operatorIds'] as const
export type FollowOnFilter = (typeof FOLLOW_ON_FILTERS)[number]

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a YYYY-MM-DD date')
const uuid = z.string().uuid()
const keyword = z.string().trim().min(1).max(MAX_KEYWORD_LENGTH)

export const criteriaSchema = z
  .object({
    version: z.literal(CRITERIA_VERSION),
    residential: z.object({
      enabled: z.boolean(),
      minDwellings: z.number().int().min(MIN_RESIDENTIAL_DWELLINGS).max(100_000),
    }),
    commercial: z.object({
      enabled: z.boolean(),
      /** Empty means every commercial scheme the base rule admits, including those of unknown work type. */
      work: z.array(z.enum(COMMERCIAL_WORK)).max(COMMERCIAL_WORK.length),
    }),
    dates: z.object({
      field: z.enum(DATE_FIELDS),
      preset: z.enum(DATE_PRESETS),
      from: isoDate.nullable(),
      to: isoDate.nullable(),
    }),
    /** Empty means every stage. */
    stages: z.array(z.enum(STAGES)).max(STAGES.length),
    /** Empty means every procedure. */
    procedures: z.array(z.enum(Object.keys(PROCEDURES) as [MonitorProcedure, ...MonitorProcedure[]])),
    proximity: z
      .object({
        brandIds: z.array(uuid).min(1).max(MAX_BRANDS),
        radiusMeters: z.number().int().min(100).max(MAX_STORE_RADIUS_METERS),
      })
      .nullable(),
    keywords: z.object({
      include: z.array(keyword).max(MAX_KEYWORDS),
      exclude: z.array(keyword).max(MAX_KEYWORDS),
    }),
    watchedOnly: z.boolean(),
    exactLocationsOnly: z.boolean(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (!value.residential.enabled && !value.commercial.enabled) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['residential'], message: 'Choose residential, commercial, or both' })
    }
    if (value.dates.preset === 'custom') {
      if (!value.dates.from && !value.dates.to) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['dates'], message: 'A custom range needs a start or end date' })
      }
      if (value.dates.from && value.dates.to && value.dates.from > value.dates.to) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['dates'], message: 'The start date must not be after the end date' })
      }
    }
  })

export type MonitorCriteria = z.infer<typeof criteriaSchema>

export function defaultCriteria(): MonitorCriteria {
  return {
    version: CRITERIA_VERSION,
    residential: { enabled: true, minDwellings: MIN_RESIDENTIAL_DWELLINGS },
    commercial: { enabled: true, work: [] },
    dates: { field: 'received', preset: '30d', from: null, to: null },
    stages: [],
    procedures: [],
    proximity: null,
    keywords: { include: [], exclude: [] },
    watchedOnly: false,
    exactLocationsOnly: false,
  }
}

/** What the server currently supports. The UI renders controls from this, and the API refuses anything outside it. */
export interface FilterCapabilities {
  version: number
  criteriaVersion: number
  enabled: FollowOnFilter[]
}

/** Launch capabilities: only core filters. Bump `version` whenever a follow-on filter is enabled or withdrawn. */
export const CAPABILITIES: FilterCapabilities = { version: 1, criteriaVersion: CRITERIA_VERSION, enabled: [] }

export type CriteriaParseResult =
  | { ok: true; criteria: MonitorCriteria }
  | { ok: false; error: string; unavailable?: FollowOnFilter[] }

/**
 * Validate and normalise untrusted criteria. Normalisation makes equal intent produce equal
 * documents, so the hash (and every cache keyed on it) does not split on list order or case.
 */
export function parseCriteria(input: unknown, capabilities: FilterCapabilities = CAPABILITIES): CriteriaParseResult {
  if (input && typeof input === 'object') {
    const unavailable = FOLLOW_ON_FILTERS.filter(
      (key) => key in (input as Record<string, unknown>) && !capabilities.enabled.includes(key)
    )
    if (unavailable.length > 0) {
      return { ok: false, error: `Filter not yet available: ${unavailable.join(', ')}`, unavailable }
    }
  }
  const parsed = criteriaSchema.safeParse(input)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    const where = issue.path.length ? `${issue.path.join('.')}: ` : ''
    return { ok: false, error: `${where}${issue.message}` }
  }
  return { ok: true, criteria: normaliseCriteria(parsed.data) }
}

function sortedUnique<T extends string>(values: readonly T[]): T[] {
  return [...new Set(values)].sort()
}

function normaliseKeywords(values: string[]): string[] {
  return sortedUnique(values.map((value) => value.trim().toLowerCase()).filter(Boolean))
}

export function normaliseCriteria(criteria: MonitorCriteria): MonitorCriteria {
  const stages = sortedUnique(criteria.stages)
  const procedures = sortedUnique(criteria.procedures)
  const work = sortedUnique(criteria.commercial.work)
  const custom = criteria.dates.preset === 'custom'
  return {
    version: CRITERIA_VERSION,
    residential: { ...criteria.residential },
    // Selecting every work type is the same as selecting none: both mean no narrowing.
    commercial: { enabled: criteria.commercial.enabled, work: work.length === COMMERCIAL_WORK.length ? [] : work },
    dates: {
      field: criteria.dates.field,
      preset: criteria.dates.preset,
      from: custom ? criteria.dates.from : null,
      to: custom ? criteria.dates.to : null,
    },
    stages: stages.length === STAGES.length ? [] : stages,
    procedures: procedures.length === Object.keys(PROCEDURES).length ? [] : procedures,
    proximity: criteria.proximity
      ? { brandIds: sortedUnique(criteria.proximity.brandIds), radiusMeters: criteria.proximity.radiusMeters }
      : null,
    keywords: {
      include: normaliseKeywords(criteria.keywords.include),
      exclude: normaliseKeywords(criteria.keywords.exclude),
    },
    watchedOnly: criteria.watchedOnly,
    exactLocationsOnly: criteria.exactLocationsOnly,
  }
}

/** Stable JSON: object keys sorted recursively, so the hash depends only on content. */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(',')}}`
  }
  return JSON.stringify(value)
}


/** The calendar window a preset covers on a given day, as inclusive ISO dates. Europe/London calendar. */
export function resolveDateWindow(
  dates: MonitorCriteria['dates'],
  today: string = londonToday()
): { from: string | null; to: string | null } {
  const minus = (days: number) => {
    const at = new Date(`${today}T00:00:00Z`)
    at.setUTCDate(at.getUTCDate() - days)
    return at.toISOString().slice(0, 10)
  }
  switch (dates.preset) {
    case '7d':
      return { from: minus(7), to: null }
    case '30d':
      return { from: minus(30), to: null }
    case '90d':
      return { from: minus(90), to: null }
    case 'this_year':
      return { from: `${today.slice(0, 4)}-01-01`, to: null }
    case 'all':
      return { from: null, to: null }
    case 'custom':
      return { from: dates.from, to: dates.to }
  }
}

export function londonToday(now: Date = new Date()): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
}

/** Escape LIKE wildcards so a keyword matches literally. */
export function likePattern(keyword: string): string {
  return `%${keyword.replace(/[\\%_]/g, (c) => `\\${c}`)}%`
}

/**
 * The flat predicate the database functions evaluate. Built here, in one place, so the list,
 * count, clusters and weekly selection cannot drift apart. Temporal fields are optional because
 * the weekly digest applies its own change window instead of the map's date filter.
 */
export interface MonitorPredicate {
  residential: boolean
  min_dwellings: number
  commercial: boolean
  commercial_work: CommercialWork[] | null
  date_field: DateField
  date_from: string | null
  date_to: string | null
  stages: MonitorStage[] | null
  procedures: string[] | null
  brand_ids: string[] | null
  radius_m: number | null
  include: string[] | null
  exclude: string[] | null
  exact_only: boolean
  watched_application_ids: string[] | null
  /** Restrict to these records (weekly selection over changed applications). */
  application_ids?: string[] | null
  boundary: GeoJSON.Polygon | GeoJSON.MultiPolygon | null
  bbox: [number, number, number, number] | null
}

export function buildPredicate(
  criteria: MonitorCriteria,
  options: {
    boundary: GeoJSON.Polygon | GeoJSON.MultiPolygon | null
    bbox?: [number, number, number, number] | null
    watchedApplicationIds?: string[]
    applyDates?: boolean
    today?: string
  }
): MonitorPredicate {
  const window = options.applyDates === false ? { from: null, to: null } : resolveDateWindow(criteria.dates, options.today)
  return {
    residential: criteria.residential.enabled,
    min_dwellings: Math.max(MIN_RESIDENTIAL_DWELLINGS, criteria.residential.minDwellings),
    commercial: criteria.commercial.enabled,
    commercial_work: criteria.commercial.work.length ? criteria.commercial.work : null,
    date_field: criteria.dates.field,
    date_from: window.from,
    date_to: window.to,
    stages: criteria.stages.length ? criteria.stages : null,
    procedures: criteria.procedures.length ? criteria.procedures.flatMap((p) => [...PROCEDURES[p]]) : null,
    brand_ids: criteria.proximity?.brandIds ?? null,
    radius_m: criteria.proximity?.radiusMeters ?? null,
    include: criteria.keywords.include.length ? criteria.keywords.include.map(likePattern) : null,
    exclude: criteria.keywords.exclude.length ? criteria.keywords.exclude.map(likePattern) : null,
    exact_only: criteria.exactLocationsOnly,
    // Watched-only with nothing watched must match nothing, not everything.
    watched_application_ids: criteria.watchedOnly ? options.watchedApplicationIds ?? [] : null,
    boundary: options.boundary,
    bbox: options.bbox ?? null,
  }
}

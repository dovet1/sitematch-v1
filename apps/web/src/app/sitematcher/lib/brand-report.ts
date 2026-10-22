// Brand report rules (docs/design_handoff_brand_report_export). Pure: shared by the report route
// (which strips contacts) and the report template (pagination and generated sentences), and
// unit-tested on its own.

import {
  BLOCKER_MILES,
  CAUTION_MILES,
  tradingAreaLine,
  classLabel,
  formatMiles,
  formatMoney,
  formatNewsScore,
  formatSqft,
  formatSqftShort,
  type SignalStatus,
  turnoverLabel,
} from './brand-matcher'
import type {
  BrandMatch,
  BrandMatcherSite,
  BrandReportBrand,
  BrandReportMeta,
  BrandReportPaper,
  BrandStoreTownsResponse,
  FiledFigure,
  RequirementItem,
  TradingFacts,
} from '../types/brand-matcher'

// ---------------------------------------------------------------------------
// Contact stripping
// ---------------------------------------------------------------------------

// Builds the report's copy of a match field by field. Never spread the match: a field added to
// BrandMatch later must be chosen here before it can reach a shared report.
export function toReportBrand(m: BrandMatch, storeTowns: BrandStoreTownsResponse | null): BrandReportBrand {
  return {
    brandId: m.brandId,
    name: m.name,
    logoUrl: m.logoUrl,
    domain: m.domain,
    category: m.category,
    storeCount: m.storeCount,
    size: m.size,
    useClass: m.useClass,
    acquisitive: m.acquisitive,
    tradingFacts: m.tradingFacts,
    franchise: m.franchise ?? null,
    locationType: m.locationType,
    nearest: m.nearest,
    typicalRange: m.typicalRange,
    ...(m.townMatch !== undefined ? { townMatch: m.townMatch } : {}),
    score: m.score,
    scoreParts: m.scoreParts,
    storeTowns,
  }
}

// ---------------------------------------------------------------------------
// Order and pagination
// ---------------------------------------------------------------------------

// Rank order follows fit, not the order brands were ticked.
export function byFit<T extends Pick<BrandMatch, 'score' | 'name'>>(brands: T[]): T[] {
  return [...brands].sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
}

export const SUMMARY_ROWS_PER_PAGE = 12

// Cover, then the summary (12 brands a page), then one page per brand.
export function reportPageCount(brands: number): number {
  return 1 + Math.max(1, Math.ceil(brands / SUMMARY_ROWS_PER_PAGE)) + brands
}

// Fixed page boxes at 96dpi. The tallest brand page was checked against Letter.
export const PAPER: Record<BrandReportPaper, { width: number; height: number; css: string; label: string }> = {
  a4: { width: 794, height: 1123, css: 'A4', label: 'A4' },
  letter: { width: 816, height: 1056, css: 'letter', label: 'US Letter' },
}

export const EMPTY_REPORT_META: BrandReportMeta = {
  preparedFor: '',
  preparedBy: '',
  company: '',
  note: '',
  paper: 'a4',
}

// Saved meta, or null when it is not a usable record.
export function parseReportMeta(raw: unknown): Partial<BrandReportMeta> | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const text = (k: string) => (typeof r[k] === 'string' ? (r[k] as string) : undefined)
  const out: Partial<BrandReportMeta> = {}
  for (const k of ['preparedFor', 'preparedBy', 'company', 'note'] as const) {
    const v = text(k)
    if (v !== undefined) out[k] = v
  }
  if (r.paper === 'a4' || r.paper === 'letter') out.paper = r.paper
  return out
}

// "SiteMatcher brand report – Aldi – CT1 1XU". Characters a file system rejects are dropped.
export function reportFileName(preparedFor: string, postcode: string): string {
  const parts = ['SiteMatcher brand report', preparedFor.trim(), postcode].filter(Boolean)
  return parts
    .join(' – ')
    .replace(/[\\/:*?"<>|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// ---------------------------------------------------------------------------
// Presentation
// ---------------------------------------------------------------------------

export type ReportTone = 'ok' | 'warn' | 'bad' | 'none'

export const REPORT_TONE: Record<SignalStatus, ReportTone> = {
  good: 'ok',
  caution: 'warn',
  poor: 'bad',
  none: 'none',
}

// The town the cover and the running header name: the site's built-up area, else its centre.
export function siteTownName(site: BrandMatcherSite): string | null {
  return site.town?.name ?? site.centre?.name ?? null
}

export function reportDate(d: Date): string {
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return n === 1 ? one : many
}

function counted(n: number, one: string, many = `${one}s`): string {
  return `${n.toLocaleString('en-GB')} ${plural(n, one, many)}`
}

export function listPhrase(items: string[]): string {
  if (items.length <= 1) return items[0] ?? ''
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
}

export function sqftRange(min: number | null, max: number | null): string {
  if (min != null && max != null) return `${formatSqftShort(min)}–${formatSqftShort(max)} sq ft`
  if (min != null) return `${formatSqftShort(min)}+ sq ft`
  if (max != null) return `Up to ${formatSqftShort(max)} sq ft`
  return 'No size stated'
}

// The live requirement the size verdict was read against, when it was one.
export function liveRequirement(
  b: Pick<BrandMatch, 'size'>
): { min: number | null; max: number | null; postedAt: string | null } | null {
  return b.size.basis === 'requirement'
    ? {
        min: b.size.rangeMin,
        max: b.size.rangeMax,
        postedAt: b.size.postedAt ?? null,
      }
    : null
}

// Size chart scale: 0 to at least 3k, in steps of 1, 2 or 5 times a power of ten (at most six).
export function sizeScale(values: number[]): { max: number; ticks: number[] } {
  const top = Math.max(3000, ...values.filter((v) => Number.isFinite(v)))
  let step = 1000
  for (let pow = 1000; ; pow *= 10) {
    const found = [1, 2, 5].map((s) => s * pow).find((s) => Math.ceil(top / s) <= 6)
    if (found) {
      step = found
      break
    }
  }
  const max = Math.ceil(top / step) * step
  const ticks: number[] = []
  for (let t = 0; t <= max; t += step) ticks.push(t)
  return { max, ticks }
}

// ---------------------------------------------------------------------------
// Generated sentences (handoff "Copy rules")
// ---------------------------------------------------------------------------

export function sizeLine(b: Pick<BrandMatch, 'name' | 'size' | 'typicalRange'>, sqft: number): string {
  const name = b.name
  const req = liveRequirement(b)
  const typical = b.typicalRange
  const site = formatSqft(sqft)
  if (!typical && !req) return `We don't hold a typical store size or a live requirement for ${name}.`
  const state = b.size.state
  if (state === 'fits') {
    if (!req) return `Your ${site} sq ft sits inside the typical size of ${name}'s existing stores.`
    const inTypical = !!typical && sqft >= typical.min && sqft <= typical.max
    return inTypical
      ? `Your ${site} sq ft sits inside the size range of ${name}'s existing stores and its live requirement.`
      : `Your ${site} sq ft sits inside ${name}'s live requirement.`
  }
  if (state === 'lower_end' || state === 'upper_end') {
    const lower = state === 'lower_end'
    return `Your ${site} sq ft is at the ${lower ? 'lower' : 'upper'} end of ${name}'s store sizes: ${lower ? 'smaller' : 'larger'} than most, but within the range it trades from.`
  }
  return `Your ${site} sq ft is a little ${state === 'larger' ? 'larger' : 'smaller'} than ${req ? `${name}'s live requirement` : `${name}'s stores`}, but close enough to be worth a call.`
}

export function useClassLine(b: Pick<BrandMatch, 'name' | 'useClass'>, queryUseClass: string): string {
  const u = b.useClass
  if (!u) return `${b.name}'s requirements don't state a use class, so this isn't scored.`
  const theirs = u.codes.map(classLabel).join(', ')
  if (queryUseClass === 'All')
    return `${b.name}'s requirements ask for ${theirs}. Check this against your site's use class.`
  return u.matches
    ? `${b.name} typically trades under ${classLabel(queryUseClass)}, the same as your site.`
    : `${b.name}'s requirements ask for ${theirs}, and your site is ${classLabel(queryUseClass)}. It may need a change of use.`
}

export function acquisitiveLine(b: Pick<BrandMatch, 'name' | 'acquisitive'>): string {
  const a = b.acquisitive
  if (!a) return `We haven't found requirements, news or planning applications for ${b.name}, so its news score is 0.`
  if (a.level === 'low' && a.news)
    return `${counted(a.news.count, 'news article')} about ${b.name} ${a.news.count === 1 ? 'suggests' : 'suggest'} it is not acquiring at the moment (news score ${formatNewsScore(a.news.score)}).`
  const reqs = a.requirements
  const sources = [
    reqs ? `${counted(reqs.count, 'requirement')} listed with SiteMatcher` : null,
    a.news ? `${counted(a.news.count, 'news article')} (news score ${formatNewsScore(a.news.score)})` : null,
    a.planning ? `${counted(a.planning.count, 'planning application')} naming ${b.name}` : null,
  ].filter((x): x is string => !!x)
  const total = (reqs?.count ?? 0) + (a.news?.count ?? 0) + (a.planning?.count ?? 0)
  const lead = `${listPhrase(sources)} ${total === 1 ? 'points' : 'point'} to an active opening programme.`
  const coverage =
    a.level === 'high'
      ? reqs && reqs.nearbyPlaces.length > 0
        ? ` Its requirements target ${listPhrase(reqs.nearbyPlaces)}, within reach of your site.`
        : reqs?.nationwide
          ? " Its requirements don't list target locations, so your area isn't ruled out."
          : ''
      : reqs
        ? " Its requirements don't name your area, so it may not be looking here yet."
        : ' None of it is a requirement covering your area.'
  return lead + coverage
}

// "900–1.4k sq ft, Alton, Ascot, Ashford and 91 more".
export function requirementSummary(r: RequirementItem): string {
  const places =
    r.places.length > 3 ? `${r.places.slice(0, 3).join(', ')} and ${r.places.length - 3} more` : r.places.join(', ')
  return [
    r.sizeMin != null || r.sizeMax != null ? sqftRange(r.sizeMin, r.sizeMax) : null,
    places || 'no target locations listed',
  ]
    .filter(Boolean)
    .join(', ')
}

export function demographicsLine(b: Pick<BrandMatch, 'name' | 'townMatch'>, site: BrandMatcherSite): string {
  const town = site.town
  const t = b.townMatch
  if (town === undefined) return "Census figures weren't available for this search."
  if (!town) return "Your site isn't in a town we hold census figures for, so this isn't scored."
  if (!t) return `Not enough ${b.name} store locations to compare demographics.`
  if (t.band === 'close') {
    const towns = t.closeTowns === 1 ? 'a town' : `${t.closeTowns.toLocaleString('en-GB')} towns`
    const closest = t.bestTown && t.bestTown !== town.name ? `, the closest being ${t.bestTown}` : ''
    return `${counted(t.closeStores, 'store')} of ${b.name}'s ${t.townStores.toLocaleString('en-GB')} ${t.closeStores === 1 ? 'is' : 'are'} in ${towns} like ${town.name}${closest}.`
  }
  if (t.band === 'partial')
    return `None of ${b.name}'s stores is in a town quite like ${town.name}, but ${t.bestTown ?? 'one'} comes near.`
  return `None of ${b.name}'s stores is in a town like ${town.name}. The nearest match is ${t.bestTown ?? 'not close'}.`
}

export function nearestLine(b: Pick<BrandMatch, 'name' | 'nearest'>): string {
  const n = b.nearest
  if (!n) return `We haven't found any UK stores for ${b.name}, so there's nothing to measure distance from.`
  if (n.miles < BLOCKER_MILES)
    return `An existing ${b.name} store is only ${formatMiles(n.miles)} away, which is likely to block a new opening.`
  if (n.miles < CAUTION_MILES)
    return `An existing ${b.name} store is ${formatMiles(n.miles)} away, so a new store here may compete with it.`
  return tradingAreaLine(b.name, n)
}

// ---------------------------------------------------------------------------
// Financials
// ---------------------------------------------------------------------------

function figureText(f: FiledFigure): string | null {
  if (f.status === 'filed' || f.status === 'extracted') return formatMoney(f.value)
  if (f.status === 'not_published') return 'Not disclosed'
  return null
}

function longDate(iso: string): string {
  return new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

// Companies House facts as filed, in the order the Financials panel shows them. Unknown rows drop.
export function financialRows(facts: TradingFacts): { label: string; value: string; tone?: 'bad' | 'muted' }[] {
  const rows: {
    label: string
    value: string | null
    tone?: 'bad' | 'muted'
  }[] = [
    { label: 'Company name', value: facts.companyName },
    { label: 'Company number', value: facts.companyNumber },
    { label: 'Company status', value: facts.status },
    { label: turnoverLabel(facts), value: figureText(facts.turnover) },
    { label: 'Net assets', value: figureText(facts.netAssets) },
    {
      label: 'Accounts filed',
      value: facts.accountsOverdue ? 'Overdue' : facts.accountsMadeUpTo ? 'On time' : 'None filed yet',
      tone: facts.accountsOverdue ? 'bad' : undefined,
    },
    { label: 'Accounts type', value: facts.accountsType },
    {
      label: 'Accounts made up to',
      value: facts.accountsMadeUpTo ? longDate(facts.accountsMadeUpTo) : null,
    },
  ]
  return rows
    .filter((r): r is { label: string; value: string; tone?: 'bad' | 'muted' } => r.value != null)
    .map((r) => (r.value === 'Not disclosed' ? { ...r, tone: 'muted' as const } : r))
}

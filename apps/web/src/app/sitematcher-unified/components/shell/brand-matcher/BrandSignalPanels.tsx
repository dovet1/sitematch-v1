'use client'

import { useEffect, useState } from 'react'
import {
  BLOCKER_MILES,
  CAUTION_MILES,
  classLabel,
  CONTACT_CORRECTIONS_EMAIL,
  formatMiles,
  formatMoney,
  formatSqft,
  formatSqftShort,
  formLabel,
  LOCATION_TYPE_RADIUS_MILES,
  TOWN_MATCH_AFFLUENCE_POINTS,
  TOWN_MATCH_POPULATION_RATIO,
} from '../../../lib/brand-matcher'
import { fetchBrandStoreTowns } from '../../../lib/services/brand-matcher-service'
import { formatPeople } from '../../../lib/brand-matcher-demographics'
import type {
  BrandMatch,
  BrandMatcherQuery,
  BrandMatcherSite,
  BrandStoreTown,
  FiledFigure,
  TownFigures,
  TownMatchBand,
  RequirementItem,
  TradingFacts,
} from '../../../types/brand-matcher'
import { companiesHouseUrl } from '@/lib/companies-house/facts'
import {
  EmptyPanel,
  Footnote,
  KvRows,
  listPhrase,
  PANEL_LINK,
  PanelTitle,
  plural,
  shortDate,
} from './BrandMatcherUi'

// Right-hand panels of the expanded Brand Matcher card, one per signal
// (docs/design_handoff_brand_matcher_signals §2). Every value comes from the match payload; a
// signal we hold nothing for shows its empty state and is left out of the score.

type PanelProps = { match: BrandMatch; query: BrandMatcherQuery }

function sqftRangeText(min: number | null, max: number | null): string {
  if (min != null && max != null) return `${formatSqftShort(min)}–${formatSqftShort(max)} sq ft`
  if (min != null) return `${formatSqftShort(min)}+ sq ft`
  if (max != null) return `Up to ${formatSqftShort(max)} sq ft`
  return 'No size stated'
}

function rangeShort(min: number | null, max: number | null): string {
  if (min != null && max != null) return `${formatSqftShort(min)}–${formatSqftShort(max)}`
  if (min != null) return `${formatSqftShort(min)}+`
  return `up to ${formatSqftShort(max ?? 0)}`
}

// ---------------------------------------------------------------------------
// Size fit
// ---------------------------------------------------------------------------

const SIZE_VERDICT: Record<BrandMatch['size']['state'], string> = {
  fits: 'fits',
  lower_end: 'lower end',
  upper_end: 'upper end',
  larger: 'above range',
  smaller: 'below range',
}

// A round upper bound for the scale: 1, 2 or 5 times a power of ten, in thirds.
function scaleMax(n: number): number {
  const target = n * 1.15
  const pow = 10 ** Math.floor(Math.log10(target))
  for (const step of [1.5, 3, 6, 15]) if (step * pow >= target) return step * pow
  return 30 * pow
}

export function SizePanel({ match, query }: PanelProps) {
  const name = match.name
  const site = query.sqft
  const typical = match.typicalRange
  const req =
    match.size.basis === 'requirement'
      ? { min: match.size.rangeMin, max: match.size.rangeMax, postedAt: match.size.postedAt ?? null }
      : null
  // A requirement can be listed without a size; say so rather than "none".
  const reqListed = !!match.acquisitive?.requirements

  if (!typical && !req) {
    return (
      <div className="flex flex-col gap-4">
        <PanelTitle title="Size fit: not enough data">
          We don&apos;t hold a typical store size or a live requirement for {name}, so we can&apos;t say whether{' '}
          {formatSqft(site)} sq ft fits. This signal is left out of the score.
        </PanelTitle>
        <SizeBar site={site} typical={null} req={null} />
        <KvRows
          rows={[
            { label: 'Your site', value: `${formatSqft(site)} sq ft` },
            { label: 'Typical store', value: 'Not known', muted: true },
            { label: 'Live requirement', value: reqListed ? 'No size stated' : 'None listed with us', muted: true },
          ]}
        />
      </div>
    )
  }

  const inTypical = !!typical && site >= typical.min && site <= typical.max
  const state = match.size.state
  let summary: string
  if (state === 'fits') {
    summary = req
      ? inTypical
        ? `Your ${formatSqft(site)} sq ft sits inside the size range of ${name}'s existing stores and its live requirement.`
        : `Your ${formatSqft(site)} sq ft sits inside ${name}'s live requirement.`
      : `Your ${formatSqft(site)} sq ft sits inside the typical size of ${name}'s existing stores.`
  } else if (state === 'lower_end' || state === 'upper_end') {
    summary = `Your ${formatSqft(site)} sq ft is at the ${state === 'lower_end' ? 'lower' : 'upper'} end of ${name}'s store sizes: ${state === 'lower_end' ? 'smaller' : 'larger'} than most, but within the range it trades from.`
  } else {
    summary = `Your ${formatSqft(site)} sq ft is a little ${state === 'larger' ? 'larger' : 'smaller'} than ${req ? `${name}'s live requirement` : `${name}'s stores`}, but close enough to be worth a call.`
  }

  return (
    <div className="flex flex-col gap-4">
      <PanelTitle title={`Size fit: ${SIZE_VERDICT[state]}`}>{summary}</PanelTitle>
      <SizeBar site={site} typical={typical} req={req} />
      <KvRows
        rows={[
          { label: 'Your site', value: `${formatSqft(site)} sq ft` },
          typical
            ? { label: `Typical ${name} store`, value: sqftRangeText(typical.min, typical.max) }
            : { label: `Typical ${name} store`, value: 'Not known', muted: true },
          req
            ? {
                label: 'Live requirement',
                value: sqftRangeText(req.min, req.max),
                aside: req.postedAt ? shortDate(req.postedAt) : null,
              }
            : { label: 'Live requirement', value: reqListed ? 'No size stated' : 'None listed with us', muted: true },
        ]}
      />
    </div>
  )
}

function SizeBar({
  site,
  typical,
  req,
}: {
  site: number
  typical: { min: number; max: number } | null
  req: { min: number | null; max: number | null } | null
}) {
  const top = scaleMax(Math.max(site, typical?.max ?? 0, req?.max ?? req?.min ?? 0))
  const pct = (n: number) => `${Math.min(100, Math.max(0, (n / top) * 100))}%`
  const span = (lo: number, hi: number) => ({ left: pct(lo), width: `calc(${pct(hi)} - ${pct(lo)})` })
  const empty = !typical && !req
  return (
    <div>
      <div className="relative h-[34px]" aria-hidden>
        {empty ? (
          <div className="absolute inset-x-0 top-4 border-t-2 border-dashed border-[#DEDAEC]" />
        ) : (
          <div className="absolute inset-x-0 top-[14px] h-1.5 rounded-[3px] bg-[#EEECF5]" />
        )}
        {req && (
          <div
            className="absolute top-[14px] h-1.5 rounded-[3px] bg-[#B9A8FF]"
            style={span(req.min ?? 0, req.max ?? top)}
          />
        )}
        {typical && (
          <div className="absolute top-3 h-2.5 rounded-[3px] bg-[#6C47FF]" style={span(typical.min, typical.max)} />
        )}
        <div className="absolute top-1 h-[26px] w-0.5 -translate-x-1/2 bg-[#1C1B22]" style={{ left: pct(site) }} />
      </div>
      <div className="mt-1 flex justify-between text-[12px] text-[#8A8895]">
        {[0, top / 3, (2 * top) / 3, top].map((t, i) => (
          <span key={t}>
            {formatSqftShort(t)}
            {i === 3 && ' sq ft'}
          </span>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-[18px] gap-y-1.5 text-[12.5px] text-[#4B4A55]">
        {typical && (
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-3.5 rounded-sm bg-[#6C47FF]" />
            Typical store {rangeShort(typical.min, typical.max)}
          </span>
        )}
        {req && (
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-3.5 rounded-sm bg-[#B9A8FF]" />
            Live requirement {rangeShort(req.min, req.max)}
          </span>
        )}
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-0.5 bg-[#1C1B22]" />
          Your site {formatSqft(site)}
        </span>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Use class
// ---------------------------------------------------------------------------

export function UseClassPanel({ match, query }: PanelProps) {
  const u = match.useClass
  if (!u) {
    return (
      <EmptyPanel kicker="Use class · unknown" title="Use class not confirmed">
        {match.name}&apos;s requirements don&apos;t state a use class, and we can&apos;t infer one from its stores. Not
        scored.
      </EmptyPanel>
    )
  }
  const theirs = u.codes.map(classLabel).join(', ')
  if (query.useClass === 'All') {
    return (
      <div className="flex flex-col gap-4">
        <PanelTitle title={`Use class: ${theirs}`}>
          {`${match.name}'s requirements ask for ${theirs}. You searched every use class, so check your site's.`}
        </PanelTitle>
        <KvRows
          rows={[
            { label: 'Your site', value: classLabel(query.useClass) },
            { label: `${match.name} typical use class`, value: theirs },
          ]}
        />
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-4">
      <PanelTitle title={`Use class: ${u.matches ? classLabel(query.useClass) : theirs}`}>
        {u.matches
          ? `${match.name} typically trades under ${classLabel(query.useClass)}, the same as your site.`
          : `${match.name}'s requirements ask for ${theirs}, and your site is ${classLabel(query.useClass)}. It may need a change of use.`}
      </PanelTitle>
      <KvRows
        rows={[
          { label: 'Your site', value: classLabel(query.useClass) },
          { label: `${match.name} typical use class`, value: theirs },
        ]}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Acquisitive
// ---------------------------------------------------------------------------

const EVIDENCE_PREVIEW = 4

function requirementLine(r: RequirementItem): string {
  const places = r.places.length > 3 ? `${r.places.slice(0, 3).join(', ')} and ${r.places.length - 3} more` : r.places.join(', ')
  return [
    r.sizeMin != null || r.sizeMax != null ? sqftRangeText(r.sizeMin, r.sizeMax) : null,
    r.useClasses.length ? r.useClasses.map(classLabel).join(', ') : null,
    places || 'no target locations listed',
  ]
    .filter(Boolean)
    .join(', ')
}

function counted(n: number, one: string, many = `${one}s`): string {
  return `${n} ${plural(n, one, many)}`
}

export function AcquisitivePanel({ match }: PanelProps) {
  const [showAll, setShowAll] = useState(false)
  const a = match.acquisitive
  const name = match.name

  if (!a) {
    return (
      <div className="flex flex-col gap-3.5">
        <PanelTitle title="Acquisitive: no evidence">
          We haven&apos;t found any requirements listed with SiteMatcher, news about {name} opening stores in the last 90
          days, or planning applications naming it. This signal is left out of the score rather than counted against
          it.
        </PanelTitle>
        <KvRows
          labelWidth={130}
          rows={[
            { label: 'Requirements', value: 'None listed with us', muted: true },
            { label: 'News', value: 'No articles in the last 90 days', muted: true },
            { label: 'Planning', value: 'None naming the brand', muted: true },
          ]}
        />
        <Footnote>
          If you represent {name}, contact{' '}
          <a
            href={`mailto:${CONTACT_CORRECTIONS_EMAIL}?subject=${encodeURIComponent(`Update details: ${name}`)}`}
            className={PANEL_LINK}
          >
            {CONTACT_CORRECTIONS_EMAIL}
          </a>{' '}
          to update our details.
        </Footnote>
      </div>
    )
  }

  const reqs = a.requirements
  const sources = [
    reqs ? `${counted(reqs.count, 'requirement')} listed with SiteMatcher` : null,
    a.news ? `${counted(a.news.count, 'news article')} in the last 90 days` : null,
    a.planning ? `${counted(a.planning.count, 'planning application')} naming ${name}` : null,
  ].filter((x): x is string => !!x)
  const total = (reqs?.count ?? 0) + (a.news?.count ?? 0) + (a.planning?.count ?? 0)
  const lead = `${listPhrase(sources)} ${total === 1 ? 'points' : 'point'} to an active opening programme.`
  const coverage =
    a.level === 'high'
      ? reqs?.nationwide && reqs.nearbyPlaces.length === 0
        ? " Its requirements don't list target locations, so your area isn't ruled out."
        : reqs && reqs.nearbyPlaces.length > 0
          ? ` Its requirements target ${listPhrase(reqs.nearbyPlaces)}, within reach of your site.`
          : ''
      : reqs
        ? " Its requirements don't name your area, so it may not be looking here yet."
        : ' None of it is a requirement covering your area.'

  type Row = { key: string; type: string; body: React.ReactNode; date: string | null }
  const rows: Row[] = [
    ...(reqs?.items ?? []).map((r, i) => ({
      key: `r${i}`,
      type: 'Requirement',
      body: requirementLine(r),
      date: r.postedAt,
    })),
    ...(a.news?.items ?? []).map((n, i) => ({
      key: `n${i}`,
      type: 'News',
      body: n.url ? (
        <a href={n.url} target="_blank" rel="noopener noreferrer" className="text-[#6C47FF] hover:text-[#4B23C9]">
          {n.headline} ↗
        </a>
      ) : (
        n.headline
      ),
      date: n.upcoming ? null : n.date,
    })),
    ...(a.planning
      ? [
          {
            key: 'p',
            type: 'Planning',
            body: `${counted(a.planning.count, 'development')} ${a.planning.count === 1 ? 'names' : 'name'} ${name} as the proposed occupier`,
            date: null,
          },
        ]
      : []),
  ]
  // Older payloads carry requirement totals without per-requirement lines.
  if (reqs && !reqs.items?.length) {
    rows.unshift({ key: 'rsum', type: 'Requirement', body: counted(reqs.count, 'open requirement'), date: null })
  }
  const visible = showAll ? rows : rows.slice(0, EVIDENCE_PREVIEW)

  return (
    <div className="flex flex-col gap-4">
      <PanelTitle title={`Acquisitive: ${a.level}`}>
        {lead}
        {coverage}
      </PanelTitle>
      <div className="flex flex-col">
        {visible.map((r, i) => (
          <div
            key={r.key}
            className={
              'grid grid-cols-[110px_minmax(0,1fr)_60px] items-baseline gap-3.5 border-t border-[#F2F0F7] py-3 text-[14px] ' +
              (i === visible.length - 1 ? 'border-b' : '')
            }
          >
            <span className="text-[#8A8895]">{r.type}</span>
            <span className="text-[#1C1B22]">{r.body}</span>
            <span className="text-right text-[#8A8895]">{r.date ? shortDate(r.date) : r.type === 'News' ? 'Upcoming' : ''}</span>
          </div>
        ))}
      </div>
      {rows.length > EVIDENCE_PREVIEW && (
        <button type="button" onClick={() => setShowAll((v) => !v)} className={`self-start ${PANEL_LINK}`}>
          {showAll ? 'Show fewer' : `Show all ${rows.length} sources`}
        </button>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Demographics — does the brand trade in a town like the site's?
// ---------------------------------------------------------------------------

const TOWN_TITLE: Record<TownMatchBand, string> = {
  close: 'close match',
  partial: 'partial match',
  none: 'no close match',
}

function affluenceWord(index: number): string {
  if (index >= 120) return 'Well above average'
  if (index >= 105) return 'Above average'
  if (index > 95) return 'Average'
  if (index > 80) return 'Below average'
  return 'Well below average'
}

export function DemographicsPanel({ match, site }: PanelProps & { site: BrandMatcherSite }) {
  const t = match.townMatch
  const town = site.town
  const name = match.name
  if (town === undefined) {
    return (
      <EmptyPanel kicker="Demographics · not available" title="Census figures not loaded">
        We couldn&apos;t load the census figures for this search. Not scored.
      </EmptyPanel>
    )
  }
  if (!town) {
    return (
      <EmptyPanel kicker="Demographics · not enough data" title="Your site isn't in a town we hold">
        We compare towns using census figures for England and Wales&apos;s built-up areas, and your site isn&apos;t in one. Not
        scored.
      </EmptyPanel>
    )
  }
  if (!t) {
    return (
      <EmptyPanel kicker="Demographics · not enough data" title="No stores in towns we hold">
        We can&apos;t place any of {name}&apos;s stores in an England or Wales town we hold census figures for. Not scored.
      </EmptyPanel>
    )
  }

  const summary =
    t.band === 'close'
      ? `${counted(t.closeStores, 'store')} of ${name}'s ${t.townStores.toLocaleString('en-GB')} ${t.closeStores === 1 ? 'is' : 'are'} in ${t.closeTowns === 1 ? 'a town' : `${t.closeTowns.toLocaleString('en-GB')} towns`} like ${town.name}${t.bestTown && t.bestTown !== town.name ? `, the closest being ${t.bestTown}` : ''}.`
      : t.band === 'partial'
        ? `None of ${name}'s stores is in a town quite like ${town.name}, but ${t.bestTown ?? 'one'} comes near.`
        : `None of ${name}'s stores is in a town like ${town.name}. The nearest match is ${t.bestTown ?? 'not close'}.`

  return (
    <div className="flex flex-col gap-4">
      <PanelTitle title={`Demographics: ${TOWN_TITLE[t.band]}`}>{summary}</PanelTitle>
      <div className="flex items-baseline justify-between gap-3 rounded-[10px] bg-[#FBFAFE] px-3.5 py-3 shadow-[inset_0_0_0_1px_#F2F0F7]">
        <span className="min-w-0 text-[14px]">
          <span className="font-bold text-[#4B23C9]">Your site</span>
          <span className="text-[#8A8895]"> · {town.name}</span>
        </span>
        <TownFiguresText bua={town} />
      </div>
      <StoreTownList brandId={match.brandId} brandName={name} site={site} />
      <Footnote>
        Towns are built-up areas from the 2021 Census. A close match has a population within {TOWN_MATCH_POPULATION_RATIO} times{' '}
        {town.name}&apos;s and an affluence index within {TOWN_MATCH_AFFLUENCE_POINTS} points (100 is the England and Wales
        average; it combines home ownership, professional and managerial jobs and degree-level qualifications). A partial match
        is within {TOWN_MATCH_POPULATION_RATIO ** 2} times and {TOWN_MATCH_AFFLUENCE_POINTS * 2} points.
      </Footnote>
    </div>
  )
}

function TownFiguresText({ bua }: { bua: TownFigures }) {
  return (
    <span className="flex-shrink-0 text-right text-[13px] text-[#4B4A55]">
      <span className="font-semibold text-[#1C1B22]">{formatPeople(bua.population)}</span> people ·{' '}
      <span className="font-semibold tabular-nums text-[#1C1B22]">{Math.round(bua.affluence)}</span> affluence
      <span className="block text-[12px] text-[#8A8895]">{affluenceWord(bua.affluence)}</span>
    </span>
  )
}

const MATCH_LABEL: Record<TownMatchBand, { label: string; colour: string }> = {
  close: { label: 'Close', colour: 'text-[#1E8A56]' },
  partial: { label: 'Partial', colour: 'text-[#8A5F06]' },
  none: { label: 'Not close', colour: 'text-[#8A8895]' },
}

export const STORE_TOWN_PAGE = 25

// Every store of the brand, best town match first. Loaded when the panel opens.
function StoreTownList({ brandId, brandName, site }: { brandId: string; brandName: string; site: BrandMatcherSite }) {
  const [stores, setStores] = useState<BrandStoreTown[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [shown, setShown] = useState(STORE_TOWN_PAGE)

  useEffect(() => {
    const ctrl = new AbortController()
    setStores(null)
    setError(null)
    fetchBrandStoreTowns(brandId, site, ctrl.signal)
      .then((r) => setStores(r.stores))
      .catch((e: unknown) => {
        if (!ctrl.signal.aborted) setError(e instanceof Error ? e.message : 'Could not load stores')
      })
    return () => ctrl.abort()
  }, [brandId, site])

  if (error) return <p className="text-[13.5px] text-[#A33A35]">{error}</p>
  if (!stores) return <p className="text-[13.5px] text-[#8A8895]">Loading {brandName}&apos;s stores…</p>
  if (stores.length === 0) return null

  const visible = stores.slice(0, shown)
  return (
    <div className="flex flex-col">
      <div className="grid grid-cols-[minmax(0,1fr)_64px_80px_76px] gap-3 pb-2 text-[11px] font-bold tracking-[0.04em] text-[#8A8895]">
        <span>STORE ({stores.length.toLocaleString('en-GB')})</span>
        <span className="text-right">PEOPLE</span>
        <span className="text-right">AFFLUENCE</span>
        <span className="text-right">MATCH</span>
      </div>
      {visible.map((s, i) => (
        <div
          key={`${s.name}-${i}`}
          className={
            'grid grid-cols-[minmax(0,1fr)_64px_80px_76px] items-baseline gap-3 border-t border-[#F2F0F7] py-2.5 text-[13.5px] ' +
            (i === visible.length - 1 ? 'border-b' : '')
          }
        >
          <span className="min-w-0">
            <span className="block truncate font-semibold text-[#1C1B22]">{s.name ?? `${brandName} store`}</span>
            <span className="block truncate text-[12px] text-[#8A8895]">
              {[s.bua?.name ?? s.town, formatMiles(s.miles)].filter(Boolean).join(' · ')}
            </span>
          </span>
          {s.bua ? (
            <>
              <span className="text-right font-semibold text-[#1C1B22]">{formatPeople(s.bua.population)}</span>
              <span className="text-right font-semibold tabular-nums text-[#1C1B22]">{Math.round(s.bua.affluence)}</span>
              <span className={`text-right font-semibold ${s.band ? MATCH_LABEL[s.band].colour : 'text-[#8A8895]'}`}>
                {s.band ? MATCH_LABEL[s.band].label : ''}
              </span>
            </>
          ) : (
            <span className="col-span-3 text-right text-[12.5px] text-[#A9A6B5]">Not in a town we hold</span>
          )}
        </div>
      ))}
      {stores.length > shown && (
        <button type="button" onClick={() => setShown((n) => n + STORE_TOWN_PAGE * 4)} className={`mt-2 self-start ${PANEL_LINK}`}>
          Show {Math.min(STORE_TOWN_PAGE * 4, stores.length - shown).toLocaleString('en-GB')} more
        </button>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Nearest store
// ---------------------------------------------------------------------------

export function NearestPanel({ match }: PanelProps) {
  const n = match.nearest
  const name = match.name
  if (!n) {
    return (
      <EmptyPanel kicker="Nearest store · none in UK" title="No UK stores yet">
        We haven&apos;t found any UK stores for {name}, so there&apos;s nothing to measure distance from. Not scored.
      </EmptyPanel>
    )
  }
  const stores = n.stores?.length ? n.stores : [{ name: n.storeName, town: n.town, miles: n.miles }]
  const dist = formatMiles(n.miles)
  const summary =
    n.miles < BLOCKER_MILES
      ? `An existing ${name} store is only ${dist} away, which is likely to block a new opening.`
      : n.miles < CAUTION_MILES
        ? `An existing ${name} store is ${dist} away, so check a new one wouldn't cannibalise it.`
        : `Far enough from existing ${name} stores to avoid cannibalising them.`
  const lt = match.locationType
  return (
    <div className="flex flex-col gap-4">
      <PanelTitle title={`Nearest store: ${dist}`}>{summary}</PanelTitle>
      <div className="flex flex-col">
        <div className="grid grid-cols-[minmax(0,1fr)_80px] gap-3.5 pb-2 text-[11px] font-bold tracking-[0.04em] text-[#8A8895]">
          <span>STORE</span>
          <span className="text-right">DISTANCE</span>
        </div>
        {stores.map((s, i) => (
          <div
            key={`${s.name}-${i}`}
            className={
              'grid grid-cols-[minmax(0,1fr)_80px] items-baseline gap-3.5 border-t border-[#F2F0F7] py-3 text-[14px] ' +
              (i === stores.length - 1 ? 'border-b' : '')
            }
          >
            <span className="min-w-0">
              <span className="font-semibold text-[#1C1B22]">{s.name ?? `${name} store`}</span>
              {s.town && <span className="text-[#8A8895]"> · {s.town}</span>}
            </span>
            <span className="text-right font-semibold text-[#1C1B22]">{formatMiles(s.miles)}</span>
          </div>
        ))}
      </div>
      {lt && lt.count > 0 && (
        <Footnote>
          {name} also trades in {lt.count} other {formLabel(lt.form, lt.count)} within {LOCATION_TYPE_RADIUS_MILES} miles
          {lt.names.length > 0 && `, including ${listPhrase(lt.names)}`}.
        </Footnote>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Financials — Companies House facts as filed; turnover counts towards the score
// ---------------------------------------------------------------------------

function figureText(f: FiledFigure): string | null {
  if (f.status === 'filed' || f.status === 'extracted') return formatMoney(f.value)
  if (f.status === 'not_published') return 'Not disclosed'
  return null // not read yet: say nothing rather than imply nothing was filed
}

function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

export function FinancialsPanel({ match }: { match: BrandMatch }) {
  const facts: TradingFacts | null = match.tradingFacts
  if (!facts) {
    return (
      <EmptyPanel
        kicker="Financials · no record"
        title="No Companies House match"
        action={
          <a
            href={`https://find-and-update.company-information.service.gov.uk/search/companies?q=${encodeURIComponent(match.name)}`}
            target="_blank"
            rel="noopener noreferrer"
            className={`mt-0.5 ${PANEL_LINK}`}
          >
            Search Companies House ↗
          </a>
        }
      >
        We couldn&apos;t match this brand to a Companies House record. It may trade through a parent or overseas company.
      </EmptyPanel>
    )
  }
  const scannedPages = [facts.turnover, facts.netAssets]
    .map((f) => (f.status === 'extracted' ? f.page : null))
    .filter((p): p is number => p != null)
  const rows: [string, string | null][] = [
    ['Company name', facts.companyName],
    ['Company number', facts.companyNumber],
    ['Company status', facts.status],
    ['Latest turnover', figureText(facts.turnover)],
    ['Net assets', figureText(facts.netAssets)],
    ['Accounts filed', facts.accountsOverdue ? 'Overdue' : facts.accountsMadeUpTo ? 'On time' : 'None filed yet'],
    ['Accounts type', facts.accountsType],
    ['Accounts made up to', facts.accountsMadeUpTo ? formatDate(facts.accountsMadeUpTo) : null],
  ]
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between gap-3">
        <PanelTitle title="Financials">From Companies House, as filed</PanelTitle>
        <a
          href={companiesHouseUrl(facts.companyNumber, 'filing-history')}
          target="_blank"
          rel="noopener noreferrer"
          className={`whitespace-nowrap ${PANEL_LINK}`}
        >
          View on Companies House ↗
        </a>
      </div>
      <KvRows
        labelWidth={200}
        rows={rows
          .filter((r): r is [string, string] => r[1] != null)
          .map(([label, value]) => ({ label, value, muted: value === 'Not disclosed' }))}
      />
      {scannedPages.length > 0 && (
        <Footnote>
          Read automatically from scanned accounts (PDF{' '}
          {Array.from(new Set(scannedPages))
            .sort((a, b) => a - b)
            .map((p) => `p. ${p}`)
            .join(', ')}
          ). Check against the filing.
        </Footnote>
      )}
      {/* Awaiting legal review (turnover scoring, Oct 2026). */}
      <p className="text-[12.5px] leading-[1.5] text-[#6B6B78]">
        {facts.turnover.status === 'not_published'
          ? "Small companies aren't required to file turnover. With no published turnover, this brand scores nothing for turnover in the match score."
          : 'Figures as filed at Companies House, unedited. Published turnover counts towards the match score: larger turnover scores higher. This is not a credit or covenant rating, and any view on covenant strength is yours to form.'}
      </p>
    </div>
  )
}

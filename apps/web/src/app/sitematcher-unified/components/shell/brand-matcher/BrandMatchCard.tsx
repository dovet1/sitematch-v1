'use client'

import { useEffect, useRef, useState } from 'react'
import { BarChart3, ChevronUp, Diamond, ExternalLink, Info, Newspaper, Search, Square } from 'lucide-react'
import { UBrandAvatar } from '../directory/UDirectoryPrimitives'
import {
  buildPills,
  CONTACT_CORRECTIONS_EMAIL,
  formatMiles,
  formatMoney,
  formatSqft,
  formatSqftRange,
  formLabel,
  isSparse,
  LOCATION_TYPE_RADIUS_MILES,
  classLabel,
} from '../../../lib/brand-matcher'
import type {
  BrandMatch,
  BrandMatcherQuery,
  BrandMatcherSite,
  FiledFigure,
  RequirementEvidence,
  TradingFacts,
} from '../../../types/brand-matcher'
import { companiesHouseUrl } from '@/lib/companies-house/facts'
import { BrandContactsPanel } from './BrandContactsPanel'
import { Kicker, numberWord, ScoreRing, SignalPill } from './BrandMatcherUi'

function listPhrase(items: string[]): string {
  if (items.length <= 1) return items[0] ?? ''
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
}

function plural(n: number, one: string, many = `${one}s`): string {
  return n === 1 ? one : many
}

export function BrandMatchCard({
  match,
  rank,
  query,
  site,
  expanded,
  onExpandedChange,
}: {
  match: BrandMatch
  rank: number
  query: BrandMatcherQuery
  site: BrandMatcherSite
  expanded: boolean
  onExpandedChange: (expanded: boolean) => void
}) {
  const contactsRef = useRef<HTMLDivElement>(null)
  const [scrollToContacts, setScrollToContacts] = useState(false)
  const sparse = isSparse(match)
  const pills = buildPills(match, query)

  // `Contact` on a collapsed card expands it and brings the contact panel into view.
  useEffect(() => {
    if (!expanded || !scrollToContacts) return
    contactsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    setScrollToContacts(false)
  }, [expanded, scrollToContacts])

  const subject = [
    `${formatSqft(query.sqft)} sq ft ${classLabel(query.useClass)} unit — ${site.postcode}`,
    site.centre?.name,
  ]
    .filter(Boolean)
    .join(', ')

  const sub = [
    match.category,
    match.storeCount > 0 ? `${match.storeCount.toLocaleString('en-GB')} UK ${plural(match.storeCount, 'store')}` : null,
  ]
    .filter(Boolean)
    .join(' · ')

  const hasEvidence = !!match.acquisitive
  const hasFacts = !!match.tradingFacts
  const contentCols = (hasEvidence ? 1 : 0) + (hasFacts ? 1 : 0)

  return (
    <article
      className={
        'overflow-hidden rounded-2xl border bg-sm-surface transition-shadow ' +
        (expanded
          ? 'border-sm-violet/30 shadow-[0_18px_40px_-24px_rgba(84,33,204,0.35)]'
          : 'border-sm-border hover:shadow-[0_8px_24px_-18px_rgba(20,10,40,0.3)]')
      }
    >
      <div
        className="flex cursor-pointer flex-wrap items-center gap-x-5 gap-y-3 px-6 py-5 lg:flex-nowrap"
        onClick={() => onExpandedChange(!expanded)}
      >
        <span className="w-7 flex-shrink-0 text-[22px] font-semibold tabular-nums text-sm-ink4">{rank}</span>
        <UBrandAvatar
          id={match.brandId}
          name={match.name}
          logoUrl={match.logoUrl}
          domain={match.domain}
          size={56}
          radius={14}
        />
        <div className="w-[200px] min-w-0 flex-shrink-0">
          <h3 className="truncate text-[18px] font-bold tracking-[-0.01em] text-sm-ink">{match.name}</h3>
          {sub && <p className="truncate text-[12.5px] text-sm-ink3" title={sub}>{sub}</p>}
        </div>
        <div className="flex min-w-0 flex-1 flex-wrap gap-2">
          {pills.map((p) => (
            <div key={p.key} className="min-w-[112px] max-w-[190px] flex-1">
              <SignalPill pill={p} />
            </div>
          ))}
        </div>
        <ScoreRing score={match.score} parts={match.scoreParts} muted={sparse} />
        <div className="w-[88px] flex-shrink-0 text-right">
          {expanded ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onExpandedChange(false)
              }}
              className="inline-flex items-center gap-1 text-[12.5px] font-medium text-sm-ink3 hover:text-sm-ink"
            >
              Collapse
              <ChevronUp size={13} />
            </button>
          ) : (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setScrollToContacts(true)
                onExpandedChange(true)
              }}
              className="rounded-xl bg-sm-violet-tint px-4 py-2.5 text-[13.5px] font-semibold text-sm-violet-deep transition-colors hover:bg-[#E3DAFF]"
            >
              Contact
            </button>
          )}
        </div>
      </div>

      {expanded && (
        <div>
          {sparse ? (
            <>
              <Band icon={<Info size={16} />} tone="muted">
                <MatchedOnCopy match={match} />
              </Band>
              <Band icon={<Search size={16} />} tone="plain">
                We could not find any evidence that {match.name} is acquiring at the moment. If you
                represent the brand, please contact{' '}
                <a
                  href={`mailto:${CONTACT_CORRECTIONS_EMAIL}?subject=${encodeURIComponent(`Update details: ${match.name}`)}`}
                  className="font-semibold text-sm-violet-deep hover:underline"
                >
                  {CONTACT_CORRECTIONS_EMAIL}
                </a>{' '}
                to update our details
              </Band>
            </>
          ) : (
            match.locationType &&
            match.locationType.count > 0 &&
            site.centre && (
              <Band icon={<BarChart3 size={16} />} tone="green">
                <strong className="font-semibold text-sm-ink">Already trades in your type of location.</strong>{' '}
                Your site is in {site.centre.name}, a {site.centre.classification.toLowerCase()} —{' '}
                {match.name} trades in{' '}
                <strong className="font-semibold text-[#177E4E]">
                  {match.locationType.count} other {formLabel(match.locationType.form, match.locationType.count)}
                </strong>{' '}
                within {LOCATION_TYPE_RADIUS_MILES} miles
                {match.locationType.names.length > 0 &&
                  `, including ${listPhrase(match.locationType.names)}`}
                .
              </Band>
            )
          )}

          <div
            className={
              'grid gap-6 border-t border-sm-border-soft px-6 py-5 ' +
              (contentCols === 2 ? 'lg:grid-cols-[1fr_1fr_340px]' : 'lg:grid-cols-[1fr_340px]')
            }
          >
            {hasEvidence && <EvidenceColumn match={match} />}
            {match.tradingFacts && <TradingFactsColumn facts={match.tradingFacts} />}
            {contentCols === 0 && <VerifiedFactsColumn match={match} />}
            <BrandContactsPanel
              ref={contactsRef}
              brandName={match.name}
              contacts={match.contacts}
              registeredOffice={match.tradingFacts?.registeredOffice ?? null}
              subject={subject}
            />
          </div>
        </div>
      )}
    </article>
  )
}

function Band({
  icon,
  tone,
  children,
}: {
  icon: React.ReactNode
  tone: 'green' | 'muted' | 'plain'
  children: React.ReactNode
}) {
  const bg = tone === 'green' ? 'bg-[#EAF8F1]' : tone === 'muted' ? 'bg-[#F8F7FC]' : 'bg-sm-surface'
  const iconTint =
    tone === 'green' ? 'bg-white/70 text-[#177E4E]' : 'bg-sm-violet-tint-soft text-sm-violet'
  return (
    <div className={`flex items-start gap-3.5 border-t border-sm-border-soft px-6 py-4 ${bg}`}>
      <span className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg ${iconTint}`}>
        {icon}
      </span>
      <p className="pt-1.5 text-[14px] leading-relaxed text-sm-ink2">{children}</p>
    </div>
  )
}

// Band 1 for a sparse brand: states the basis of the match from what we hold, nothing more.
// (A sparse brand has no requirement, so no use class of its own to cite.)
function MatchedOnCopy({ match }: { match: BrandMatch }) {
  const lt = match.locationType
  const basis = ['size']
  if ((lt?.count ?? 0) > 0 || match.nearest) basis.push('location')

  const clauses: string[] = []
  if (match.typicalRange) {
    clauses.push(
      `${match.name}'s typical unit is ${formatSqft(match.typicalRange.min)}–${formatSqft(match.typicalRange.max)} sq ft`
    )
  }
  if (lt && lt.count > 0) {
    const where =
      lt.names[0] && lt.nearestMiles != null
        ? ` — ${lt.names[0]}, ${Math.round(lt.nearestMiles)} miles away`
        : ''
    clauses.push(`they already trade in ${numberWord(lt.count)} ${formLabel(lt.form, lt.count)}${where}`)
  } else if (match.nearest) {
    clauses.push(`their nearest store is ${formatMiles(match.nearest.miles).replace(' mi', ' miles')} away`)
  }

  const sentence =
    clauses.length > 1
      ? `${clauses.slice(0, -1).join(', ')}, and ${clauses[clauses.length - 1]}.`
      : clauses.length === 1
        ? `${clauses[0]}.`
        : ''

  return (
    <>
      <strong className="font-semibold text-sm-ink">Matched on {listPhrase(basis)}.</strong> {sentence}
    </>
  )
}

// " — 8k–20k sq ft, Class E." (or nothing when the requirement states neither).
function requirementSummary(r: RequirementEvidence): string {
  const parts = [
    formatSqftRange(r.sizeMin, r.sizeMax),
    r.useClasses.length ? r.useClasses.map(classLabel).join(', ') : null,
  ].filter(Boolean)
  return parts.length ? ` — ${parts.join(', ')}.` : '.'
}

function requirementPlaces(r: RequirementEvidence): string {
  // No listed targets may mean "anywhere" or simply not captured — say only what we know.
  if (r.nationwide) return "No target locations listed, so your area isn't ruled out."
  const more = r.otherPlaceCount - r.otherPlaces.length
  if (r.nearbyPlaces.length > 0) {
    const also = r.otherPlaces.length
      ? ` Also targeting ${listPhrase(r.otherPlaces)}${more > 0 ? ` and ${more} more` : ''}.`
      : ''
    return `Targets ${listPhrase(r.nearbyPlaces)} — within reach of your site.${also}`
  }
  if (r.otherPlaces.length > 0) {
    return `Targets ${listPhrase(r.otherPlaces)}${more > 0 ? ` and ${more} more` : ''}.`
  }
  return ''
}

function EvidenceColumn({ match }: { match: BrandMatch }) {
  const a = match.acquisitive
  if (!a) return null
  return (
    <div>
      <Kicker>The evidence</Kicker>
      <ul className="mt-3 space-y-3.5">
        {a.requirements && (
          <EvidenceRow icon={<Diamond size={11} className="fill-[#D9A21B] text-[#D9A21B]" />}>
            <strong className="font-semibold text-sm-ink">
              {a.requirements.count} open {plural(a.requirements.count, 'requirement')}
            </strong>
            {requirementSummary(a.requirements)} {requirementPlaces(a.requirements)}
          </EvidenceRow>
        )}
        {a.news && (
          <EvidenceRow icon={<Newspaper size={13} className="text-sm-ink3" />}>
            <strong className="font-semibold text-sm-ink">
              {a.news.count} news {plural(a.news.count, 'mention')}
            </strong>{' '}
            (last 90 days or upcoming) on store openings.
            <span className="mt-1 block space-y-0.5">
              {a.news.items.map((n) => (
                <span key={`${n.date}-${n.headline}`} className="block text-[12.5px]">
                  {n.url ? (
                    <a
                      href={n.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm-violet-deep hover:underline"
                    >
                      {n.headline}
                    </a>
                  ) : (
                    n.headline
                  )}
                  {n.upcoming && <span className="ml-1.5 text-sm-ink3">(upcoming)</span>}
                </span>
              ))}
            </span>
          </EvidenceRow>
        )}
        {a.planning && (
          <EvidenceRow icon={<Square size={11} className="fill-sm-violet-tint text-sm-violet" />}>
            <strong className="font-semibold text-sm-ink">Planning:</strong> {a.planning.count}{' '}
            {plural(a.planning.count, 'development')} naming {match.name} as the proposed occupier.
          </EvidenceRow>
        )}
      </ul>
    </div>
  )
}

function EvidenceRow({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5 text-[13.5px] leading-relaxed text-sm-ink2">
      <span className="mt-[5px] flex w-4 flex-shrink-0 justify-center">{icon}</span>
      <span>{children}</span>
    </li>
  )
}

function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

function figureText(f: FiledFigure): string | null {
  if (f.status === 'filed') return formatMoney(f.value)
  if (f.status === 'not_published') return 'Not disclosed'
  return null // not read yet: say nothing rather than imply nothing was filed
}

// Companies House column for the brand's admin-confirmed trading company. Figures as filed,
// all neutral. Disclaimer copy is legal-reviewed — do not paraphrase.
function TradingFactsColumn({ facts }: { facts: TradingFacts }) {
  const hasFigures = facts.turnover.status === 'filed' || facts.netAssets.status === 'filed'
  const rows: [string, string | null][] = [
    ['Status', facts.status],
    ['Latest turnover', figureText(facts.turnover)],
    ['Net assets', figureText(facts.netAssets)],
    [
      'Accounts',
      facts.accountsOverdue ? 'Overdue' : facts.accountsMadeUpTo ? 'Filed on time' : 'None filed yet',
    ],
    ['Accounts type', facts.accountsType],
    ['Accounts made up to', facts.accountsMadeUpTo ? formatDate(facts.accountsMadeUpTo) : null],
  ]
  return (
    <div>
      <Kicker tone="green">
        {hasFigures ? 'Companies House — trading facts' : 'Companies House — published facts'}
      </Kicker>
      <p className="mt-2 text-[12.5px] text-sm-ink3">
        {facts.companyName} · {facts.companyNumber}
      </p>
      <dl className="mt-2.5 space-y-1.5">
        {rows
          .filter((r): r is [string, string] => r[1] != null)
          .map(([k, v]) => (
            <div key={k} className="flex items-baseline justify-between gap-4 text-[13.5px]">
              <dt className="text-sm-ink3">{k}</dt>
              <dd
                className={
                  'text-right ' +
                  (v === 'Not disclosed' ? 'font-medium text-sm-ink3' : 'font-semibold text-sm-ink')
                }
              >
                {v}
              </dd>
            </div>
          ))}
      </dl>
      <a
        href={companiesHouseUrl(facts.companyNumber, 'filing-history')}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 inline-flex items-center gap-1 text-[13px] font-medium text-sm-violet-deep hover:underline"
      >
        View filings on Companies House
        <ExternalLink size={12} />
      </a>
      <p className="mt-3 rounded-lg border border-sm-border bg-[#F8F7FC] px-3 py-2.5 text-[11.5px] leading-relaxed text-sm-ink2">
        {facts.turnover.status === 'not_published'
          ? "Small companies aren't required to file turnover. A blank here means nothing is published — not that the figures are poor. SiteMatcher does not rate or score financial standing."
          : 'Figures as filed at Companies House, unedited. SiteMatcher does not rate, score or comment on a company\u2019s financial standing — including covenant strength. Any view on that is yours to form.'}
      </p>
    </div>
  )
}

// A sparse brand with no Companies House record: list the facts the match rests on, so the
// evidence side of the card is never an empty column.
function VerifiedFactsColumn({ match }: { match: BrandMatch }) {
  const rows: [string, string][] = []
  if (match.typicalRange) {
    rows.push(['Typical unit', `${formatSqft(match.typicalRange.min)}–${formatSqft(match.typicalRange.max)} sq ft`])
  }
  if (match.size.basis === 'requirement') {
    const r = formatSqftRange(match.size.rangeMin, match.size.rangeMax)
    if (r) rows.push(['Stated requirement', r])
  }
  if (match.useClass) rows.push(['Use class', match.useClass.codes.map(classLabel).join(', ')])
  if (match.storeCount > 0) rows.push(['UK stores', match.storeCount.toLocaleString('en-GB')])
  if (match.nearest) {
    rows.push([
      'Nearest store',
      [match.nearest.storeName, formatMiles(match.nearest.miles)].filter(Boolean).join(' · '),
    ])
  }
  if (match.locationType) {
    rows.push([
      `Same location type`,
      `${match.locationType.count} ${formLabel(match.locationType.form, match.locationType.count)} within ${LOCATION_TYPE_RADIUS_MILES} mi`,
    ])
  }
  return (
    <div>
      <Kicker>What we verified</Kicker>
      <dl className="mt-3 space-y-1.5">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-baseline justify-between gap-4 text-[13.5px]">
            <dt className="text-sm-ink3">{k}</dt>
            <dd className="text-right font-semibold text-sm-ink">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

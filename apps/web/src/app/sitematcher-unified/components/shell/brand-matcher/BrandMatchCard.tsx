'use client'

import { useState } from 'react'
import { ChevronUp } from 'lucide-react'
import { UBrandAvatar } from '../directory/UDirectoryPrimitives'
import {
  classLabel,
  formatSqft,
  SIGNAL_KEYS,
  SIGNAL_LABEL,
  signalSummaries,
  turnoverValue,
  type SignalKey,
  type SignalSummary,
} from '../../../lib/brand-matcher'
import type { BrandMatch, BrandMatcherQuery, BrandMatcherSite } from '../../../types/brand-matcher'
import { BrandContactsPanel, ContactAvatar, contactHref, requestContactHref } from './BrandContactsPanel'
import { SignalCell, plural } from './BrandMatcherUi'
import {
  AcquisitivePanel,
  DemographicsPanel,
  FinancialsPanel,
  NearestPanel,
  SizePanel,
  UseClassPanel,
} from './BrandSignalPanels'

// One brand in the Brand Matcher list: a collapsed row with a status glyph per signal (handoff
// #3d), expanding to a score breakdown and a detail panel for the selected signal (#2b).

export type CardPanel = SignalKey | 'financials' | 'contacts'

// Shared by the column header in BrandMatcherResults.
export const ROW_GRID = 'lg:grid-cols-[44px_160px_minmax(0,1fr)_70px_64px_110px]'

// The first signal worth a look, falling back to Acquisitive.
export function defaultPanel(signals: SignalSummary[]): SignalKey {
  return signals.find((s) => s.status !== 'good')?.key ?? 'acquisitive'
}

function subline(match: BrandMatch): string {
  return [
    match.category,
    match.storeCount > 0 ? `${match.storeCount.toLocaleString('en-GB')} UK ${plural(match.storeCount, 'store')}` : null,
  ]
    .filter(Boolean)
    .join(' · ')
}

export function BrandMatchCard({
  match,
  query,
  site,
  expanded,
  onExpandedChange,
}: {
  match: BrandMatch
  query: BrandMatcherQuery
  site: BrandMatcherSite
  expanded: boolean
  onExpandedChange: (expanded: boolean) => void
}) {
  const signals = signalSummaries(match, query)
  const [panel, setPanel] = useState<CardPanel>(() => defaultPanel(signals))

  const open = (p: CardPanel) => {
    setPanel(p)
    onExpandedChange(true)
  }

  if (!expanded) {
    return <CollapsedRow match={match} signals={signals} onOpen={() => open(defaultPanel(signals))} onContacts={() => open('contacts')} />
  }
  return (
    <ExpandedCard
      match={match}
      query={query}
      site={site}
      signals={signals}
      panel={panel}
      onPanel={setPanel}
      onCollapse={() => onExpandedChange(false)}
    />
  )
}

function CollapsedRow({
  match,
  signals,
  onOpen,
  onContacts,
}: {
  match: BrandMatch
  signals: SignalSummary[]
  onOpen: () => void
  onContacts: () => void
}) {
  const sub = subline(match)
  const turnover = match.tradingFacts ? turnoverValue(match.tradingFacts) : null
  const total = match.contacts.total
  return (
    <article
      role="button"
      tabIndex={0}
      aria-expanded={false}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault()
          onOpen()
        }
      }}
      className={
        'grid cursor-pointer grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-3.5 rounded-2xl border border-[#E4E0F0] bg-white px-[22px] py-4 transition-shadow hover:shadow-[0_8px_24px_-18px_rgba(76,35,201,0.35)] ' +
        ROW_GRID
      }
    >
      <UBrandAvatar id={match.brandId} name={match.name} logoUrl={match.logoUrl} domain={match.domain} size={44} radius={11} />
      <div className="min-w-0">
        <h3 className="truncate text-[17px] font-bold text-[#1C1B22]">{match.name}</h3>
        {sub && <p className="mt-0.5 text-[13px] leading-snug text-[#8A8895]">{sub}</p>}
      </div>
      <div className="col-span-3 grid grid-cols-2 gap-2.5 sm:grid-cols-5 lg:col-span-1 lg:row-start-1 lg:col-start-3">
        {signals.map((s) => (
          <div key={s.key} className="min-w-0">
            <span className="mb-1 block text-[10.5px] font-bold uppercase tracking-[0.02em] text-[#8A8895] lg:hidden">
              {SIGNAL_LABEL[s.key]}
            </span>
            <SignalCell status={s.status} value={s.value} />
          </div>
        ))}
      </div>
      <span
        className={`hidden text-[13.5px] lg:block ${turnover ? 'font-semibold text-[#2A2833]' : 'text-[#8A8895]'}`}
        title={turnover ? 'Latest turnover, as filed at Companies House' : undefined}
      >
        {turnover ?? '—'}
      </span>
      <span className="col-start-3 row-start-1 whitespace-nowrap text-right lg:col-start-auto lg:row-start-auto">
        <span className="text-[24px] font-bold tabular-nums text-[#4B23C9]">{match.score}</span>
        <span className="text-[12px] font-semibold text-[#8A8895]">/100</span>
      </span>
      <div className="col-span-3 text-right lg:col-span-1">
        {total > 0 ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onContacts()
            }}
            className="whitespace-nowrap rounded-[10px] bg-[#F1EEFA] px-3.5 py-[9px] text-[13px] font-bold text-[#4B23C9] transition-colors hover:bg-[#E6E0FA]"
          >
            {total} {plural(total, 'contact')}
          </button>
        ) : (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onContacts()
            }}
            className="whitespace-nowrap rounded-[10px] border border-[#E1DEEC] px-[13px] py-2 text-[13px] font-bold text-[#6B6B78] transition-colors hover:border-[#CFCADF]"
          >
            No contact
          </button>
        )}
      </div>
    </article>
  )
}

// Wording for a signal we hold nothing for, in the breakdown.
const NONE_VALUE: Record<SignalKey, string> = {
  size: 'Not enough data',
  useClass: 'Not confirmed',
  acquisitive: 'No evidence',
  demographics: 'Not enough data',
  nearest: 'No UK stores',
}

function ExpandedCard({
  match,
  query,
  site,
  signals,
  panel,
  onPanel,
  onCollapse,
}: {
  match: BrandMatch
  query: BrandMatcherQuery
  site: BrandMatcherSite
  signals: SignalSummary[]
  panel: CardPanel
  onPanel: (p: CardPanel) => void
  onCollapse: () => void
}) {
  const facts = match.tradingFacts
  const sub = [subline(match), facts ? `${facts.companyName}${facts.status ? `, ${facts.status.toLowerCase()}` : ''}` : null]
    .filter(Boolean)
    .join(' · ')
  const subject = [
    `${formatSqft(query.sqft)} sq ft ${classLabel(query.useClass)} unit — ${site.postcode}`,
    site.centre?.name,
  ]
    .filter(Boolean)
    .join(', ')
  const { primary, others } = match.contacts
  const used = match.scoreParts.length
  const turnover = facts ? turnoverValue(facts) : null

  return (
    <article className="overflow-hidden rounded-[18px] border border-[#E4E0F0] bg-white shadow-[0_16px_40px_-24px_rgba(76,35,201,0.35)]">
      <header className="flex flex-wrap items-center gap-4 border-b border-[#EEECF5] px-[26px] py-[22px]">
        <UBrandAvatar id={match.brandId} name={match.name} logoUrl={match.logoUrl} domain={match.domain} size={52} radius={13} />
        <div className="min-w-0 flex-1">
          <h3 className="text-[21px] font-bold text-[#1C1B22]">{match.name}</h3>
          {sub && <p className="mt-0.5 text-[13.5px] text-[#8A8895]">{sub}</p>}
        </div>
        <button
          type="button"
          onClick={() => onPanel('contacts')}
          className={
            'flex items-center gap-2.5 rounded-xl py-1.5 pl-1.5 pr-3 text-left transition-colors ' +
            (panel === 'contacts' ? 'bg-[#F4F1FF] shadow-[inset_0_0_0_1.5px_#D9CFFA]' : 'hover:bg-[#FBFAFE]')
          }
        >
          <ContactAvatar contact={primary} primary />
          {primary ? (
            <span>
              <span className="block text-[14px] font-bold text-[#1C1B22]">{primary.name ?? 'Property team'}</span>
              <span className={`block text-[12.5px] font-semibold ${panel === 'contacts' ? 'font-bold text-[#4B23C9]' : 'text-[#6C47FF]'}`}>
                {others.length > 0 ? `+${others.length} more` : 'Contact details'}
              </span>
            </span>
          ) : (
            <span>
              <span className="block text-[14px] font-bold text-[#1C1B22]">No named contact</span>
              <span className="block text-[12.5px] text-[#8A8895]">We only list verified contacts</span>
            </span>
          )}
        </button>
        <a
          href={primary ? contactHref(primary, subject) : requestContactHref(match.name)}
          className={
            'rounded-[11px] px-[18px] py-[11px] text-[14px] font-bold transition-colors ' +
            (primary ? 'bg-[#6C47FF] text-white hover:bg-[#4B23C9]' : 'bg-[#F1EEFA] text-[#4B23C9] hover:bg-[#E6E0FA]')
          }
        >
          {primary ? 'Contact' : 'Request a contact'}
        </a>
        <button
          type="button"
          onClick={onCollapse}
          className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-[#8A8895] hover:text-[#1C1B22]"
        >
          Collapse
          <ChevronUp size={13} />
        </button>
      </header>

      <div className="grid lg:grid-cols-[380px_minmax(0,1fr)]">
        <div
          className={
            'flex flex-col gap-1 border-b border-[#EEECF5] px-[26px] py-[22px] transition-opacity lg:border-b-0 lg:border-r ' +
            (panel === 'contacts' ? 'opacity-[.55]' : '')
          }
        >
          <div className="mb-3.5 flex flex-col gap-1">
            <div className="flex items-baseline gap-2">
              <span className="text-[44px] font-bold leading-none tabular-nums text-[#4B23C9]">{match.score}</span>
              <span className="text-[14px] font-semibold text-[#8A8895]">/ 100 overall fit</span>
            </div>
            {used < SIGNAL_KEYS.length && (
              <span className="text-[13px] text-[#8A8895]">
                Based on {used} of {SIGNAL_KEYS.length} signals
              </span>
            )}
          </div>
          {signals.map((s) => {
            const part = match.scoreParts.find((p) => p.component === s.key)
            return (
              <BreakdownRow
                key={s.key}
                label={SIGNAL_LABEL[s.key]}
                value={s.status === 'none' ? NONE_VALUE[s.key] : s.value}
                fill={part ? part.points / part.max : null}
                selected={panel === s.key}
                onSelect={() => onPanel(s.key)}
              />
            )
          })}
          <BreakdownRow
            label="Financials"
            value={facts ? `${turnover ?? 'Filed facts'} · not scored ›` : 'No record found'}
            fill={facts ? undefined : null}
            selected={panel === 'financials'}
            onSelect={() => onPanel('financials')}
            spaced
          />
        </div>

        <div key={panel} className="flex flex-col px-7 py-[22px] motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-150">
          {panel === 'size' && <SizePanel match={match} query={query} />}
          {panel === 'useClass' && <UseClassPanel match={match} query={query} />}
          {panel === 'acquisitive' && <AcquisitivePanel match={match} query={query} />}
          {panel === 'demographics' && <DemographicsPanel match={match} query={query} />}
          {panel === 'nearest' && <NearestPanel match={match} query={query} />}
          {panel === 'financials' && <FinancialsPanel match={match} />}
          {panel === 'contacts' && (
            <BrandContactsPanel
              brandName={match.name}
              contacts={match.contacts}
              registeredOffice={facts?.registeredOffice ?? null}
              subject={subject}
            />
          )}
        </div>
      </div>
    </article>
  )
}

// fill: 0..1 for a scored signal, null for a missing one (dashed track), undefined for a row
// with no bar (Financials, never scored).
function BreakdownRow({
  label,
  value,
  fill,
  selected,
  onSelect,
  spaced = false,
}: {
  label: string
  value: string
  fill: number | null | undefined
  selected: boolean
  onSelect: () => void
  spaced?: boolean
}) {
  const missing = fill === null
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={
        'grid grid-cols-[116px_minmax(0,1fr)_104px] items-center gap-3 rounded-[10px] px-2.5 py-[9px] text-left transition-colors ' +
        (selected ? 'bg-[#F4F1FF] shadow-[inset_0_0_0_1.5px_#D9CFFA]' : 'hover:bg-[#FBFAFE]') +
        (spaced ? ' mt-2' : '')
      }
    >
      <span
        className={
          'text-[14px] ' +
          (selected ? 'font-bold text-[#4B23C9]' : missing ? 'font-semibold text-[#6B6B78]' : 'font-semibold text-[#1C1B22]')
        }
      >
        {label}
      </span>
      {fill === undefined ? null : missing ? (
        <span className="h-0 border-t-2 border-dashed border-[#DEDAEC]" />
      ) : (
        <span className={`h-1.5 rounded-[3px] ${selected ? 'bg-[#E4DEF8]' : 'bg-[#EEECF5]'}`}>
          <span
            className={`block h-1.5 rounded-[3px] ${selected ? 'bg-[#6C47FF]' : 'bg-[#B9A8FF]'}`}
            style={{ width: `${Math.round(fill * 100)}%` }}
          />
        </span>
      )}
      <span
        className={
          'text-right text-[13px] ' +
          (fill === undefined ? 'col-span-2 ' : '') +
          (selected ? 'font-bold text-[#4B23C9]' : missing ? 'text-[#8A8895]' : 'text-[#4B4A55]')
        }
      >
        {value}
      </span>
    </button>
  )
}

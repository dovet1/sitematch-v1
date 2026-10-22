'use client'

import { ChevronDown, MoveRight } from 'lucide-react'
import {
  distributionGeometry,
  formatMeasuredShops,
  formatSqFtRange,
  measuredFootnote,
  sampleFootnote,
  type FloorAreaProfile,
  type MeasuredEstate,
} from '../../lib/size-filter'

// The measured half of the panel. Everything here is deliberately the *quieter*
// treatment: mono figures in grey, never violet, never the same shape as a
// stated requirement. A GIA range is the whole envelope including storage, so it
// reads larger than the sales area an agent quotes — put it where it invites a
// direct comparison with a requirement and the comparison is wrong in the
// brand's favour.

function GiaTag({ small = false }: { small?: boolean }) {
  return (
    <span
      className={
        'rounded px-1 font-mono font-semibold uppercase tracking-[0.08em] text-[#7A7684] ' +
        (small ? 'text-[8px] ' : 'text-[8.5px] ') +
        'bg-[#EEECF2]'
      }
      title="Gross internal area"
    >
      GIA
    </span>
  )
}

// min–max rail, IQR box, median tick. These are distributions, not
// measurements: the bar is what says so, in place of a confidence number that
// would only get quoted without its caveat.
function DistributionBar({ profile }: { profile: FloorAreaProfile }) {
  const { boxLeft, boxWidth, medianLeft } = distributionGeometry(profile)
  return (
    <div
      className="relative h-2 flex-1"
      aria-hidden="true"
      data-testid="distribution-bar"
    >
      <div className="absolute inset-x-0 top-[3px] h-[2px] rounded bg-[#E7E4EE]" />
      <div
        className="absolute top-px h-[6px] rounded-[3px] bg-[#C4BFD2]"
        style={{ left: `${boxLeft}%`, width: `${boxWidth}%` }}
      />
      <div
        className="absolute -top-px h-[10px] w-[2px] rounded bg-[#6B6774]"
        style={{ left: `${medianLeft}%` }}
      />
    </div>
  )
}

// One brand's observed size: the range it actually trades at, what that rests
// on, and how spread out it is.
export function ObservedSize({
  profile,
  label,
}: {
  profile: FloorAreaProfile
  label?: string | null
}) {
  return (
    <div className="mt-1.5">
      {label && (
        <span className="font-mono text-[9px] font-semibold uppercase tracking-[0.12em] text-sm-ink3">
          {label}
        </span>
      )}
      <div className="mt-0.5 flex items-center gap-1.5">
        <span className="font-mono text-[12.5px] font-semibold text-sm-ink2">
          {formatSqFtRange(profile.p25SqFt, profile.p75SqFt)}
        </span>
        <span className="text-[11px] text-sm-ink3">sq ft</span>
        <GiaTag />
      </div>
      <div className="mt-1 flex items-center gap-2">
        <DistributionBar profile={profile} />
        <span className="whitespace-nowrap text-[10px] text-sm-ink3">
          {sampleFootnote(profile)}
        </span>
      </div>
    </div>
  )
}

// A brand too small for a distribution: its shops, one by one. Deliberately
// missing the distribution bar — a rail with an IQR box drawn over two points
// would claim a shape the data does not have. The footnote carries the
// denominator instead, because "3 of 3 shops measured" and "1 of 4" are
// different claims and the reader has to be able to tell them apart.
export function MeasuredShops({
  measured,
  label = 'Measured shops',
}: {
  measured: MeasuredEstate
  label?: string | null
}) {
  return (
    <div className="mt-1.5">
      {label && (
        <span className="font-mono text-[9px] font-semibold uppercase tracking-[0.12em] text-sm-ink3">
          {label}
        </span>
      )}
      <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
        <span className="font-mono text-[12.5px] font-semibold text-sm-ink2">
          {formatMeasuredShops(measured)}
        </span>
        <span className="text-[11px] text-sm-ink3">sq ft</span>
        <GiaTag />
      </div>
      <div className="mt-0.5 text-[10px] text-sm-ink3">
        {measuredFootnote(measured)}
      </div>
    </div>
  )
}

// A multi-format brand, one row per fascia. Never collapsed to a brand-level
// figure: a single median across Tesco Express and Tesco Extra describes
// neither of them.
export function FasciaSizes({
  profiles,
  heading,
}: {
  profiles: FloorAreaProfile[]
  heading: string
}) {
  return (
    <div className="mt-1.5">
      <span className="font-mono text-[9px] font-semibold uppercase tracking-[0.12em] text-sm-ink3">
        {heading}
      </span>
      {profiles.map((p, i) => (
        <div key={p.fasciaId ?? `f${i}`} className={i === 0 ? 'mt-1' : 'mt-1.5'}>
          <div className="flex items-start justify-between gap-2">
            {/* Wraps rather than truncates: real fascia names share long
                prefixes ("Marks and Spencer Simply Food" vs "… Foodhall"), and
                a truncated pair reads as the same format twice — which defeats
                the reason for splitting them at all. */}
            <span className="min-w-0 text-[11.5px] font-semibold leading-[1.3] text-sm-ink2">
              {p.fasciaName ?? 'Other format'}
            </span>
            <span className="flex shrink-0 items-center gap-1">
              <span className="font-mono text-[11.5px] font-semibold text-sm-ink2">
                {formatSqFtRange(p.p25SqFt, p.p75SqFt)}
              </span>
              <span className="text-[10px] text-sm-ink3">sq ft</span>
              <GiaTag small />
            </span>
          </div>
          <div className="mt-1 flex items-center gap-2">
            <DistributionBar profile={p} />
            <span className="whitespace-nowrap text-[10px] text-sm-ink3">
              {sampleFootnote(p)}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}

// A brand that doesn't overlap the band but comes within a quarter of it. Amber
// rather than hidden: 1,900 sq ft against a 2,000–3,000 requirement is a
// conversation, not an exclusion.
export function NearMissTag() {
  return (
    <span className="mt-1.5 inline-flex items-center gap-1 rounded-md bg-[#FBF1E1] px-1.5 py-[3px] text-[10px] font-semibold text-[#A3671A]">
      <MoveRight size={11} className="shrink-0 text-[#B9761F]" />
      Near your size band
    </span>
  )
}

export function NoSizeChip() {
  return (
    <span className="mt-1.5 inline-flex items-center rounded-md bg-[#F4F3F6] px-1.5 py-[3px] text-[10.5px] font-medium text-sm-ink3">
      Size not on record
    </span>
  )
}

// Collapsible header for the two demoted groups. The count is mono because it
// counts measured things.
export function GroupHeader({
  title,
  count,
  open,
  onToggle,
}: {
  title: string
  count: number
  open: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className="flex w-full items-center justify-between gap-2 border-t border-sm-border-soft py-2.5 text-left"
    >
      <span className="flex items-center gap-2">
        <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.13em] text-sm-ink3">
          {title}
        </span>
        <span className="font-mono text-[11px] text-sm-ink4">{count}</span>
      </span>
      <ChevronDown
        size={14}
        className={
          'shrink-0 text-sm-ink4 transition-transform duration-200 ' +
          (open ? '' : '-rotate-90')
        }
      />
    </button>
  )
}

// Always-visible panel footnote. The measurement basis has to be legible
// without a tooltip, and the ordering rule has to be stated rather than
// inferred from the list.
export function SizeFootnote() {
  return (
    <p className="mt-4 border-t border-sm-border-soft pt-3 text-[10.5px] leading-[1.5] text-sm-ink4">
      Sizes are{' '}
      <b className="font-semibold text-sm-ink3">gross internal area (GIA)</b>{' '}
      measured from each brand&apos;s shops — the whole envelope including storage,
      so larger than the sales area an agent quotes. A stated requirement is the
      stronger, current signal and always leads.
    </p>
  )
}

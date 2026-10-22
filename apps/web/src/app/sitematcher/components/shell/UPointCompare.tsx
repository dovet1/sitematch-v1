'use client'

import { X, Loader2, RotateCcw, GitCompareArrows } from 'lucide-react'
import type {
  ComparePair,
  ComparePoint,
  CatchmentDefinition,
  CompareStatRow,
  PresentBrand,
  MissingBrand,
} from '../../types/unified-workspace'
import type { PointComparison } from '../../lib/hooks/usePointComparison'
import { BrandLogo, Kicker } from './UInspector'

// Pin B secondary marker colour (matches the labelled map pin).
const PT_B = '#E8622C'
const DELTA_GOOD = '#15803D'
const DELTA_BAD = '#C2410C'

function radiusLabel(c: CatchmentDefinition): string {
  if (c.mode === 'distance') return `${c.value} km radius`
  return `${c.value} min ${c.mode}`
}

function coordLabel(p: ComparePoint): string {
  return `${p.lat.toFixed(4)}, ${p.lng.toFixed(4)}`
}

function PtBadge({ label, color }: { label: string; color: string }) {
  return (
    <span
      className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full font-mono text-[11px] font-bold text-white"
      style={{ background: color }}
    >
      {label}
    </span>
  )
}

function PtHeadCard({
  point,
  label,
  color,
  catchment,
}: {
  point: ComparePoint
  label: string
  color: string
  catchment: CatchmentDefinition
}) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-3 rounded-xl border border-sm-border bg-sm-surface px-3.5 py-3">
      <PtBadge label={label} color={color} />
      <div className="min-w-0">
        <div className="truncate text-[14.5px] font-semibold text-sm-ink">
          Dropped point
        </div>
        <div className="mt-0.5 font-mono text-[10.5px] text-sm-ink3">
          {coordLabel(point)} · {radiusLabel(catchment)}
        </div>
      </div>
    </div>
  )
}

function CmpBrandRow({
  b,
  side,
}: {
  b: PresentBrand
  side: 'A' | 'B'
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-sm-border bg-sm-surface px-2.5 py-1.5">
      <BrandLogo label={b.brandName} domain={b.logoDomain} logoUrl={b.logoUrl} size={26} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-semibold text-sm-ink">
          {b.brandName}
        </div>
        {b.categoryName && (
          <div className="truncate font-mono text-[9.5px] tracking-wide text-sm-ink3">
            {b.categoryName}
          </div>
        )}
      </div>
      <span
        className="font-mono text-[10px] font-bold"
        style={{ color: side === 'A' ? '#5421CC' : PT_B }}
      >
        {side}
      </span>
    </div>
  )
}

function CmpCol({
  title,
  accent,
  count,
  empty,
  children,
}: {
  title: string
  accent: string
  count: number
  empty: string
  children: React.ReactNode
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <div className="flex items-center gap-1.5 px-0.5 pb-2.5">
        <span
          className="font-mono text-[10px] font-bold uppercase tracking-wider"
          style={{ color: accent }}
        >
          {title}
        </span>
        <span className="font-mono text-[10.5px] text-sm-ink3">{count}</span>
      </div>
      <div className="flex max-h-[246px] flex-col gap-1.5 overflow-y-auto pr-0.5">
        {count === 0 ? (
          <div className="rounded-lg border border-dashed border-sm-border px-2.5 py-3 text-center text-xs text-sm-ink3">
            {empty}
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  )
}

function fmtStat(v: number | null, decimals: number): string {
  if (v == null) return '—'
  return decimals > 0 ? v.toFixed(decimals) : Math.round(v).toLocaleString()
}

function StatRow({ row }: { row: CompareStatRow }) {
  const { a, b, delta, pct, better, decimals } = row
  const neutral = delta == null || delta === 0
  const good = better === 'down' ? (delta ?? 0) < 0 : (delta ?? 0) > 0
  const color = neutral ? '#7C7588' : good ? DELTA_GOOD : DELTA_BAD
  const arrow = delta == null || delta === 0 ? '–' : delta > 0 ? '▲' : '▼'
  const deltaText =
    delta == null
      ? '—'
      : delta === 0
        ? '0'
        : `${delta > 0 ? '+' : ''}${fmtStat(delta, decimals)}`

  return (
    <tr>
      <td className="w-[170px] border-b border-sm-border-soft px-5 py-3 font-mono text-[10px] uppercase tracking-wide text-sm-ink3">
        {row.label}
      </td>
      <td className="border-b border-sm-border-soft px-5 py-3 text-[15px] font-semibold text-sm-ink">
        {fmtStat(a, decimals)}
      </td>
      <td className="border-b border-sm-border-soft px-5 py-3 text-[15px] font-semibold text-sm-ink">
        {fmtStat(b, decimals)}
      </td>
      <td className="w-[130px] border-b border-sm-border-soft px-5 py-3">
        <span
          className="inline-flex items-center gap-1.5 font-mono text-[11.5px] font-bold"
          style={{ color }}
        >
          <span className="text-[9px]">{arrow}</span>
          {deltaText}
          {!neutral && pct != null && (
            <span className="font-medium text-sm-ink4">
              ({pct > 0 ? '+' : ''}
              {Math.round(pct)}%)
            </span>
          )}
        </span>
      </td>
    </tr>
  )
}

export interface UPointCompareProps {
  pair: ComparePair
  comparison: PointComparison
  onClose: () => void
  onClear: () => void
}

export function UPointCompare({
  pair,
  comparison,
  onClose,
  onClear,
}: UPointCompareProps) {
  const { loading, error, retry, onlyA, onlyB, missingBoth, bothCount, statRows } =
    comparison
  const hasData = !loading && !error && comparison.a != null && comparison.b != null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(23,20,25,0.45)] p-10"
      onClick={onClose}
    >
      <div
        className="flex max-h-full w-[min(900px,100%)] flex-col overflow-hidden rounded-2xl bg-sm-bg shadow-[0_30px_80px_-20px_rgba(20,10,40,0.4)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* header */}
        <div className="flex shrink-0 items-start justify-between border-b border-sm-border-soft px-6 pb-4 pt-5">
          <div>
            <Kicker>Location comparison</Kicker>
            <div className="mt-1 text-[22px] font-semibold tracking-[-0.4px] text-sm-ink">
              Pin A vs Pin B
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            title="Close"
            className="rounded-lg border border-sm-border bg-sm-surface p-1.5 text-sm-ink3 hover:text-sm-ink2"
          >
            <X size={14} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-auto">
          {/* the two points */}
          <div className="flex items-stretch gap-3 px-6 py-4">
            <PtHeadCard point={pair.a} label="A" color="#7033FF" catchment={pair.a.catchment} />
            <div className="self-center font-mono text-[11px] text-sm-ink4">vs</div>
            <PtHeadCard point={pair.b} label="B" color={PT_B} catchment={pair.b.catchment} />
          </div>

          {loading && (
            <div className="flex flex-col items-center justify-center gap-3 px-6 py-20 text-sm-ink3">
              <Loader2 size={22} className="animate-spin text-sm-violet" />
              <span className="text-[13px]">Building the comparison…</span>
            </div>
          )}

          {error && !loading && (
            <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
              <div className="text-[13.5px] font-semibold text-sm-ink">
                Couldn&apos;t build the comparison
              </div>
              <div className="max-w-[320px] text-xs text-sm-ink3">{error}</div>
              <button
                type="button"
                onClick={retry}
                className="mt-1 flex items-center gap-1.5 rounded-lg bg-sm-violet px-4 py-2 text-[13px] font-semibold text-white hover:bg-sm-violet-deep"
              >
                <RotateCcw size={13} /> Retry
              </button>
            </div>
          )}

          {hasData && (
            <>
              {/* 1 · brands present in one but not the other */}
              <div className="px-6 pb-1 pt-1.5">
                <div className="text-[16px] font-semibold tracking-[-0.2px] text-sm-ink">
                  Brands in one location, not the other
                </div>
                <div className="mt-0.5 text-[12.5px] leading-relaxed text-sm-ink3">
                  Trading within one pin&apos;s catchment but absent from the other —
                  the head-to-head gaps.
                </div>
              </div>
              <div className="flex gap-4 px-6 pb-5 pt-3">
                <CmpCol
                  title="Only at A"
                  accent="#5421CC"
                  count={onlyA.length}
                  empty="Nothing unique to A"
                >
                  {onlyA.map((x) => (
                    <CmpBrandRow key={x.brandId} b={x} side="A" />
                  ))}
                </CmpCol>
                <div className="w-px shrink-0 bg-sm-border-soft" />
                <CmpCol
                  title="Only at B"
                  accent={PT_B}
                  count={onlyB.length}
                  empty="Nothing unique to B"
                >
                  {onlyB.map((x) => (
                    <CmpBrandRow key={x.brandId} b={x} side="B" />
                  ))}
                </CmpCol>
              </div>

              {/* 2 · missing from both */}
              <div className="border-t border-sm-border-soft px-6 pt-4">
                <div className="mt-3 flex items-baseline justify-between">
                  <div className="text-[16px] font-semibold tracking-[-0.2px] text-sm-ink">
                    Missing from both
                  </div>
                  <span className="font-mono text-[12px] text-sm-ink2">
                    {missingBoth.length}
                  </span>
                </div>
                <div className="mt-0.5 text-[12.5px] leading-relaxed text-sm-ink3">
                  Brands absent from both catchments — an open gap either location could win.
                </div>
                <div className="my-3 flex flex-wrap gap-1.5">
                  {missingBoth.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-sm-border px-2.5 py-3 text-[12.5px] text-sm-ink3">
                      No shared gaps — every tracked brand trades in at least one.
                    </div>
                  ) : (
                    missingBoth.map((x: MissingBrand) => (
                      <span
                        key={x.brandId}
                        className="inline-flex items-center gap-1.5 rounded-full border border-sm-border bg-sm-surface py-1 pl-1 pr-2.5"
                      >
                        <BrandLogo
                          label={x.brandName}
                          domain={x.logoDomain}
                          logoUrl={x.logoUrl}
                          size={20}
                        />
                        <span className="text-[12.5px] font-medium text-sm-ink">
                          {x.brandName}
                        </span>
                      </span>
                    ))
                  )}
                </div>
              </div>

              {/* 3 · catchment stats */}
              <div className="border-t border-sm-border-soft px-6 pb-2 pt-4">
                <div className="text-[16px] font-semibold tracking-[-0.2px] text-sm-ink">
                  Catchment stats
                </div>
                <div className="mt-0.5 text-[12.5px] leading-relaxed text-sm-ink3">
                  Difference within each pin&apos;s catchment. Δ is B relative to A.
                </div>
              </div>
              <table className="mb-2 w-full border-collapse">
                <thead>
                  <tr>
                    <th className="border-b border-sm-border px-5 py-2 text-left" />
                    <th className="border-b border-sm-border px-5 py-2 text-left">
                      <span className="inline-flex items-center gap-1.5">
                        <PtBadge label="A" color="#7033FF" />
                        <span className="text-[13px] font-semibold text-sm-ink">Pin A</span>
                      </span>
                    </th>
                    <th className="border-b border-sm-border px-5 py-2 text-left">
                      <span className="inline-flex items-center gap-1.5">
                        <PtBadge label="B" color={PT_B} />
                        <span className="text-[13px] font-semibold text-sm-ink">Pin B</span>
                      </span>
                    </th>
                    <th className="border-b border-sm-border px-5 py-2 text-left font-mono text-[9.5px] uppercase tracking-wide text-sm-ink3">
                      Δ B–A
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {statRows.map((row) => (
                    <StatRow key={row.key} row={row} />
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>

        {/* footer actions */}
        <div className="flex shrink-0 items-center gap-2.5 border-t border-sm-border-soft px-6 pb-5 pt-3.5">
          {hasData && (
            <span className="text-[12px] text-sm-ink3">
              {bothCount} brands trade in both locations.
            </span>
          )}
          <div className="flex-1" />
          <button
            type="button"
            onClick={onClear}
            className="flex items-center gap-1.5 rounded-lg border border-sm-border bg-sm-surface px-3.5 py-2 text-[13px] font-medium text-sm-ink2 hover:bg-sm-bg"
          >
            <X size={13} /> Clear comparison
          </button>
        </div>
      </div>
    </div>
  )
}

export interface UPointCompareTrayProps {
  pair: ComparePair
  error: string | null
  onOpen: () => void
  onClear: () => void
}

export function UPointCompareTray({
  pair,
  error,
  onOpen,
  onClear,
}: UPointCompareTrayProps) {
  return (
    <div className="pointer-events-auto absolute bottom-[18px] left-1/2 z-20 flex max-w-[calc(100vw-48px)] -translate-x-1/2 items-center gap-4 overflow-x-auto whitespace-nowrap rounded-full border border-sm-border bg-sm-surface py-2.5 pl-5 pr-2.5 shadow-[0_10px_30px_-10px_rgba(20,10,40,0.35)]">
      <Kicker>Comparing</Kicker>
      <span className="inline-flex shrink-0 items-center gap-2 rounded-full bg-sm-bg px-2.5 py-1 text-[13px] font-medium text-sm-ink">
        <PtBadge label="A" color="#7033FF" /> Pin A
      </span>
      <span className="shrink-0 font-mono text-[11px] text-sm-ink4">vs</span>
      <span className="inline-flex shrink-0 items-center gap-2 rounded-full bg-sm-bg px-2.5 py-1 text-[13px] font-medium text-sm-ink">
        <PtBadge label="B" color={PT_B} /> Pin B
      </span>
      {error && (
        <span
          className="shrink-0 font-mono text-[10px] font-semibold uppercase tracking-wide"
          style={{ color: DELTA_BAD }}
          title={error}
        >
          Error
        </span>
      )}
      {/* While a pair exists the map ignores clicks, so both pins stay put. Say
          so here and name the way out — otherwise the map just reads as broken. */}
      <span className="shrink-0 text-[12px] text-sm-ink4">
        Map locked — clear to move pins
      </span>
      <button
        type="button"
        onClick={onClear}
        className="shrink-0 rounded-full px-2 py-1 text-[12.5px] font-medium text-sm-ink3 underline underline-offset-2 hover:bg-sm-bg hover:text-sm-ink2"
      >
        Clear
      </button>
      <button
        type="button"
        onClick={onOpen}
        className="flex shrink-0 items-center gap-2 rounded-full bg-sm-violet px-5 py-2 text-[13px] font-semibold text-white hover:bg-sm-violet-deep"
      >
        <GitCompareArrows size={13} /> View comparison
      </button>
    </div>
  )
}

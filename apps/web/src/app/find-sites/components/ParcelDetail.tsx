'use client'

import type { FindSitesItem } from '@/lib/site-matching/find-sites-dto'
import type { RoadFeature } from '@/lib/site-matching/types'
import { useFindSitesStore, selectSelectedItem } from '../lib/store/find-sites-store'
import { TIER_STYLES } from '../lib/tier-style'

const METRES_PER_MILE = 1609.34

// A confidence marker: reliable (HMLR geometry, store locations, OS roads, official zones,
// high-confidence land use) vs supporting/approximate (OSM land use, Estimated AADF, approx
// frontage/junction) — prominence + hedging per the M10 data-confidence rule.
function Confidence({ level }: { level: 'reliable' | 'approximate' | 'unknown' }) {
  const map = {
    reliable: { c: 'bg-emerald-50 text-emerald-700 border-emerald-200', t: 'reliable' },
    approximate: { c: 'bg-amber-50 text-amber-700 border-amber-200', t: 'approximate' },
    unknown: { c: 'bg-slate-100 text-slate-500 border-slate-200', t: 'unknown' },
  }[level]
  return <span className={`rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${map.c}`}>{map.t}</span>
}

function Row({
  label,
  value,
  confidence,
  hint,
}: {
  label: string
  value: React.ReactNode
  confidence?: 'reliable' | 'approximate' | 'unknown'
  hint?: string
}) {
  return (
    <div className="border-t border-sm-border-soft py-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-sm-ink2">{label}</span>
        {confidence && <Confidence level={confidence} />}
      </div>
      <div className="mt-1 text-sm text-sm-ink">{value}</div>
      {hint && <div className="mt-0.5 text-[11px] leading-snug text-sm-ink3">{hint}</div>}
    </div>
  )
}

function roadsBlock(roads: RoadFeature[] | null) {
  if (roads === null) {
    return { value: 'No road data', confidence: 'unknown' as const, hint: 'Enrichment produced no road for this parcel — unknown, not "no access".' }
  }
  if (roads.length === 0) {
    return { value: 'No mapped road within range', confidence: 'reliable' as const, hint: 'A screening negative from OS Open Roads (excludes minor/private tracks) — not an access verdict.' }
  }
  return {
    value: (
      <ul className="space-y-0.5">
        {roads.map((r, i) => (
          <li key={i}>
            {r.roadNumber ? `${r.roadNumber} · ` : ''}{r.roadClass} — {Math.round(r.distanceM)} m
          </li>
        ))}
      </ul>
    ),
    confidence: 'reliable' as const,
    hint: undefined,
  }
}

function trafficBlock(roads: RoadFeature[] | null) {
  const withAadf = (roads ?? []).filter((r) => r.aadf != null)
  if (withAadf.length === 0) {
    return { value: 'No linked traffic count', confidence: 'unknown' as const, hint: undefined }
  }
  const est = withAadf.some((r) => r.estimationMethod === 'Estimated')
  return {
    value: (
      <ul className="space-y-0.5">
        {withAadf.map((r, i) => (
          <li key={i}>
            {r.roadNumber ? `${r.roadNumber}: ` : ''}
            {r.aadf!.toLocaleString()} AADF{r.aadfYear ? ` (${r.aadfYear})` : ''}
            {r.estimationMethod ? ` · ${r.estimationMethod}` : ''}
          </li>
        ))}
      </ul>
    ),
    confidence: est ? ('approximate' as const) : ('reliable' as const),
    hint: est ? 'At least one figure is a DfT modelled (Estimated) count, not a physical count.' : 'DfT counted AADF.',
  }
}

export function ParcelDetail() {
  const item = useFindSitesStore(selectSelectedItem)
  const select = useFindSitesStore((s) => s.select)
  const brandName = useFindSitesStore((s) => s.response?.params.brandName ?? null)

  if (!item) return null

  const f = item.features
  const style = TIER_STYLES[item.tier]
  const road = roadsBlock(f.roads)
  const traffic = trafficBlock(f.roads)
  const luConfidence: 'reliable' | 'approximate' | 'unknown' =
    f.currentLandUse == null ? 'unknown' : f.landUseConfidence === 'high' ? 'reliable' : 'approximate'

  return (
    <div className="flex h-full flex-col">
      <button
        type="button"
        onClick={() => select(null)}
        className="mb-2 inline-flex items-center gap-1 text-xs font-medium text-sm-violet hover:underline"
      >
        ← Back to shortlist
      </button>

      <div className="flex items-center justify-between gap-2">
        <h3 className="text-base font-semibold text-sm-ink">{item.name || 'Registered title'}</h3>
        <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${style.chip}`}>
          {style.label}
        </span>
      </div>
      <p className="mt-0.5 font-mono text-[11px] text-sm-ink3">{item.siteId}</p>

      <div className="mt-2 flex-1 overflow-y-auto pr-1">
        <Row
          label="Registered title area"
          value={f.areaAcres == null ? 'Unknown' : `${f.areaAcres.toFixed(2)} acres`}
          confidence="reliable"
          hint={
            item.oversized
              ? 'Larger than the requested footprint — may contain a suitable area. Exact plot and availability unknown.'
              : 'HMLR registered freehold extent — indicative, not an exact development plot.'
          }
        />
        <Row
          label="Apparent land use"
          value={f.currentLandUse ?? 'Unknown'}
          confidence={luConfidence}
          hint={f.landUseConfidence ? `Fused evidence, ${f.landUseConfidence} confidence.` : 'No classifying evidence.'}
        />
        <Row label="Associated roads" value={road.value} confidence={road.confidence} hint={road.hint} />
        <Row label="Traffic evidence" value={traffic.value} confidence={traffic.confidence} hint={traffic.hint} />
        <Row
          label="Approx. frontage"
          value={f.frontageM == null ? 'Not computed' : `${Math.round(f.frontageM)} m road-facing`}
          confidence={f.frontageM == null ? 'unknown' : 'approximate'}
        />
        <Row
          label="Junction proximity"
          value={
            f.nearestJunctionDistanceM == null
              ? 'Not computed'
              : `${Math.round(f.nearestJunctionDistanceM)} m${f.junctionType ? ` (${f.junctionType})` : ''}`
          }
          confidence={f.nearestJunctionDistanceM == null ? 'unknown' : 'approximate'}
        />
        {brandName && (
          <Row
            label={`Distance from nearest ${brandName}`}
            value={
              !f.brandHasStores
                ? 'Brand has no stores — no cannibalisation'
                : f.sameBrandDistanceM == null
                  ? 'Unknown'
                  : `${(f.sameBrandDistanceM / METRES_PER_MILE).toFixed(2)} miles`
            }
            confidence="reliable"
          />
        )}
        <Row
          label="Constraint intersections"
          value={
            f.constraints.length === 0
              ? 'Not within a mapped flood / green-belt zone'
              : f.constraints.join(', ')
          }
          confidence="reliable"
          hint={f.constraints.length === 0 ? 'Absence of a mapped zone is not a "no risk" verdict.' : undefined}
        />

        <div className="mt-3 rounded-lg border border-sm-border bg-sm-bg p-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-sm-ink2">Criteria breakdown</div>
          <EvidenceList title="Passed" items={item.evidence.passed} tone="text-emerald-700" />
          <EvidenceList
            title="Partial"
            items={item.evidence.partial.map((p) => (p.note ? `${p.label} — ${p.note}` : p.label))}
            tone="text-amber-700"
          />
          <EvidenceList title="Failed" items={item.evidence.failed} tone="text-red-600" />
          <EvidenceList title="Unknown" items={item.evidence.unknown} tone="text-sm-ink3" />
        </div>
      </div>
    </div>
  )
}

function EvidenceList({ title, items, tone }: { title: string; items: string[]; tone: string }) {
  if (items.length === 0) return null
  return (
    <div className="mt-2">
      <div className={`text-[11px] font-semibold ${tone}`}>
        {title} ({items.length})
      </div>
      <ul className="mt-0.5 space-y-0.5 text-[11px] text-sm-ink2">
        {items.map((t, i) => (
          <li key={i}>{t}</li>
        ))}
      </ul>
    </div>
  )
}

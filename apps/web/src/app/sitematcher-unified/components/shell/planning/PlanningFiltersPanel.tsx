'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, ChevronDown, Minus, Plus, Search, X } from 'lucide-react'
import {
  COMMERCIAL_WORK,
  MIN_RESIDENTIAL_DWELLINGS,
  defaultCriteria,
  parseCriteria,
  type MonitorCriteria,
  type MonitorStage,
} from '@/lib/planning-monitor/criteria'
import type { RefBrand } from '../../../types/unified-workspace'
import { selectPatch, usePlanningMonitorStore } from '../../../lib/stores/planning-monitor-store'
import { useDraftCount } from '../../../lib/hooks/usePlanningMonitor'
import { MILE_METERS, RADIUS_MILES, TIME_FRAMES, WORK_LABELS, dateFieldHelp, milesLabel, stageLabel, timeFrameLabel } from '../../../lib/planning-monitor-ui'
import { usePlanningMode } from './PlanningModeContext'
import { drawnLocation } from './PlanningDrawPanel'
import { Eyebrow, GroupLabel, OutlineButton, PrimaryButton, Spinner, Toggle } from './PlanningUi'

const STATUS_CHOICES: MonitorStage[] = ['pending', 'approved', 'refused', 'withdrawn']

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value]
}

function DwellingsInput({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const [text, setText] = useState(String(value))
  const [snapped, setSnapped] = useState(false)
  useEffect(() => setText(String(value)), [value])
  const commit = (raw: string) => {
    const n = Math.floor(Number(raw))
    const next = Number.isFinite(n) ? Math.min(100_000, Math.max(MIN_RESIDENTIAL_DWELLINGS, n)) : value
    setSnapped(Number.isFinite(n) && n < MIN_RESIDENTIAL_DWELLINGS)
    setText(String(next))
    onChange(next)
  }
  const step = (delta: number) => commit(String(value + delta))
  const seg = 'flex h-9 w-9 items-center justify-center text-sm-violet disabled:text-[#C9C3BA]'
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <span className="text-[13.5px] font-semibold text-sm-ink">Minimum dwellings</span>
        <div className="flex items-center rounded-[10px] border-[1.5px] border-[#D9CFFA] bg-white">
          <button type="button" aria-label="Fewer dwellings" disabled={value <= MIN_RESIDENTIAL_DWELLINGS} onClick={() => step(-5)} className={seg}>
            <Minus size={14} strokeWidth={2.4} />
          </button>
          <input
            aria-label="Minimum dwellings"
            inputMode="numeric"
            value={text}
            onChange={(e) => setText(e.target.value.replace(/[^\d]/g, ''))}
            onBlur={(e) => commit(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && commit((e.target as HTMLInputElement).value)}
            className="h-9 w-14 border-x border-[#EDEBE7] text-center text-[15px] font-bold text-sm-ink outline-none"
          />
          <button type="button" aria-label="More dwellings" onClick={() => step(5)} className={seg}>
            <Plus size={14} strokeWidth={2.4} />
          </button>
        </div>
      </div>
      <p className={'mt-2 text-[12px] leading-[1.45] ' + (snapped ? 'text-sm-violet-deep' : 'text-[#57534E]')}>
        15 is the floor — smaller schemes aren’t tracked.
      </p>
    </div>
  )
}

function BrandCombo({ brands, value, exclude, onChange, onRemove }: { brands: RefBrand[]; value: string | null; exclude: string[]; onChange: (id: string) => void; onRemove?: () => void }) {
  const [open, setOpen] = useState(value == null)
  const [query, setQuery] = useState('')
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    return brands.filter((b) => !exclude.includes(b.id) && (!q || b.name.toLowerCase().includes(q))).slice(0, 8)
  }, [brands, query, exclude])
  const name = value ? brands.find((b) => b.id === value)?.name ?? 'Brand' : null
  return (
    <div className="relative min-w-0 flex-1">
      {open ? (
        <div className="flex items-center gap-2 rounded-[11px] border-[1.5px] border-sm-violet bg-white px-3 py-[9px]">
          <Search size={14} className="shrink-0 text-[#8A857D]" />
          <input
            autoFocus
            aria-label="Search brands"
            value={query}
            placeholder="Search brands, e.g. Aldi"
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') value ? setOpen(false) : onRemove?.()
              if (e.key === 'Enter' && matches[0]) {
                onChange(matches[0].id)
                setOpen(false)
              }
            }}
            className="min-w-0 flex-1 text-[13.5px] outline-none"
          />
          {(value || onRemove) && (
            <button type="button" aria-label="Close brand search" onClick={() => (value ? setOpen(false) : onRemove?.())}>
              <X size={13} className="text-[#8A857D]" />
            </button>
          )}
        </div>
      ) : (
        <button type="button" onClick={() => setOpen(true)} className="flex w-full items-center gap-2 rounded-[11px] border border-[#EDEBE7] bg-white px-3 py-2.5 text-left hover:bg-sm-bg">
          <span className="min-w-0 flex-1">
            <span className="block font-mono text-[9.5px] uppercase tracking-[0.1em] text-[#8A857D]">Brand</span>
            <span className="block truncate text-[13.5px] font-semibold text-sm-ink">{name}</span>
          </span>
          <ChevronDown size={14} className="text-[#8A857D]" />
        </button>
      )}
      {open && matches.length > 0 && (
        <ul role="listbox" className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-[12px] border border-[#EDEBE7] bg-white py-1 shadow-[0_24px_50px_-14px_rgba(0,0,0,.35)]">
          {matches.map((b) => (
            <li key={b.id}>
              <button
                type="button"
                role="option"
                aria-selected={b.id === value}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange(b.id)
                  setQuery('')
                  setOpen(false)
                }}
                className="block w-full px-3 py-2 text-left text-[13.5px] hover:bg-[#F7F4FF]"
              >
                {b.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/**
 * All filters: one component for Whole UK, the saved patch and a new patch's name step. It edits
 * a copy; Apply commits it and Cancel keeps the last applied set. The footer count uses exactly
 * the server's predicate.
 */
export function PlanningFiltersPanel() {
  const target = usePlanningMonitorStore((s) => s.filtersTarget)
  const closeFilters = usePlanningMonitorStore((s) => s.closeFilters)
  const patch = usePlanningMonitorStore(selectPatch)
  const browseCriteria = usePlanningMonitorStore((s) => s.browseCriteria)
  const draftCriteria = usePlanningMonitorStore((s) => s.draftCriteria)
  const drawing = usePlanningMonitorStore((s) => s.drawing)
  const viewport = usePlanningMonitorStore((s) => s.viewport)
  const { refData, savePatch } = usePlanningMode()

  const initial = useRef<MonitorCriteria>(
    structuredClone(target === 'patch' ? patch?.criteria ?? browseCriteria : target === 'draft' ? draftCriteria ?? browseCriteria : browseCriteria)
  )
  const [criteria, setCriteria] = useState<MonitorCriteria>(() => structuredClone(initial.current))
  const [customOpen, setCustomOpen] = useState(criteria.dates.preset === 'custom')
  const [adding, setAdding] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const update = (change: (d: MonitorCriteria) => void) =>
    setCriteria((current) => {
      const next = structuredClone(current)
      change(next)
      return next
    })

  const validation = useMemo(() => parseCriteria(criteria), [criteria])
  const location = target === 'draft' && drawing ? drawnLocation(drawing.vertices) : null
  const count = useDraftCount({
    enabled: validation.ok,
    criteria: validation.ok ? validation.criteria : criteria,
    location,
    patchId: target === 'patch' ? patch?.id ?? null : null,
    viewport: target === 'uk' ? viewport?.bbox ?? null : null,
  })

  const apply = async () => {
    if (!validation.ok) return setError(validation.error)
    const next = validation.criteria
    const store = usePlanningMonitorStore.getState()
    if (target === 'uk') {
      store.setBrowseCriteria(next)
      closeFilters()
      return
    }
    if (target === 'draft') {
      store.setDraftCriteria(next)
      closeFilters()
      return
    }
    setSaving(true)
    setError(null)
    try {
      await savePatch({ criteria: next })
      closeFilters()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The filters could not be saved')
    } finally {
      setSaving(false)
    }
  }

  const res = criteria.residential
  const com = criteria.commercial
  const brandIds = criteria.proximity?.brandIds ?? []
  const radiusMeters = criteria.proximity?.radiusMeters ?? Math.round(2 * MILE_METERS)
  const radiusMiles = Math.round((radiusMeters / MILE_METERS) * 100) / 100
  const radiusOptions = RADIUS_MILES.includes(radiusMiles as (typeof RADIUS_MILES)[number]) ? RADIUS_MILES : [...RADIUS_MILES, radiusMiles].sort((a, b) => a - b)
  const legacyPreset = !TIME_FRAMES.some((t) => t.id === criteria.dates.preset) && criteria.dates.preset !== 'custom'
  const setBrands = (ids: string[]) =>
    update((d) => {
      d.proximity = ids.length ? { brandIds: ids, radiusMeters } : null
    })

  const pill = (active: boolean) =>
    'rounded-full px-3 py-1.5 text-[12.5px] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-sm-violet ' +
    (active ? 'bg-sm-violet font-bold text-white' : 'border border-[#EDEBE7] font-medium text-[#57534E] hover:bg-sm-bg')

  const countText = !validation.ok
    ? validation.error
    : count.loading
      ? null
      : count.result?.totals
        ? `${count.result.totals.developments.toLocaleString('en-GB')} matches${target === 'uk' ? ' in view' : ''}`
        : count.result?.totalsUnavailable
          ? 'Too many to count'
          : count.error
            ? 'Count unavailable'
            : null

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <div className="min-h-0 flex-1 overflow-y-auto px-[22px] pb-6 pt-5">
        <div className="flex items-end justify-between">
          <div>
            <Eyebrow>{target === 'patch' && patch ? patch.name : target === 'draft' ? 'New patch' : 'Planning monitor'}</Eyebrow>
            <h2 className="mt-2 text-[21px] font-bold tracking-[-0.02em] text-sm-ink">{target === 'patch' ? 'Patch filters' : 'All filters'}</h2>
          </div>
          <button
            type="button"
            className="mb-1 text-[12.5px] font-semibold text-sm-violet hover:text-sm-violet-deep"
            onClick={() => {
              setCriteria(defaultCriteria())
              setCustomOpen(false)
            }}
          >
            Reset all
          </button>
        </div>

        <section className="mt-5">
          <GroupLabel>Time frame</GroupLabel>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {TIME_FRAMES.map((t) => (
              <button key={t.id} type="button" aria-pressed={criteria.dates.preset === t.id} className={pill(criteria.dates.preset === t.id)} onClick={() => { setCustomOpen(false); update((d) => { d.dates.preset = t.id }) }}>
                {t.label}
              </button>
            ))}
            {legacyPreset && (
              <button type="button" aria-pressed className={pill(true)}>{timeFrameLabel(criteria)}</button>
            )}
            <button
              type="button"
              aria-pressed={criteria.dates.preset === 'custom'}
              onClick={() => {
                setCustomOpen(true)
                update((d) => {
                  d.dates.preset = 'custom'
                })
              }}
              className={criteria.dates.preset === 'custom' ? pill(true) : 'rounded-full border border-dashed border-[#D5D0C8] px-3 py-1.5 text-[12.5px] font-medium text-[#57534E] hover:bg-sm-bg'}
            >
              Custom…
            </button>
          </div>
          {customOpen && criteria.dates.preset === 'custom' && (
            <div className="mt-2.5 grid grid-cols-2 gap-2">
              {(['from', 'to'] as const).map((edge) => (
                <label key={edge} className="rounded-[11px] border border-[#EDEBE7] px-3 py-2">
                  <span className="block font-mono text-[9.5px] uppercase tracking-[0.1em] text-[#8A857D]">{edge}</span>
                  <input
                    type="date"
                    value={criteria.dates[edge] ?? ''}
                    onChange={(e) => update((d) => { d.dates[edge] = e.target.value || null })}
                    className="w-full text-[13px] font-semibold text-sm-ink outline-none"
                  />
                </label>
              ))}
            </div>
          )}
          <p className="mt-2 text-[12px] text-[#57534E]">{dateFieldHelp(criteria)}</p>
        </section>

        <section className="mt-6">
          <GroupLabel>Use</GroupLabel>
          <div className="mt-2.5 space-y-2.5">
            <div className={'rounded-[13px] px-[14px] py-[13px] ' + (res.enabled ? 'border-[1.5px] border-sm-violet bg-[#F7F4FF]' : 'border border-[#EDEBE7]')}>
              <div className="flex items-center gap-2.5">
                <Toggle checked={res.enabled} disabled={res.enabled && !com.enabled} label="Residential" onChange={(v) => update((d) => { d.residential.enabled = v })} />
                <span className="text-[14px] font-bold text-sm-ink">Residential</span>
              </div>
              {res.enabled && (
                <div className="mt-3">
                  <DwellingsInput value={res.minDwellings} onChange={(n) => update((d) => { d.residential.minDwellings = n })} />
                </div>
              )}
            </div>

            <div className={'rounded-[13px] px-[14px] py-[13px] ' + (com.enabled ? 'border-[1.5px] border-[#0F9B8E] bg-[#F0FAF8]' : 'border border-[#EDEBE7]')}>
              <div className="flex items-center gap-2.5">
                <Toggle tone="teal" checked={com.enabled} disabled={com.enabled && !res.enabled} label="Commercial" onChange={(v) => update((d) => { d.commercial.enabled = v })} />
                <span className="text-[14px] font-bold text-sm-ink">Commercial</span>
              </div>
              {com.enabled && (
                <>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {COMMERCIAL_WORK.map((w) => {
                      const on = com.work.includes(w)
                      return (
                        <button
                          key={w}
                          type="button"
                          aria-pressed={on}
                          onClick={() => update((d) => { d.commercial.work = toggle(d.commercial.work, w) })}
                          className={'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-semibold ' + (on ? 'bg-[#D6F0EC] text-[#0B7D72]' : 'border border-[#CFE7E3] bg-white text-[#4A7A75] hover:bg-[#F0FAF8]')}
                        >
                          {WORK_LABELS[w]}
                          {on && <Check size={11} strokeWidth={3} />}
                        </button>
                      )
                    })}
                  </div>
                  <p className="mt-2 text-[12px] text-[#4A7A75]">{com.work.length ? 'Only these kinds of commercial scheme.' : 'None picked means every commercial scheme.'}</p>
                </>
              )}
            </div>

            <div className="flex items-center gap-2.5 rounded-[13px] border border-[#EDEBE7] px-[14px] py-[11px]">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-sm-orange" aria-hidden />
              <span className="text-[14px] font-bold text-sm-ink">Mixed use</span>
              <span className="text-[12px] text-[#8A857D]">Matched by either test above.</span>
            </div>
            <p className="text-[12px] text-[#8A857D]">Both on means no use filter. One always stays on.</p>
          </div>
        </section>

        <section className="mt-6">
          <GroupLabel>Proximity to a brand</GroupLabel>
          <div className="mt-2.5 space-y-2">
            {brandIds.map((id, i) => (
              <div key={id} className="flex gap-2">
                <BrandCombo
                  brands={refData.brands}
                  value={id}
                  exclude={brandIds.filter((x) => x !== id)}
                  onChange={(next) => setBrands(brandIds.map((x) => (x === id ? next : x)))}
                />
                {i === 0 ? (
                  <label className="relative w-[118px] shrink-0 rounded-[11px] border border-[#EDEBE7] px-3 py-2.5 hover:bg-sm-bg">
                    <span className="block font-mono text-[9.5px] uppercase tracking-[0.1em] text-[#8A857D]">Within</span>
                    <span className="flex items-center justify-between text-[13.5px] font-semibold text-sm-ink">
                      {milesLabel(radiusMeters).replace(' mi', radiusMiles === 1 ? ' mile' : ' miles')}
                      <ChevronDown size={14} className="text-[#8A857D]" />
                    </span>
                    <select
                      aria-label="Radius"
                      value={radiusMiles}
                      onChange={(e) => update((d) => { if (d.proximity) d.proximity.radiusMeters = Math.round(Number(e.target.value) * MILE_METERS) })}
                      className="absolute inset-0 cursor-pointer opacity-0"
                    >
                      {radiusOptions.map((m) => <option key={m} value={m}>{m} {m === 1 ? 'mile' : 'miles'}</option>)}
                    </select>
                  </label>
                ) : (
                  <button type="button" aria-label="Remove brand" onClick={() => setBrands(brandIds.filter((x) => x !== id))} className="flex w-[118px] shrink-0 items-center justify-center rounded-[11px] border border-[#EDEBE7] text-[12.5px] font-semibold text-[#57534E] hover:bg-sm-bg">
                    Remove
                  </button>
                )}
              </div>
            ))}
            {brandIds.length === 1 && (
              <button type="button" onClick={() => setBrands([])} className="text-[12px] font-semibold text-[#57534E] hover:text-sm-ink">Clear brand filter</button>
            )}
            {adding && (
              <BrandCombo
                brands={refData.brands}
                value={null}
                exclude={brandIds}
                onChange={(id) => {
                  setBrands([...brandIds, id])
                  setAdding(false)
                }}
                onRemove={() => setAdding(false)}
              />
            )}
            {!adding && brandIds.length < 25 && (
              <button type="button" onClick={() => setAdding(true)} className="rounded-full border border-dashed border-[#D5D0C8] px-3 py-1.5 text-[12.5px] font-semibold text-[#57534E] hover:bg-sm-bg">
                + {brandIds.length ? 'Add another brand' : 'Add a brand'}
              </button>
            )}
          </div>
          <p className="mt-2 text-[12px] leading-[1.45] text-[#57534E]">Any tracked brand, not only your own estate. Several brands are OR’d; the radius applies to each.</p>
        </section>

        <section className="mt-6">
          <GroupLabel>Status</GroupLabel>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {STATUS_CHOICES.map((stage) => {
              const on = criteria.stages.includes(stage)
              return (
                <button
                  key={stage}
                  type="button"
                  aria-pressed={on}
                  onClick={() => update((d) => { d.stages = toggle(d.stages, stage) })}
                  className={'rounded-full px-3 py-1.5 text-[12.5px] font-semibold ' + (on ? 'bg-sm-violet-tint text-sm-violet-deep' : 'border border-[#EDEBE7] text-[#57534E] hover:bg-sm-bg')}
                >
                  {stageLabel(stage)}
                </button>
              )
            })}
          </div>
          <p className="mt-2 text-[12px] text-[#8A857D]">None picked means every status.</p>
        </section>
      </div>

      <footer className="flex items-center gap-2 border-t border-[#EDEBE7] bg-sm-bg px-[22px] py-3.5">
        <span className="min-w-0 flex-1 font-mono text-[11px] uppercase tracking-[0.06em] text-[#57534E]" aria-live="polite">
          {count.loading && validation.ok ? <Spinner className="text-[#8A857D]" /> : countText}
        </span>
        <OutlineButton onClick={closeFilters} disabled={saving}>Cancel</OutlineButton>
        <PrimaryButton onClick={apply} disabled={saving || !validation.ok}>
          {saving && <Spinner />} Apply
        </PrimaryButton>
      </footer>
      {error && <p role="alert" className="bg-sm-bg px-[22px] pb-3 text-[12px] text-[#C0453F]">{error}</p>}
    </div>
  )
}

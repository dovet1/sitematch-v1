'use client'

import { useMemo, useRef, useState } from 'react'
import { Check, Loader2, X } from 'lucide-react'
import {
  COMMERCIAL_WORK,
  DWELLING_PRESETS,
  MIN_RESIDENTIAL_DWELLINGS,
  PROCEDURES,
  STAGES,
  defaultCriteria,
  parseCriteria,
  type DatePreset,
  type MonitorCriteria,
  type MonitorProcedure,
  type MonitorStage,
} from '@/lib/planning-monitor/criteria'
import type { MonitorPatch } from '@/lib/planning-monitor/types'
import type { RefBrand } from '../../../types/unified-workspace'
import { useDraftCount } from '../../../lib/hooks/usePlanningMonitor'
import { useFocusTrap } from '../../../lib/hooks/useFocusTrap'
import { MILE_METERS, PROCEDURE_LABELS, WORK_LABELS, countsLabel, formatShortDate, stageLabel } from '../../../lib/planning-monitor-ui'
import { createPatch, updatePatch } from '../../../lib/services/planning-monitor-service'
import { PlanningPatchEditor, type PatchEditorValue } from './PlanningPatchEditor'

const DATE_PRESETS: Array<{ id: DatePreset; label: string }> = [
  { id: '7d', label: 'Last 7 days' },
  { id: '30d', label: 'Last 30 days' },
  { id: '90d', label: 'Last 90 days' },
  { id: 'this_year', label: 'This year' },
  { id: 'all', label: 'All history' },
  { id: 'custom', label: 'Custom…' },
]

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value]
}

function Step({ n, title, hint, children }: { n: number; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <fieldset className="border-0 p-0">
      <legend className="text-[17px] font-bold text-sm-ink">
        {n} · {title}
        {hint && <span className="ml-1 text-[13px] font-normal text-[#8A8895]">— {hint}</span>}
      </legend>
      <div className="mt-3">{children}</div>
    </fieldset>
  )
}

function CheckRow({ checked, onChange, label, children }: { checked: boolean; onChange: (v: boolean) => void; label: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 py-1">
      <label className="inline-flex cursor-pointer items-center gap-2.5">
        <input type="checkbox" className="peer sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span aria-hidden className={'flex h-5 w-5 items-center justify-center rounded-md border-2 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[#6C47FF] ' + (checked ? 'border-[#6C47FF] bg-[#6C47FF]' : 'border-[#D6D2E3] bg-white')}>
          {checked && <Check size={13} strokeWidth={3} className="text-white" />}
        </span>
        <span className={'text-[15px] font-semibold ' + (checked ? 'text-sm-ink' : 'text-[#8A8895]')}>{label}</span>
      </label>
      {children}
    </div>
  )
}

function Pill({ active, onClick, children, tone = 'solid' }: { active: boolean; onClick: () => void; children: React.ReactNode; tone?: 'solid' | 'soft' }) {
  const on = tone === 'solid' ? 'border-[#6C47FF] bg-[#6C47FF] text-white' : 'border-[#F1EEFA] bg-[#F1EEFA] text-[#4B23C9]'
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={'rounded-full border px-3.5 py-1.5 text-[13.5px] font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#6C47FF] ' + (active ? on : 'border-[#E6E3EF] bg-white text-[#6B6B78] hover:bg-[#FAF8FF]')}
    >
      {children}
    </button>
  )
}

function TagInput({ label, values, onChange, placeholder }: { label: string; values: string[]; onChange: (v: string[]) => void; placeholder: string }) {
  const [draft, setDraft] = useState('')
  const add = () => {
    const value = draft.trim().toLowerCase()
    if (value && !values.includes(value) && values.length < 10) onChange([...values, value.slice(0, 60)])
    setDraft('')
  }
  return (
    <div>
      <span className="text-[12px] font-semibold uppercase tracking-wide text-[#8A8895]">{label}</span>
      <div className="mt-1 flex flex-wrap items-center gap-1.5 rounded-xl border border-[#E6E3EF] px-2 py-1.5 focus-within:border-[#6C47FF]">
        {values.map((v) => (
          <span key={v} className="inline-flex items-center gap-1 rounded-full bg-[#F4F3F8] px-2.5 py-1 text-[12.5px] font-semibold text-[#3D3C47]">
            {v}
            <button type="button" aria-label={`Remove ${v}`} onClick={() => onChange(values.filter((x) => x !== v))}><X size={12} /></button>
          </span>
        ))}
        <input
          aria-label={label}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault()
              add()
            }
          }}
          onBlur={add}
          placeholder={values.length ? '' : placeholder}
          className="min-w-[120px] flex-1 border-0 bg-transparent px-1 py-1 text-[13.5px] outline-none"
        />
      </div>
    </div>
  )
}

function BrandPicker({ brands, selected, onChange }: { brands: RefBrand[]; selected: string[]; onChange: (ids: string[]) => void }) {
  const [query, setQuery] = useState('')
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return brands.filter((b) => !selected.includes(b.id) && b.name.toLowerCase().includes(q)).slice(0, 8)
  }, [brands, query, selected])
  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {selected.map((id) => (
          <span key={id} className="inline-flex items-center gap-1 rounded-full bg-[#EAF8F1] px-2.5 py-1 text-[12.5px] font-semibold text-[#177E4E]">
            {brands.find((b) => b.id === id)?.name ?? 'Brand'}
            <button type="button" aria-label="Remove brand" onClick={() => onChange(selected.filter((x) => x !== id))}><X size={12} /></button>
          </span>
        ))}
      </div>
      <div className="relative mt-1.5">
        <input
          aria-label="Add a brand's store estate"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={selected.length ? 'Add another brand' : 'Search brands, e.g. Aldi'}
          className="w-full rounded-xl border border-[#E6E3EF] px-3 py-2.5 text-[14px] outline-none focus:border-[#6C47FF]"
        />
        {matches.length > 0 && (
          <ul className="absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded-xl border border-[#E6E3EF] bg-white shadow-lg">
            {matches.map((b) => (
              <li key={b.id}>
                <button
                  type="button"
                  onClick={() => {
                    onChange([...selected, b.id])
                    setQuery('')
                  }}
                  className="block w-full px-3 py-2 text-left text-[13.5px] hover:bg-[#FAF8FF] focus:bg-[#FAF8FF]"
                >
                  {b.name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

/**
 * Set Criteria. Edits a draft copy; Cancel discards it, and "Save & monitor" commits the patch
 * geometry, criteria and email preference together. The live count uses exactly the server's
 * predicate. Only launch filters appear: no disabled controls for filters that are not ready.
 */
export function PlanningCriteriaModal({
  patch,
  brands,
  onClose,
  onSaved,
}: {
  patch: MonitorPatch | null
  brands: RefBrand[]
  onClose: () => void
  onSaved: (patch: MonitorPatch) => void
}) {
  const dialogRef = useRef<HTMLDivElement | null>(null)
  useFocusTrap(dialogRef, true, onClose)

  const [name, setName] = useState(patch?.name ?? '')
  const [criteria, setCriteria] = useState<MonitorCriteria>(() => structuredClone(patch?.criteria ?? defaultCriteria()))
  const [shape, setShape] = useState<PatchEditorValue>({ location: null, preview: patch?.displayGeometry ?? null, label: patch?.geometryLabel ?? null })
  const [emailEnabled, setEmailEnabled] = useState(patch?.subscription?.emailEnabled ?? false)
  const [skipQuiet, setSkipQuiet] = useState(patch?.subscription?.skipQuietWeeks ?? false)
  const [customMin, setCustomMin] = useState(!DWELLING_PRESETS.includes(criteria.residential.minDwellings as (typeof DWELLING_PRESETS)[number]))
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const update = (change: (draft: MonitorCriteria) => void) =>
    setCriteria((current) => {
      const next = structuredClone(current)
      change(next)
      return next
    })

  const validation = useMemo(() => parseCriteria(criteria), [criteria])
  const hasArea = Boolean(shape.location || patch)
  const count = useDraftCount({
    enabled: validation.ok && hasArea,
    criteria: validation.ok ? validation.criteria : criteria,
    location: shape.location,
    patchId: patch?.id ?? null,
  })

  const save = async () => {
    if (!validation.ok) return setSaveError(validation.error)
    if (!hasArea) return setSaveError('Draw, upload or search for an area first')
    const patchName = name.trim() || shape.label?.split(' · ')[0] || 'My patch'
    setSaving(true)
    setSaveError(null)
    try {
      const request = {
        name: patchName.slice(0, 80),
        location: shape.location ?? undefined,
        criteria: validation.criteria,
        emailEnabled,
        skipQuietWeeks: skipQuiet,
      }
      const result = patch
        ? await updatePatch(patch.id, { ...request, expectedRevision: patch.revision })
        : await createPatch(request)
      onSaved(result.patch)
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'The patch could not be saved')
    } finally {
      setSaving(false)
    }
  }

  const minDwellings = criteria.residential.minDwellings
  const countText = !hasArea
    ? 'Set an area to see matches'
    : !validation.ok
      ? validation.error
      : count.loading
        ? null
        : count.error
          ? 'Count unavailable right now'
          : count.result?.totals
            ? `Matching ${countsLabel(count.result.totals)} right now`
            : count.result?.totalsUnavailable
              ? 'Too many to count at once; saving still works'
              : null

  return (
    <div className="fixed inset-0 z-[210] flex items-stretch justify-center bg-[rgba(14,21,34,0.6)] backdrop-blur-[2px] sm:items-center sm:p-6" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="pm-criteria-title"
        className="flex h-full w-full flex-col overflow-hidden bg-white sm:h-auto sm:max-h-[min(840px,94vh)] sm:w-[min(1040px,100%)] sm:rounded-[22px]"
      >
        <header className="flex items-start justify-between border-b border-[#EEECF5] px-6 py-5 sm:px-10 sm:py-7">
          <div>
            <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-[#6C47FF]">Planning monitor</p>
            <h2 id="pm-criteria-title" className="mt-1 text-[24px] font-bold text-sm-ink sm:text-[28px]">Set your criteria</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-2 text-sm-ink3 hover:bg-sm-bg hover:text-sm-ink">
            <X size={22} />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto lg:grid lg:grid-cols-[420px_1fr] lg:overflow-hidden">
          <div className="border-[#EEECF5] px-6 py-6 sm:px-8 lg:overflow-y-auto lg:border-r">
            <Step n={1} title="Location">
              <p className="-mt-2 mb-3 text-[14px] text-[#6B6B78]">Draw your patch, upload a boundary, or search an area.</p>
              <label className="mb-3 block">
                <span className="text-[12px] font-semibold uppercase tracking-wide text-[#8A8895]">Patch name</span>
                <input
                  data-autofocus
                  value={name}
                  maxLength={80}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Leeds patch"
                  className="mt-1 w-full rounded-xl border border-[#E6E3EF] px-3 py-2.5 text-[14px] outline-none focus:border-[#6C47FF]"
                />
              </label>
              <PlanningPatchEditor
                saved={patch ? { geometry: patch.displayGeometry, label: patch.geometryLabel } : null}
                value={shape}
                onChange={setShape}
              />
            </Step>
          </div>

          <div className="space-y-7 px-6 py-6 sm:px-9 lg:overflow-y-auto">
            <Step n={2} title="Store proximity" hint="optional: only applications near chosen stores">
              <BrandPicker
                brands={brands}
                selected={criteria.proximity?.brandIds ?? []}
                onChange={(ids) => update((d) => { d.proximity = ids.length ? { brandIds: ids, radiusMeters: d.proximity?.radiusMeters ?? Math.round(3 * MILE_METERS) } : null })}
              />
              {criteria.proximity && (
                <label className="mt-2 flex items-center gap-2 text-[14px] text-sm-ink2">
                  Within
                  <input
                    type="number"
                    min={0.25}
                    max={30}
                    step={0.25}
                    value={Math.round((criteria.proximity.radiusMeters / MILE_METERS) * 100) / 100}
                    onChange={(e) => update((d) => { if (d.proximity) d.proximity.radiusMeters = Math.round(Math.min(30, Math.max(0.25, Number(e.target.value) || 0.25)) * MILE_METERS) })}
                    className="w-20 rounded-lg border border-[#E6E3EF] px-2 py-1.5"
                  />
                  miles, straight line
                </label>
              )}
            </Step>

            <Step n={3} title="Application type">
              <CheckRow checked={criteria.residential.enabled} onChange={(v) => update((d) => { d.residential.enabled = v })} label="Residential">
                <span className="text-[14px] text-[#8A8895]">— at least</span>
                {DWELLING_PRESETS.map((n) => (
                  <Pill key={n} tone="soft" active={!customMin && minDwellings === n} onClick={() => { setCustomMin(false); update((d) => { d.residential.minDwellings = n; d.residential.enabled = true }) }}>{n}</Pill>
                ))}
                <Pill tone="soft" active={customMin} onClick={() => setCustomMin(true)}>Custom</Pill>
                {customMin && (
                  <input
                    type="number"
                    aria-label="Minimum homes"
                    min={MIN_RESIDENTIAL_DWELLINGS}
                    value={minDwellings}
                    onChange={(e) => update((d) => { d.residential.minDwellings = Math.max(MIN_RESIDENTIAL_DWELLINGS, Math.floor(Number(e.target.value) || MIN_RESIDENTIAL_DWELLINGS)) })}
                    className="w-20 rounded-lg border border-[#E6E3EF] px-2 py-1"
                  />
                )}
                <span className="text-[14px] text-[#8A8895]">homes</span>
              </CheckRow>
              <p className="ml-7 text-[12px] text-[#8A8895]">Uses the council’s stated count, a reviewer’s correction, or the count read from the description. Schemes with no known count are not included.</p>
              <CheckRow checked={criteria.commercial.enabled} onChange={(v) => update((d) => { d.commercial.enabled = v })} label="Commercial" />
              {criteria.commercial.enabled && (
                <div className="ml-7 mt-1 flex flex-wrap gap-1.5">
                  {COMMERCIAL_WORK.map((w) => (
                    <Pill key={w} tone="soft" active={criteria.commercial.work.includes(w)} onClick={() => update((d) => { d.commercial.work = toggle(d.commercial.work, w) })}>{WORK_LABELS[w]}</Pill>
                  ))}
                  <span className="self-center text-[12px] text-[#8A8895]">{criteria.commercial.work.length ? 'Only these kinds' : 'All commercial proposals'}</span>
                </div>
              )}
            </Step>

            <Step n={4} title="Dates & status">
              <div className="flex flex-wrap items-center gap-2">
                <label className="text-[13px] text-sm-ink2">
                  <span className="sr-only">Date to filter by</span>
                  <select
                    value={criteria.dates.field}
                    onChange={(e) => update((d) => { d.dates.field = e.target.value as MonitorCriteria['dates']['field'] })}
                    className="rounded-lg border border-[#E6E3EF] bg-white px-2 py-1.5"
                  >
                    <option value="received">Received</option>
                    <option value="validated">Validated</option>
                    <option value="decided">Decided</option>
                  </select>
                </label>
                {DATE_PRESETS.map((p) => (
                  <Pill key={p.id} active={criteria.dates.preset === p.id} onClick={() => update((d) => { d.dates.preset = p.id })}>{p.label}</Pill>
                ))}
              </div>
              {criteria.dates.preset === 'custom' && (
                <div className="mt-2 flex flex-wrap items-center gap-2 text-[13px] text-sm-ink2">
                  <label>From <input type="date" value={criteria.dates.from ?? ''} onChange={(e) => update((d) => { d.dates.from = e.target.value || null })} className="rounded-lg border border-[#E6E3EF] px-2 py-1" /></label>
                  <label>To <input type="date" value={criteria.dates.to ?? ''} onChange={(e) => update((d) => { d.dates.to = e.target.value || null })} className="rounded-lg border border-[#E6E3EF] px-2 py-1" /></label>
                </div>
              )}
              <p className="mt-3 text-[12px] font-semibold uppercase tracking-wide text-[#8A8895]">Status</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {STAGES.map((stage: MonitorStage) => (
                  <Pill key={stage} tone="soft" active={criteria.stages.includes(stage)} onClick={() => update((d) => { d.stages = toggle(d.stages, stage) })}>{stageLabel(stage)}</Pill>
                ))}
              </div>
              <p className="mt-3 text-[12px] font-semibold uppercase tracking-wide text-[#8A8895]">Application route</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {(Object.keys(PROCEDURES) as MonitorProcedure[]).map((p) => (
                  <Pill key={p} tone="soft" active={criteria.procedures.includes(p)} onClick={() => update((d) => { d.procedures = toggle(d.procedures, p) })}>{PROCEDURE_LABELS[p]}</Pill>
                ))}
              </div>
              <p className="mt-1.5 text-[12px] text-[#8A8895]">None selected means every status or route. The council’s own wording is kept on each application.</p>
            </Step>

            <Step n={5} title="Refine" hint="optional">
              <div className="grid gap-3 sm:grid-cols-2">
                <TagInput label="Description mentions" values={criteria.keywords.include} onChange={(v) => update((d) => { d.keywords.include = v })} placeholder="e.g. foodstore" />
                <TagInput label="Leave out" values={criteria.keywords.exclude} onChange={(v) => update((d) => { d.keywords.exclude = v })} placeholder="e.g. student" />
              </div>
              <CheckRow checked={criteria.watchedOnly} onChange={(v) => update((d) => { d.watchedOnly = v })} label="Only developments I watch" />
              <CheckRow checked={criteria.exactLocationsOnly} onChange={(v) => update((d) => { d.exactLocationsOnly = v })} label="Only exact site locations" />
            </Step>

            <Step n={6} title="Weekly email">
              <CheckRow checked={emailEnabled} onChange={setEmailEnabled} label="Email me a weekly briefing" />
              <p className="ml-7 text-[12px] text-[#8A8895]">
                Mondays at 08:00 (UK time), covering the previous Monday to Sunday.
                {patch?.subscription?.nextDueAt && emailEnabled ? ` Next: ${formatShortDate(patch.subscription.nextDueAt)}.` : ''}
              </p>
              {emailEnabled && <CheckRow checked={skipQuiet} onChange={setSkipQuiet} label="Skip weeks with no matching changes" />}
            </Step>
          </div>
        </div>

        <footer className="sticky bottom-0 flex flex-col gap-3 border-t border-[#EEECF5] bg-white px-6 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-10 sm:py-5">
          <p className="text-[14.5px] text-[#6B6B78]" aria-live="polite">
            {count.loading && hasArea && validation.ok ? (
              <span className="inline-flex items-center gap-1.5"><Loader2 size={14} className="animate-spin" aria-hidden /> Counting matches…</span>
            ) : (
              countText
            )}
          </p>
          {saveError && <p role="alert" className="text-[13px] text-[#8A2A1F] sm:max-w-[40%]">{saveError}</p>}
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-[#E6E3EF] px-6 py-3 text-[15px] font-semibold text-sm-ink hover:bg-sm-bg sm:flex-none">
              Cancel
            </button>
            <button
              type="button"
              onClick={save}
              disabled={saving || !validation.ok || !hasArea}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#6C47FF] px-7 py-3 text-[15px] font-semibold text-white hover:bg-[#4B23C9] disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none"
            >
              {saving && <Loader2 size={16} className="animate-spin" aria-hidden />}
              Save &amp; monitor
            </button>
          </div>
        </footer>
      </div>
    </div>
  )
}

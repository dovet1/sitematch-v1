'use client'

import { Fragment, useMemo, useState } from 'react'
import {
  Plus,
  X,
  Check,
  MapPin,
  Search,
  Layers,
  PanelLeftClose,
  PanelLeftOpen,
  GitCompareArrows,
} from 'lucide-react'
import * as SliderPrimitive from '@radix-ui/react-slider'
import {
  useWorkspaceStore,
  MIN_POPULATION,
  MAX_POPULATION,
  GAP_RADII,
} from '../../lib/stores/unified-workspace-store'
import type {
  GapItem,
  GapBucket,
  ReferenceData,
  RetailCentreForm,
} from '../../types/unified-workspace'
import { Checkbox } from '@/components/ui/checkbox'
import { CatchmentControl, CatchmentPicker } from './CatchmentControl'
import { useRetailCentreGapsEnabled } from '../../lib/retail-centre-flag-context'

const RETAIL_FORMS: Array<{ id: RetailCentreForm; label: string }> = [
  { id: 'high_street', label: 'High streets' },
  { id: 'retail_park', label: 'Retail parks' },
  { id: 'shopping_centre', label: 'Shopping centres' },
]

const RETAIL_CLASSIFICATIONS: Array<{
  label: string
  form: RetailCentreForm
}> = [
  { label: 'Regional Centre', form: 'high_street' },
  { label: 'Major Town Centre', form: 'high_street' },
  { label: 'Town Centre', form: 'high_street' },
  { label: 'Market Town', form: 'high_street' },
  { label: 'District Centre', form: 'high_street' },
  { label: 'Local Centre', form: 'high_street' },
  { label: 'Small Local Centre', form: 'high_street' },
  { label: 'Large Retail Park', form: 'retail_park' },
  { label: 'Small Retail Park', form: 'retail_park' },
  { label: 'Large Shopping Centre', form: 'shopping_centre' },
  { label: 'Small Shopping Centre', form: 'shopping_centre' },
]

type RuleType = 'category' | 'brand'
interface ValueOption {
  id: string
  label: string
  targetIds: string[]
}

function optionsFor(type: RuleType, ref: ReferenceData): ValueOption[] {
  if (type === 'category') {
    return ref.categories.map((c) => ({ id: c.id, label: c.name, targetIds: [c.id] }))
  }
  return ref.brands.map((b) => ({
    id: b.id,
    label: b.name,
    targetIds: b.fascias.map((f) => f.id),
  }))
}

const TOKEN_COLORS = ['#6D31E8', '#0E7C86', '#B4530E', '#2456C4', '#8A1F5C']

interface Tone {
  verb: string
  sub: string
  emptyHelp: string
  accent: string
  tint: string
  border: string
}

const TONES: Record<GapBucket, Tone> = {
  missing: {
    verb: 'are MISSING',
    sub: "Places where these haven't opened yet",
    emptyHelp: "Add the shops you're checking for",
    accent: '#7033FF',
    tint: '#F5F1FF',
    border: '#E4DBFF',
  },
  have: {
    verb: 'ALREADY HAVE',
    sub: 'Places that already contain these',
    emptyHelp: 'Optional — leave empty to ignore',
    accent: '#0E7C86',
    tint: '#eef6f6',
    border: '#bfe0e0',
  },
}

function toGapItem(type: RuleType, o: ValueOption): GapItem {
  return { key: `${type}:${o.id}`, id: o.id, type, label: o.label, targetIds: o.targetIds }
}

function radiusLabel(km: number, areaLabel: string): string {
  return km === 0 ? `In the ${areaLabel}` : `Within ${km} km`
}

function popShort(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}m`
  if (n >= 1000) return `${Math.round(n / 1000)}k`
  return String(n)
}

function Token({
  item,
  index,
  tone,
  onRemove,
}: {
  item: GapItem
  index: number
  tone: Tone
  onRemove: () => void
}) {
  const color = TOKEN_COLORS[index % TOKEN_COLORS.length]
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border bg-white py-1 pl-1 pr-2"
      style={{ borderColor: tone.border }}
    >
      <span
        className="flex h-[18px] w-[18px] items-center justify-center rounded-[5px] text-[9px] font-bold text-white"
        style={{ background: color }}
      >
        {item.label.slice(0, 1).toUpperCase()}
      </span>
      <span className="text-[12.5px] font-semibold text-sm-ink">{item.label}</span>
      <button
        type="button"
        onClick={onRemove}
        title="Remove"
        className="text-sm-ink4 hover:text-sm-ink2"
      >
        <X size={12} />
      </button>
    </span>
  )
}

function AndChip() {
  return (
    <span className="font-mono text-[9.5px] font-semibold uppercase tracking-wider text-sm-ink4">
      and
    </span>
  )
}

function ProximityRow({
  tone,
  radius,
  onChange,
  areaLabel,
}: {
  tone: Tone
  radius: number
  onChange: (r: number) => void
  areaLabel: string
}) {
  return (
    <div className="mt-3 border-t border-dashed pt-3" style={{ borderColor: tone.border }}>
      <p className="mb-2 text-[11px] text-sm-ink3">Count a match when it&apos;s</p>
      <div className="flex flex-wrap gap-1.5">
        {GAP_RADII.map((km) => {
          const on = radius === km
          return (
            <button
              key={km}
              type="button"
              onClick={() => onChange(km)}
              className="rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors"
              style={
                on
                  ? { background: tone.accent, borderColor: tone.accent, color: '#fff' }
                  : { background: '#fff', borderColor: tone.border, color: '#4A4451' }
              }
            >
              {radiusLabel(km, areaLabel)}
            </button>
          )
        })}
      </div>
      {radius > 0 && (
        <p className="mt-2 text-[10.5px] leading-relaxed text-sm-ink4">
          Stores inside the {areaLabel} always count; outside stores use the {radius} km distance.
        </p>
      )}
    </div>
  )
}

function Bucket({
  bucket,
  badge,
  items,
  radius,
  onAdd,
  onRemove,
  onRadius,
  placeLabel,
  areaLabel,
}: {
  bucket: GapBucket
  badge: string
  items: GapItem[]
  radius: number
  onAdd: () => void
  onRemove: (key: string) => void
  onRadius: (r: number) => void
  placeLabel: string
  areaLabel: string
}) {
  const tone = TONES[bucket]
  const empty = items.length === 0
  return (
    <div
      className="rounded-[14px] border p-3.5"
      style={{ background: tone.tint, borderColor: tone.border }}
    >
      <div className="flex items-start gap-2.5">
        <span
          className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
          style={{ background: tone.accent }}
        >
          {badge}
        </span>
        <div className="min-w-0">
          <div className="text-[14px] font-bold leading-tight text-sm-ink">
            Show {placeLabel} that <span style={{ color: tone.accent }}>{tone.verb}</span>
          </div>
          <div className="mt-0.5 text-[11.5px] text-sm-ink3">{tone.sub}</div>
        </div>
      </div>

      {empty ? (
        <div
          className="mt-3 rounded-[11px] border border-dashed p-4 text-center"
          style={{ borderColor: tone.border }}
        >
          <p className="text-[12px] text-sm-ink3">{tone.emptyHelp}</p>
          <button
            type="button"
            onClick={onAdd}
            className="mt-2.5 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] font-semibold text-white"
            style={{ background: tone.accent }}
          >
            <Plus size={13} /> Add a brand or category
          </button>
        </div>
      ) : (
        <>
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {items.map((item, i) => (
              <Fragment key={item.key}>
                {i > 0 && <AndChip />}
                <Token
                  item={item}
                  index={i}
                  tone={tone}
                  onRemove={() => onRemove(item.key)}
                />
              </Fragment>
            ))}
            <button
              type="button"
              onClick={onAdd}
              className="inline-flex items-center gap-1 rounded-full border border-dashed px-2.5 py-1 text-[12px] font-medium text-sm-ink3 hover:text-sm-ink"
              style={{ borderColor: tone.border }}
            >
              <Plus size={12} /> Add
            </button>
          </div>
          <ProximityRow tone={tone} radius={radius} onChange={onRadius} areaLabel={areaLabel} />
        </>
      )}
    </div>
  )
}

function BrandItemPicker({
  refData,
  bucket,
  selectedKeys,
  onToggle,
  onClose,
}: {
  refData: ReferenceData
  bucket: GapBucket
  selectedKeys: Set<string>
  onToggle: (item: GapItem) => void
  onClose: () => void
}) {
  const tone = TONES[bucket]
  const [query, setQuery] = useState('')
  const brands = useMemo(() => optionsFor('brand', refData), [refData])
  const categories = useMemo(() => optionsFor('category', refData), [refData])
  const q = query.trim().toLowerCase()
  const fBrands = useMemo(
    () => (q ? brands.filter((o) => o.label.toLowerCase().includes(q)) : brands).slice(0, 50),
    [brands, q]
  )
  const fCategories = useMemo(
    () =>
      (q ? categories.filter((o) => o.label.toLowerCase().includes(q)) : categories).slice(0, 50),
    [categories, q]
  )

  const renderRow = (type: RuleType, o: ValueOption) => {
    const item = toGapItem(type, o)
    const added = selectedKeys.has(item.key)
    return (
      <button
        key={item.key}
        type="button"
        onClick={() => onToggle(item)}
        className="flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left hover:bg-sm-bg"
      >
        <span className="text-[13px] text-sm-ink">{o.label}</span>
        {added ? (
          <span
            className="inline-flex items-center gap-1 font-mono text-[10px] font-semibold uppercase tracking-wide"
            style={{ color: tone.accent }}
          >
            <Check size={12} /> Added
          </span>
        ) : (
          <Plus size={14} className="text-sm-ink4" />
        )}
      </button>
    )
  }

  return (
    <>
      <div
        className="absolute inset-0 z-20"
        style={{ background: 'rgba(20,16,40,0.14)' }}
        onClick={onClose}
      />
      <div
        className="absolute inset-x-3 top-3 z-30 rounded-[14px] border border-sm-border bg-white"
        style={{ boxShadow: '0 20px 48px -16px rgba(20,16,40,0.4)' }}
      >
        <div className="p-3">
          <div
            className="flex h-9 items-center gap-2 rounded-lg border px-2.5"
            style={{ borderColor: tone.accent, boxShadow: `0 0 0 3px ${tone.accent}1f` }}
          >
            <Search size={13} className="text-sm-ink3" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Type a shop or category"
              className="w-full bg-transparent text-[13px] text-sm-ink placeholder:text-sm-ink3 focus:outline-none"
            />
          </div>
        </div>
        <div className="max-h-[280px] overflow-y-auto px-3 pb-2">
          {fBrands.length > 0 && (
            <>
              <p className="px-2.5 pb-1 pt-2 font-mono text-[9.5px] font-semibold uppercase tracking-wider text-sm-ink3">
                Brands
              </p>
              {fBrands.map((o) => renderRow('brand', o))}
            </>
          )}
          {fCategories.length > 0 && (
            <>
              <p className="flex items-center gap-1 px-2.5 pb-1 pt-3 font-mono text-[9.5px] font-semibold uppercase tracking-wider text-sm-ink3">
                <Layers size={11} /> Categories
              </p>
              {fCategories.map((o) => renderRow('category', o))}
            </>
          )}
          {fBrands.length === 0 && fCategories.length === 0 && (
            <div className="px-2.5 py-4 text-center text-[12px] text-sm-ink3">No matches</div>
          )}
        </div>
        <div className="flex items-center justify-between border-t border-sm-border-soft px-3 py-2.5">
          <span className="text-[12px] text-sm-ink3">
            <b className="text-sm-ink">{selectedKeys.size}</b> added to{' '}
            {bucket === 'missing' ? "'missing'" : "'already have'"}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3.5 py-1.5 text-[13px] font-semibold text-white"
            style={{ background: tone.accent }}
          >
            Done
          </button>
        </div>
      </div>
    </>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="border-b border-sm-border-soft px-[18px] py-2.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-sm-ink3">
      {children}
    </p>
  )
}

function FindFilters({ refData }: { refData: ReferenceData }) {
  const retailEnabled = useRetailCentreGapsEnabled()
  const gapGeography = useWorkspaceStore((s) => s.gapGeography)
  const setGapGeography = useWorkspaceStore((s) => s.setGapGeography)
  const retailForms = useWorkspaceStore((s) => s.retailForms)
  const setRetailForms = useWorkspaceStore((s) => s.setRetailForms)
  const retailClassifications = useWorkspaceStore((s) => s.retailClassifications)
  const setRetailClassifications = useWorkspaceStore((s) => s.setRetailClassifications)
  const missingItems = useWorkspaceStore((s) => s.missingItems)
  const haveItems = useWorkspaceStore((s) => s.haveItems)
  const missingRadius = useWorkspaceStore((s) => s.missingRadius)
  const haveRadius = useWorkspaceStore((s) => s.haveRadius)
  const addBucketItem = useWorkspaceStore((s) => s.addBucketItem)
  const removeBucketItem = useWorkspaceStore((s) => s.removeBucketItem)
  const setBucketRadius = useWorkspaceStore((s) => s.setBucketRadius)
  const populationRange = useWorkspaceStore((s) => s.populationRange)
  const setPopulationRange = useWorkspaceStore((s) => s.setPopulationRange)
  const showSubFiveK = useWorkspaceStore((s) => s.showSubFiveK)
  const setShowSubFiveK = useWorkspaceStore((s) => s.setShowSubFiveK)
  const [picking, setPicking] = useState<GapBucket | null>(null)
  const isRetail = gapGeography === 'retail_centre'
  const placeLabel = isRetail ? 'retail centres' : 'towns'
  const areaLabel = isRetail ? 'retail centre' : 'town'

  const bucketItems = (b: GapBucket) => (b === 'missing' ? missingItems : haveItems)
  const selectedKeys = picking
    ? new Set(bucketItems(picking).map((i) => i.key))
    : new Set<string>()

  const togglePick = (item: GapItem) => {
    if (!picking) return
    if (bucketItems(picking).some((i) => i.key === item.key)) {
      removeBucketItem(picking, item.key)
    } else {
      addBucketItem(picking, item)
    }
  }

  const popRead = `${popShort(populationRange[0])} – ${popShort(populationRange[1])}`

  return (
    <div className="relative">
      <div className="border-b border-sm-border-soft px-[18px] py-[18px]">
        <p className="font-mono text-[10px] uppercase tracking-wider text-sm-violet-deep">
          Find Gaps
        </p>
        <h2 className="mt-1 text-[19px] font-bold leading-tight tracking-[-0.4px] text-sm-ink">
          Where can we open next?
        </h2>
        <p className="mt-1 text-[12.5px] leading-snug text-sm-ink3">
          Fill the two boxes below. We&apos;ll show every {areaLabel} that matches{' '}
          <b className="font-semibold text-sm-ink2">both</b>.
        </p>
        {retailEnabled && (
          <div className="mt-3 grid grid-cols-2 rounded-lg bg-sm-bg p-1" aria-label="Gap geography">
            {([
              ['town', 'Towns'],
              ['retail_centre', 'Retail centres'],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setGapGeography(value)}
                className={
                  'rounded-md px-2 py-1.5 text-[12px] font-semibold transition-colors ' +
                  (gapGeography === value
                    ? 'bg-white text-sm-ink shadow-sm'
                    : 'text-sm-ink3 hover:text-sm-ink')
                }
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-3 px-[18px] py-[18px]">
        <Bucket
          bucket="missing"
          badge="1"
          items={missingItems}
          radius={missingRadius}
          onAdd={() => setPicking('missing')}
          onRemove={(k) => removeBucketItem('missing', k)}
          onRadius={(r) => setBucketRadius('missing', r)}
          placeLabel={placeLabel}
          areaLabel={areaLabel}
        />

        <div className="flex items-center gap-2 py-0.5">
          <span className="h-px flex-1 bg-sm-border-soft" />
          <span className="font-mono text-[9.5px] font-semibold uppercase tracking-[0.15em] text-sm-ink4">
            And also
          </span>
          <span className="h-px flex-1 bg-sm-border-soft" />
        </div>

        <Bucket
          bucket="have"
          badge="2"
          items={haveItems}
          radius={haveRadius}
          onAdd={() => setPicking('have')}
          onRemove={(k) => removeBucketItem('have', k)}
          onRadius={(r) => setBucketRadius('have', r)}
          placeLabel={placeLabel}
          areaLabel={areaLabel}
        />
      </div>

      {isRetail ? (
        <>
          <SectionLabel>Retail centre type (optional)</SectionLabel>
          <div className="space-y-4 px-[18px] pb-[18px] pt-3">
            <div className="space-y-2">
              {RETAIL_FORMS.map((form) => (
                <label key={form.id} className="flex items-center gap-2 text-[12px] text-sm-ink2">
                  <Checkbox
                    checked={retailForms.includes(form.id)}
                    onCheckedChange={(checked) =>
                      setRetailForms(
                        checked === true
                          ? [...retailForms, form.id]
                          : retailForms.filter((id) => id !== form.id)
                      )
                    }
                  />
                  {form.label}
                </label>
              ))}
            </div>
            <div>
              <p className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-wide text-sm-ink3">
                Classification
              </p>
              <div className="max-h-44 space-y-2 overflow-y-auto pr-1">
                {RETAIL_CLASSIFICATIONS
                  .filter((item) => retailForms.length === 0 || retailForms.includes(item.form))
                  .map((item) => (
                    <label key={item.label} className="flex items-center gap-2 text-[12px] text-sm-ink2">
                      <Checkbox
                        checked={retailClassifications.includes(item.label)}
                        onCheckedChange={(checked) =>
                          setRetailClassifications(
                            checked === true
                              ? [...retailClassifications, item.label]
                              : retailClassifications.filter((label) => label !== item.label)
                          )
                        }
                      />
                      {item.label}
                    </label>
                  ))}
              </div>
            </div>
          </div>
        </>
      ) : (
        <>
      <SectionLabel>Town size (optional)</SectionLabel>
      <div className="px-[18px] pb-[18px] pt-3">
        <div className="flex items-center justify-between">
          <span className="text-[12px] text-sm-ink3">Only show towns in this range</span>
          <span className="font-mono text-[11px] font-medium text-sm-ink2">{popRead}</span>
        </div>
        <SliderPrimitive.Root
          className="relative mt-3 flex w-full touch-none select-none items-center"
          min={MIN_POPULATION}
          max={MAX_POPULATION}
          step={1000}
          minStepsBetweenThumbs={1}
          value={populationRange}
          onValueChange={(v) => setPopulationRange(v as [number, number])}
        >
          <SliderPrimitive.Track className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-sm-border-soft">
            <SliderPrimitive.Range className="absolute h-full bg-sm-violet" />
          </SliderPrimitive.Track>
          <SliderPrimitive.Thumb
            aria-label="Minimum population"
            className="block h-4 w-4 rounded-full border-[1.5px] border-sm-violet bg-white shadow-sm ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sm-violet focus-visible:ring-offset-2"
          />
          <SliderPrimitive.Thumb
            aria-label="Maximum population"
            className="block h-4 w-4 rounded-full border-[1.5px] border-sm-violet bg-white shadow-sm ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sm-violet focus-visible:ring-offset-2"
          />
        </SliderPrimitive.Root>
        <div className="mt-2 flex justify-between font-mono text-[10px] text-sm-ink4">
          <span>Min population</span>
          <span>Max population</span>
        </div>
        <label className="mt-3 flex items-center gap-2 text-[11.5px] leading-snug text-sm-ink3">
          <Checkbox
            checked={showSubFiveK}
            onCheckedChange={(c) => setShowSubFiveK(c === true)}
          />
          Show locations with a population of less than 5k
        </label>
      </div>
        </>
      )}

      {picking && (
        <BrandItemPicker
          refData={refData}
          bucket={picking}
          selectedKeys={selectedKeys}
          onToggle={togglePick}
          onClose={() => setPicking(null)}
        />
      )}
    </div>
  )
}

function AssessEmpty() {
  const steps = [
    ['1', 'Drop a pin', 'Click any point on the map'],
    ['2', 'Set the catchment', 'Radius, drive time or walk time'],
    ['3', 'Read the landscape', 'Brands present + brands missing'],
  ]
  return (
    <>
      <div className="border-b border-sm-border-soft px-[18px] py-[18px]">
        <p className="font-mono text-[10px] uppercase tracking-wider text-sm-violet-deep">
          Assess Area
        </p>
        <h2 className="mt-1 text-[17px] font-semibold tracking-[-0.3px] text-sm-ink">
          Drop a point
        </h2>
        <p className="mt-1 text-[12.5px] leading-snug text-sm-ink3">
          Click anywhere on the map to assess what&apos;s trading nearby and what&apos;s
          missing.
        </p>
      </div>
      <div className="px-[18px] py-[18px]">
        {steps.map((s) => (
          <div
            key={s[0]}
            className="flex gap-3 border-b border-sm-border-soft py-2.5"
          >
            <span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border border-sm-violet-tint bg-sm-violet-tint-soft font-mono text-[11px] font-semibold text-sm-violet-deep">
              {s[0]}
            </span>
            <div>
              <div className="text-[13px] font-semibold text-sm-ink">{s[1]}</div>
              <div className="mt-0.5 text-xs text-sm-ink3">{s[2]}</div>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}

function CompareSection() {
  const compareArm = useWorkspaceStore((s) => s.compareArm)
  const comparePair = useWorkspaceStore((s) => s.comparePair)
  const armPointCompare = useWorkspaceStore((s) => s.armPointCompare)

  return (
    <>
      <SectionLabel>Compare</SectionLabel>
      <div className="px-[18px] py-[18px]">
        {comparePair ? (
          <div className="rounded-lg border border-sm-violet-tint bg-sm-violet-tint-soft p-3">
            <div className="text-[13px] font-semibold text-sm-ink">
              Comparison active
            </div>
            <p className="mt-0.5 text-[11.5px] leading-snug text-sm-ink3">
              Switch between Pin A and Pin B above to tune each catchment, then use
              the tray at the bottom of the map to view or clear the comparison.
            </p>
          </div>
        ) : compareArm ? (
          <div className="rounded-lg border border-sm-orange-tint bg-sm-orange-tint-soft p-3">
            <div className="flex items-center gap-1.5 text-[13px] font-semibold text-sm-ink">
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-sm-orange text-[9px] font-bold text-white">
                B
              </span>
              Drop pin B on the map…
            </div>
            <p className="mt-0.5 text-[11.5px] leading-snug text-sm-ink3">
              Click anywhere on the map to drop the second pin.
            </p>
          </div>
        ) : (
          <button
            type="button"
            onClick={armPointCompare}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-sm-border bg-sm-surface py-2.5 text-[12.5px] font-medium text-sm-ink hover:bg-sm-bg"
          >
            <GitCompareArrows size={14} /> Compare with another location
          </button>
        )}
      </div>
    </>
  )
}

// Colours matching the labelled A/B map pins + comparison modal.
const ARM_COLOR: Record<'a' | 'b', string> = { a: '#7033FF', b: '#E8622C' }

function AssessPoint() {
  const assessPoint = useWorkspaceStore((s) => s.assessPoint)
  const comparePair = useWorkspaceStore((s) => s.comparePair)
  const activeArm = useWorkspaceStore((s) => s.activeCompareArm)
  const setActiveArm = useWorkspaceStore((s) => s.setActiveCompareArm)
  const setComparePointCatchment = useWorkspaceStore(
    (s) => s.setComparePointCatchment
  )

  if (!assessPoint) return null

  const activePoint = comparePair ? comparePair[activeArm] : assessPoint

  return (
    <>
      <div className="border-b border-sm-border-soft px-[18px] py-[18px]">
        <p className="font-mono text-[10px] uppercase tracking-wider text-sm-violet-deep">
          Assess Area
        </p>
        <h2 className="mt-1 text-[17px] font-semibold tracking-[-0.3px] text-sm-ink">
          {comparePair ? 'Compare points' : 'This point'}
        </h2>
        <p className="mt-1 text-[12.5px] leading-snug text-sm-ink3">
          {comparePair
            ? 'Pick a pin and set its catchment independently — each pin can use its own radius, drive or walk time.'
            : 'Set the catchment around the dropped pin — the landscape on the right updates.'}
        </p>
      </div>
      <div className="px-[18px] py-[18px]">
        {comparePair && (
          <div className="mb-4 flex gap-1 rounded-lg bg-sm-bg p-1">
            {(['a', 'b'] as const).map((arm) => (
              <button
                key={arm}
                type="button"
                onClick={() => setActiveArm(arm)}
                className={
                  'flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-semibold transition-colors ' +
                  (activeArm === arm
                    ? 'text-white'
                    : 'text-sm-ink2 hover:bg-sm-border-soft')
                }
                style={activeArm === arm ? { background: ARM_COLOR[arm] } : undefined}
              >
                <span
                  className="flex h-4 w-4 items-center justify-center rounded-full font-mono text-[10px] font-bold"
                  style={
                    activeArm === arm
                      ? { background: 'rgba(255,255,255,0.25)', color: '#fff' }
                      : { background: ARM_COLOR[arm], color: '#fff' }
                  }
                >
                  {arm.toUpperCase()}
                </span>
                Pin {arm.toUpperCase()}
              </button>
            ))}
          </div>
        )}

        <div className="flex items-start gap-2.5 rounded-lg border border-sm-violet-tint bg-sm-violet-tint-soft p-3">
          <span
            className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-lg text-white"
            style={{ background: comparePair ? ARM_COLOR[activeArm] : '#7033FF' }}
          >
            <MapPin size={15} />
          </span>
          <div className="min-w-0">
            <div className="text-[13.5px] font-semibold text-sm-ink">
              {comparePair ? `Pin ${activeArm.toUpperCase()}` : 'Dropped pin'}
            </div>
            <div className="mt-0.5 font-mono text-[11px] text-sm-ink3">
              {activePoint.lat.toFixed(4)}, {activePoint.lng.toFixed(4)}
            </div>
          </div>
        </div>

        <div className="mt-4">
          {comparePair ? (
            <CatchmentPicker
              value={comparePair[activeArm].catchment}
              onChange={(c) => setComparePointCatchment(activeArm, c)}
            />
          ) : (
            <CatchmentControl />
          )}
        </div>
      </div>

      <CompareSection />
    </>
  )
}

// A single overlay pill-toggle row.
function OverlayToggle({
  title,
  subtitle,
  on,
  onColor,
  onClick,
}: {
  title: string
  subtitle: string
  on: boolean
  onColor: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between py-2.5"
    >
      <div className="text-left">
        <div className="text-[13px] font-medium text-sm-ink">{title}</div>
        <div className="text-[11.5px] text-sm-ink3">{subtitle}</div>
      </div>
      <span
        className={
          'relative h-[18px] w-8 rounded-full transition-colors ' +
          (on ? onColor : 'bg-[#DDD6CA]')
        }
      >
        <span
          className={
            'absolute top-0.5 h-3.5 w-3.5 rounded-full bg-white shadow transition-all ' +
            (on ? 'left-4' : 'left-0.5')
          }
        />
      </span>
    </button>
  )
}

// Shared overlays panel: the two traffic toggles are available in every mode
// except sketch.
function OverlaySection() {
  const overlays = useWorkspaceStore((s) => s.overlays)
  const toggleRoadTraffic = useWorkspaceStore((s) => s.toggleRoadTraffic)
  const toggleTrafficHeatmap = useWorkspaceStore((s) => s.toggleTrafficHeatmap)

  return (
    <>
      <SectionLabel>Overlays</SectionLabel>
      <div className="px-[18px] py-1">
        <OverlayToggle
          title="Road traffic"
          subtitle="Roads shaded by volume"
          on={overlays.roadTraffic}
          onColor="bg-sm-orange"
          onClick={toggleRoadTraffic}
        />
        <OverlayToggle
          title="Traffic heatmap"
          subtitle="Count-point intensity"
          on={overlays.trafficHeatmap}
          onColor="bg-sm-orange"
          onClick={toggleTrafficHeatmap}
        />
      </div>
    </>
  )
}

export function ULeftPanel({
  refData,
  hidden,
  onToggle,
}: {
  refData: ReferenceData
  hidden: boolean
  onToggle: () => void
}) {
  const view = useWorkspaceStore((s) => s.view)
  const assessPoint = useWorkspaceStore((s) => s.assessPoint)

  if (hidden) {
    return (
      <aside className="flex w-11 shrink-0 flex-col items-center border-r border-sm-border bg-sm-surface pt-3">
        <button
          type="button"
          onClick={onToggle}
          aria-label="Show left panel"
          title="Show left panel"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-sm-ink3 hover:bg-sm-bg hover:text-sm-ink"
        >
          <PanelLeftOpen size={16} />
        </button>
      </aside>
    )
  }

  return (
    <aside className="relative flex w-80 shrink-0 flex-col border-r border-sm-border bg-sm-surface">
      <button
        type="button"
        onClick={onToggle}
        aria-label="Hide left panel"
        title="Hide left panel"
        className="absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-lg text-sm-ink3 hover:bg-sm-bg hover:text-sm-ink"
      >
        <PanelLeftClose size={16} />
      </button>
      <div className="flex-1 overflow-y-auto">
        {view === 'find' && <FindFilters refData={refData} />}
        {view === 'assess' && !assessPoint && <AssessEmpty />}
        {view === 'assess' && assessPoint && <AssessPoint />}
        {view !== 'sketch' && <OverlaySection />}
        {view === 'sketch' && (
          <div className="px-[18px] py-[18px]">
            <p className="font-mono text-[10px] uppercase tracking-wider text-sm-violet-deep">
              Sketch Site
            </p>
            <p className="mt-2 text-sm text-sm-ink3">
              Start a new sketch or open a saved one.
            </p>
          </div>
        )}
      </div>
    </aside>
  )
}

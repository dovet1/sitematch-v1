'use client'

import { useMemo, useState } from 'react'
import {
  Plus,
  X,
  Check,
  Target,
  RotateCcw,
  MapPin,
  Search,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react'
import * as SliderPrimitive from '@radix-ui/react-slider'
import {
  useWorkspaceStore,
  MIN_POPULATION,
  MAX_POPULATION,
} from '../../lib/stores/unified-workspace-store'
import type {
  GapRule,
  ReferenceData,
} from '../../types/unified-workspace'
import { Checkbox } from '@/components/ui/checkbox'
import { CatchmentControl } from './CatchmentControl'

type RuleType = 'category' | 'brand' | 'fascia'
interface ValueOption {
  id: string
  label: string
  targetIds: string[]
}

function optionsFor(type: RuleType, ref: ReferenceData): ValueOption[] {
  if (type === 'category') {
    return ref.categories.map((c) => ({ id: c.id, label: c.name, targetIds: [c.id] }))
  }
  if (type === 'brand') {
    return ref.brands.map((b) => ({
      id: b.id,
      label: b.name,
      targetIds: b.fascias.map((f) => f.id),
    }))
  }
  return ref.brands
    .flatMap((b) => b.fascias.map((f) => ({ brand: b.name, ...f })))
    .map((f) => ({ id: f.id, label: f.name, targetIds: [f.id] }))
    .sort((a, b) => a.label.localeCompare(b.label))
}

const RULE_TYPES: { value: RuleType; label: string }[] = [
  { value: 'category', label: 'Category' },
  { value: 'brand', label: 'Brand' },
  { value: 'fascia', label: 'Fascia' },
]
const KM_STEPS = [1, 3, 5, 10]

function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div className="flex gap-1 rounded-lg bg-sm-bg p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={
            'flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors ' +
            (value === o.value
              ? 'bg-sm-ink text-white'
              : 'text-sm-ink2 hover:bg-sm-border-soft')
          }
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

function ruleConditionLabel(r: GapRule) {
  if (r.kind === 'proximity') return `${r.op === 'within' ? 'Within' : 'Beyond'} ${r.km} km`
  return r.op === 'has' ? 'Contains' : 'Excludes'
}
function ruleIsPositive(r: GapRule) {
  return r.op === 'has' || r.op === 'within'
}

function RuleRow({
  rule,
  onToggle,
  onRemove,
}: {
  rule: GapRule
  onToggle: (id: string) => void
  onRemove: (id: string) => void
}) {
  const positive = ruleIsPositive(rule)
  return (
    <div
      className={
        'mb-2 flex items-center gap-2.5 rounded-lg border p-2.5 ' +
        (positive
          ? 'border-sm-violet-tint bg-sm-violet-tint-soft'
          : 'border-[#F4D2CC] bg-[#FCECEA]')
      }
    >
      <span
        className={
          'flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-white ' +
          (positive ? 'bg-sm-violet' : 'bg-[#C2452F]')
        }
      >
        {rule.kind === 'proximity' ? (
          <Target size={12} />
        ) : positive ? (
          <Check size={12} />
        ) : (
          <X size={12} />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <button
          type="button"
          onClick={() => onToggle(rule.id)}
          title="Flip condition"
          className={
            'flex items-center gap-1 font-mono text-[9.5px] font-bold uppercase tracking-wider ' +
            (positive ? 'text-sm-violet-deep' : 'text-[#B23A2C]')
          }
        >
          {ruleConditionLabel(rule)}
          <RotateCcw size={9} />
        </button>
        <div className="mt-0.5 truncate text-[13px] font-semibold text-sm-ink">
          {rule.value}{' '}
          <span className="font-mono text-[10px] font-normal text-sm-ink3">
            · {rule.type[0].toUpperCase() + rule.type.slice(1)}
          </span>
        </div>
      </div>
      <button
        type="button"
        onClick={() => onRemove(rule.id)}
        title="Remove"
        className="shrink-0 p-1 text-sm-ink4 hover:text-sm-ink2"
      >
        <X size={12} />
      </button>
    </div>
  )
}

function RuleBuilder({
  refData,
  onAdd,
  onCancel,
}: {
  refData: ReferenceData
  onAdd: (rule: GapRule) => void
  onCancel: () => void
}) {
  const [kind, setKind] = useState<'presence' | 'proximity'>('presence')
  const [type, setType] = useState<RuleType>('brand')
  const [selected, setSelected] = useState<ValueOption | null>(null)
  const [pOp, setPOp] = useState<'has' | 'lacks'>('has')
  const [zOp, setZOp] = useState<'within' | 'beyond'>('within')
  const [km, setKm] = useState(5)
  const [query, setQuery] = useState('')

  const options = useMemo(() => optionsFor(type, refData), [type, refData])
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options
    return list.slice(0, 100)
  }, [options, query])

  const commit = () => {
    if (!selected) return
    onAdd({
      id: 'r' + Date.now(),
      kind,
      type,
      value: selected.label,
      targetIds: selected.targetIds,
      op: kind === 'presence' ? pOp : zOp,
      ...(kind === 'proximity' ? { km } : {}),
    })
  }

  return (
    <div className="rounded-xl border border-sm-border bg-sm-bg p-3">
      <p className="font-mono text-[9.5px] font-semibold uppercase tracking-wider text-sm-ink3">
        Condition
      </p>
      <div className="mt-1.5">
        <Segmented
          options={[
            { value: 'presence', label: 'Presence' },
            { value: 'proximity', label: 'Proximity' },
          ]}
          value={kind}
          onChange={setKind}
        />
      </div>

      <p className="mt-3 font-mono text-[9.5px] font-semibold uppercase tracking-wider text-sm-ink3">
        Match on
      </p>
      <div className="mt-1.5">
        <Segmented
          options={RULE_TYPES}
          value={type}
          onChange={(t) => {
            setType(t)
            setSelected(null)
          }}
        />
      </div>

      <div className="mt-2.5">
        <div className="flex h-9 items-center gap-2 rounded-lg border border-sm-border bg-sm-surface px-2.5">
          <Search size={13} className="text-sm-ink3" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search ${type}…`}
            className="w-full bg-transparent text-xs text-sm-ink placeholder:text-sm-ink3 focus:outline-none"
          />
        </div>
        <div className="mt-1.5 max-h-40 overflow-y-auto rounded-lg border border-sm-border-soft bg-sm-surface">
          {filtered.length === 0 && (
            <div className="px-3 py-2.5 text-xs text-sm-ink3">No matches</div>
          )}
          {filtered.map((o) => {
            const on = selected?.id === o.id
            return (
              <button
                key={o.id}
                type="button"
                onClick={() => setSelected(o)}
                className={
                  'flex w-full items-center gap-2 border-b border-sm-border-soft px-3 py-1.5 text-left text-xs ' +
                  (on ? 'bg-sm-violet-tint-soft' : 'hover:bg-sm-bg')
                }
              >
                <span
                  className={
                    'flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ' +
                    (on ? 'border-sm-violet bg-sm-violet text-white' : 'border-sm-border')
                  }
                >
                  {on && <Check size={9} />}
                </span>
                <span className={on ? 'font-semibold text-sm-ink' : 'text-sm-ink'}>
                  {o.label}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {kind === 'presence' ? (
        <>
          <p className="mt-3 font-mono text-[9.5px] font-semibold uppercase tracking-wider text-sm-ink3">
            Town must
          </p>
          <div className="mt-1.5">
            <Segmented
              options={[
                { value: 'has', label: 'Contain it' },
                { value: 'lacks', label: 'Exclude it' },
              ]}
              value={pOp}
              onChange={setPOp}
            />
          </div>
        </>
      ) : (
        <>
          <p className="mt-3 font-mono text-[9.5px] font-semibold uppercase tracking-wider text-sm-ink3">
            Proximity
          </p>
          <div className="mt-1.5">
            <Segmented
              options={[
                { value: 'within', label: 'Within' },
                { value: 'beyond', label: 'Beyond' },
              ]}
              value={zOp}
              onChange={setZOp}
            />
          </div>
          <div className="mt-2 flex gap-1.5">
            {KM_STEPS.map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setKm(v)}
                className={
                  'flex-1 rounded-md py-1.5 font-mono text-[11px] transition-colors ' +
                  (km === v
                    ? 'bg-sm-ink text-white'
                    : 'border border-sm-border-soft bg-sm-surface text-sm-ink2')
                }
              >
                {v} km
              </button>
            ))}
          </div>
        </>
      )}

      <div className="mt-3.5 flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-lg border border-sm-border bg-sm-surface py-2 text-[13px] font-medium text-sm-ink2"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={commit}
          disabled={!selected}
          className="flex-[1.4] rounded-lg bg-sm-violet py-2 text-[13px] font-semibold text-white disabled:opacity-50"
        >
          Add filter
        </button>
      </div>
    </div>
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
  const gapRules = useWorkspaceStore((s) => s.gapRules)
  const addGapRule = useWorkspaceStore((s) => s.addGapRule)
  const removeGapRule = useWorkspaceStore((s) => s.removeGapRule)
  const toggleGapRule = useWorkspaceStore((s) => s.toggleGapRule)
  const populationRange = useWorkspaceStore((s) => s.populationRange)
  const setPopulationRange = useWorkspaceStore((s) => s.setPopulationRange)
  const showSubFiveK = useWorkspaceStore((s) => s.showSubFiveK)
  const setShowSubFiveK = useWorkspaceStore((s) => s.setShowSubFiveK)
  const [building, setBuilding] = useState(false)

  return (
    <>
      <div className="border-b border-sm-border-soft px-[18px] py-[18px]">
        <p className="font-mono text-[10px] uppercase tracking-wider text-sm-violet-deep">
          Find Gaps
        </p>
        <h2 className="mt-1 text-[17px] font-semibold tracking-[-0.3px] text-sm-ink">
          Filters
        </h2>
        <p className="mt-1 text-[12.5px] leading-snug text-sm-ink3">
          Surface towns by presence and proximity, then read the gaps on the right.
        </p>
      </div>

      <SectionLabel>Presence &amp; proximity</SectionLabel>
      <div className="px-[18px] pb-[18px] pt-3">
        <p className="mb-2.5 text-[11.5px] leading-snug text-sm-ink3">
          Surface towns by what they contain — or don&apos;t — and by distance to any
          category, brand or fascia.
        </p>
        {gapRules.map((r) => (
          <RuleRow key={r.id} rule={r} onToggle={toggleGapRule} onRemove={removeGapRule} />
        ))}
        {gapRules.length === 0 && !building && (
          <div className="mb-2.5 rounded-lg border border-dashed border-sm-border px-3 py-4 text-center text-xs text-sm-ink3">
            No filters yet — showing every built-up area.
          </div>
        )}
        {building ? (
          <RuleBuilder
            refData={refData}
            onAdd={(r) => {
              addGapRule(r)
              setBuilding(false)
            }}
            onCancel={() => setBuilding(false)}
          />
        ) : (
          <button
            type="button"
            onClick={() => setBuilding(true)}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-sm-border bg-sm-surface py-2 text-[12.5px] font-medium text-sm-ink hover:bg-sm-bg"
          >
            <Plus size={13} /> Add filter
          </button>
        )}
      </div>

      <SectionLabel>Population</SectionLabel>
      <div className="px-[18px] pb-[18px] pt-3">
        <div className="flex items-center justify-between font-mono text-[11px] text-sm-ink2">
          <span>{populationRange[0].toLocaleString()}</span>
          <span>{populationRange[1].toLocaleString()}</span>
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

function AssessPoint() {
  const assessPoint = useWorkspaceStore((s) => s.assessPoint)

  if (!assessPoint) return null
  return (
    <>
      <div className="border-b border-sm-border-soft px-[18px] py-[18px]">
        <p className="font-mono text-[10px] uppercase tracking-wider text-sm-violet-deep">
          Assess Area
        </p>
        <h2 className="mt-1 text-[17px] font-semibold tracking-[-0.3px] text-sm-ink">
          This point
        </h2>
        <p className="mt-1 text-[12.5px] leading-snug text-sm-ink3">
          Set the catchment around the dropped pin — the landscape on the right updates.
        </p>
      </div>
      <div className="px-[18px] py-[18px]">
        <div className="flex items-start gap-2.5 rounded-lg border border-sm-violet-tint bg-sm-violet-tint-soft p-3">
          <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-lg bg-sm-violet text-white">
            <MapPin size={15} />
          </span>
          <div className="min-w-0">
            <div className="text-[13.5px] font-semibold text-sm-ink">Dropped pin</div>
            <div className="mt-0.5 font-mono text-[11px] text-sm-ink3">
              {assessPoint.lat.toFixed(4)}, {assessPoint.lng.toFixed(4)}
            </div>
          </div>
        </div>

        <div className="mt-4">
          <CatchmentControl />
        </div>
      </div>

      <div className="px-[18px] py-3 text-[11.5px] leading-snug text-sm-ink3">
        Drop a different pin anywhere on the map to assess another point.
      </div>
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

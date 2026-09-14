'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import type { PlotaApplication } from '@/lib/planning-intelligence/types'

type Decision = 'approved' | 'corrected' | 'rejected'
type Signal = {
  id: string
  observed_name: string
  role: string
  review_state: string
  evidence_excerpt?: string
  evidence_url?: string
}
type Observation = {
  id: string
  metric: string
  scope: string
  value: number
  unit: string
  review_state: string
  evidence_excerpt?: string
  evidence_url?: string
  evidence_page?: string
}
export type ReviewDevelopment = {
  id: string
  canonical_name: string
  site_address?: string
  relevance: string
  confidence: number | null
  summary: string | null
  updated_at: string
  unanswered_questions: string[]
  model_dwelling_count: number | null
  creates_commercial_space: string
  commercial_use_classes: string[]
  applications: {
    planning_applications: {
      raw: PlotaApplication
      stated_dwelling_count: number | null
    }
  }[]
  brandSignals: Signal[]
  observations: Observation[]
}
const inputClass =
  'w-full rounded-md border border-input bg-background px-3 py-2 text-sm'
const label = (value: string) => value.replaceAll('_', ' ')
function SourceLink({
  url,
  children,
}: {
  url?: string | null
  children: React.ReactNode
}) {
  if (!url || !/^https?:\/\//i.test(url)) return null
  return (
    <a
      className="text-primary underline underline-offset-4"
      href={url}
      target="_blank"
      rel="noopener noreferrer"
    >
      {children} ↗
    </a>
  )
}
export function ReviewEditor({
  development: d,
  onSaved,
  onDirty,
}: {
  development: ReviewDevelopment
  onSaved: (message: string) => void
  onDirty?: (dirty: boolean) => void
}) {
  const [relevance, setRelevance] = useState(d.relevance)
  const [summary, setSummary] = useState(d.summary ?? '')
  const [dwellings, setDwellings] = useState(
    d.model_dwelling_count?.toString() ?? ''
  )
  const [commercial, setCommercial] = useState(
    d.creates_commercial_space ?? 'unclear'
  )
  const [classes, setClasses] = useState(
    (d.commercial_use_classes ?? []).join(', ')
  )
  const [signals, setSignals] = useState(d.brandSignals)
  const [observations, setObservations] = useState(d.observations)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const changed =
    relevance !== d.relevance ||
    summary !== (d.summary ?? '') ||
    dwellings !== (d.model_dwelling_count?.toString() ?? '') ||
    commercial !== (d.creates_commercial_space ?? 'unclear') ||
    classes !== (d.commercial_use_classes ?? []).join(', ') ||
    signals !== d.brandSignals ||
    observations !== d.observations
  useEffect(() => {
    onDirty?.(changed)
    return () => onDirty?.(false)
  }, [changed, onDirty])
  useEffect(() => {
    if (!changed) return
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [changed])
  async function save(decision: Decision) {
    setError('')
    if (
      dwellings !== '' &&
      (!Number.isInteger(Number(dwellings)) ||
        Number(dwellings) < 0 ||
        Number(dwellings) > 1000000)
    ) {
      setError('Enter a whole dwelling count, or leave it blank for unknown.')
      return
    }
    if (
      observations.some(
        (o) => !Number.isFinite(o.value) || (o.scope !== 'net' && o.value < 0)
      )
    ) {
      setError('Only a net change can have a negative area or count.')
      return
    }
    setBusy(true)
    try {
      const response = await fetch('/api/admin/planning/review', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          developmentId: d.id,
          expectedUpdatedAt: d.updated_at,
          decision,
          relevance,
          summary,
          fields: {
            dwellingCount: dwellings === '' ? null : Number(dwellings),
            createsCommercialSpace: commercial,
            commercialUseClasses: classes
              .split(',')
              .map((x) => x.trim())
              .filter(Boolean),
          },
          brandSignals: signals.map((s) => ({
            id: s.id,
            role: s.role,
            reviewState:
              s.review_state === 'pending'
                ? decision === 'rejected'
                  ? 'rejected'
                  : 'approved'
                : s.review_state,
          })),
          observations: observations.map((o) => ({
            id: o.id,
            scope: o.scope,
            value: o.value,
            reviewState:
              o.review_state === 'pending'
                ? decision === 'rejected'
                  ? 'rejected'
                  : 'approved'
                : o.review_state,
          })),
        }),
      })
      const result = await response.json()
      if (!response.ok)
        throw new Error(result.error ?? 'Could not save this review.')
      onSaved(
        `Review saved.${result.research_state === 'processing' ? ' Research is already running and may still finish.' : ''}`
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save this review.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <article className="space-y-6">
      <header>
        <h2 className="text-xl font-semibold">{d.canonical_name}</h2>
        <p className="text-muted-foreground">{d.site_address}</p>
        <p className="mt-2 text-sm">
          Confidence:{' '}
          {d.confidence == null
            ? 'Unknown'
            : `${Math.round(d.confidence * 100)}%`}{' '}
          · Original relevance: {label(d.relevance)}
        </p>
      </header>
      {(d.unanswered_questions ?? []).length > 0 && (
        <section className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-950">
          <h3 className="font-semibold">Questions to check</h3>
          <ul className="mt-2 list-disc pl-5">
            {d.unanswered_questions.map((q, i) => (
              <li key={i}>{q}</li>
            ))}
          </ul>
        </section>
      )}
      <div className="grid gap-6 xl:grid-cols-2">
        <section className="space-y-4">
          <h3 className="font-semibold">Source applications</h3>
          {d.applications.map(({ planning_applications: a }, i) => (
            <div key={i} className="rounded-lg border p-4 space-y-3">
              <p className="font-medium">
                {a.raw.reference} · {a.raw.authority?.name}
              </p>
              <p className="whitespace-pre-wrap text-sm leading-6">
                {a.raw.description || 'No description available.'}
              </p>
              <p className="text-sm">
                Source dwelling count: {a.stated_dwelling_count ?? 'Not stated'}
              </p>
              <SourceLink url={a.raw.links?.council}>
                Open council application
              </SourceLink>
            </div>
          ))}
          <details className="rounded-lg border p-4">
            <summary className="cursor-pointer font-medium">
              Classification before this review
            </summary>
            <p className="mt-3 whitespace-pre-wrap text-sm">
              {d.summary || 'No summary'}
            </p>
            <p className="mt-2 text-sm">
              Dwellings: {d.model_dwelling_count ?? 'Unknown'} · Creates
              commercial space: {d.creates_commercial_space ?? 'unclear'} · Use
              classes:{' '}
              {(d.commercial_use_classes ?? []).join(', ') || 'Unknown'}
            </p>
          </details>
        </section>
        <fieldset disabled={busy} className="space-y-4">
          <legend className="mb-4 font-semibold">Your review</legend>
          <label className="block text-sm font-medium">
            Relevance
            <select
              className={inputClass}
              value={relevance}
              onChange={(e) => setRelevance(e.target.value)}
            >
              {['high', 'medium', 'low'].map((v) => (
                <option key={v} value={v}>
                  {label(v)}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-medium">
            Summary
            <textarea
              className={inputClass}
              rows={6}
              maxLength={4000}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
            />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-medium">
              Dwelling count
              <input
                className={inputClass}
                type="number"
                min={0}
                max={1000000}
                step={1}
                placeholder="Unknown"
                value={dwellings}
                onChange={(e) => setDwellings(e.target.value)}
              />
            </label>
            <label className="block text-sm font-medium">
              Commercial unit built or changed use
              <select
                className={inputClass}
                value={commercial}
                onChange={(e) => setCommercial(e.target.value)}
              >
                {['yes', 'no', 'unclear'].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
          </div>
          <label className="block text-sm font-medium">
            Commercial use classes
            <input
              className={inputClass}
              value={classes}
              onChange={(e) => setClasses(e.target.value)}
              placeholder="For example: E, B8"
            />
          </label>
          <p className="text-xs text-muted-foreground">
            Separate classes with commas. Keep unknown counts blank; zero means
            a confirmed zero.
          </p>
        </fieldset>
      </div>
      <section className="space-y-3">
        <h3 className="font-semibold">People and brands</h3>
        {signals.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No brand or operator evidence recorded.
          </p>
        )}
        {signals.map((s, i) => (
          <div key={s.id} className="rounded-lg border p-4 space-y-2">
            <p className="font-medium">{s.observed_name}</p>
            <p className="text-sm">{s.evidence_excerpt}</p>
            <SourceLink url={s.evidence_url}>Evidence</SourceLink>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm">
                Role
                <select
                  disabled={busy}
                  className={inputClass}
                  value={s.role}
                  onChange={(e) =>
                    setSignals(
                      signals.map((v, j) =>
                        j === i
                          ? {
                              ...v,
                              role: e.target.value,
                              review_state: 'corrected',
                            }
                          : v
                      )
                    )
                  }
                >
                  {[
                    'proposed_occupier',
                    'proposed_operator',
                    'applicant_developer',
                    'existing_occupier',
                    'former_occupier',
                    'neighbouring_occupier',
                    'referenced_only',
                    'unclear',
                  ].map((v) => (
                    <option key={v} value={v}>
                      {label(v)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm">
                Evidence decision
                <select
                  disabled={busy}
                  className={inputClass}
                  value={s.review_state}
                  onChange={(e) =>
                    setSignals(
                      signals.map((v, j) =>
                        j === i ? { ...v, review_state: e.target.value } : v
                      )
                    )
                  }
                >
                  {['pending', 'approved', 'corrected', 'rejected'].map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </label>
            </div>
          </div>
        ))}
      </section>
      <section className="space-y-3">
        <h3 className="font-semibold">Area and dwelling evidence</h3>
        {observations.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No measured area or dwelling evidence recorded.
          </p>
        )}
        {observations.map((o, i) => (
          <div key={o.id} className="rounded-lg border p-4 space-y-2">
            <p className="font-medium">
              {label(o.metric)} · {o.unit}
            </p>
            <p className="text-sm">
              {o.evidence_excerpt}
              {o.evidence_page ? ` (page ${o.evidence_page})` : ''}
            </p>
            <SourceLink url={o.evidence_url}>Evidence</SourceLink>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="text-sm">
                Scope
                <select
                  disabled={busy}
                  className={inputClass}
                  value={o.scope}
                  onChange={(e) =>
                    setObservations(
                      observations.map((v, j) =>
                        j === i
                          ? {
                              ...v,
                              scope: e.target.value,
                              review_state: 'corrected',
                            }
                          : v
                      )
                    )
                  }
                >
                  {[
                    'existing',
                    'proposed',
                    'lost',
                    'net',
                    'stated_unspecified',
                  ].map((v) => (
                    <option key={v} value={v}>
                      {label(v)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm">
                Value
                <input
                  disabled={busy}
                  className={inputClass}
                  type="number"
                  step="any"
                  value={Number.isNaN(o.value) ? '' : o.value}
                  onChange={(e) =>
                    setObservations(
                      observations.map((v, j) =>
                        j === i
                          ? {
                              ...v,
                              value:
                                e.target.value === ''
                                  ? NaN
                                  : Number(e.target.value),
                              review_state: 'corrected',
                            }
                          : v
                      )
                    )
                  }
                />
              </label>
              <label className="text-sm">
                Evidence decision
                <select
                  disabled={busy}
                  className={inputClass}
                  value={o.review_state}
                  onChange={(e) =>
                    setObservations(
                      observations.map((v, j) =>
                        j === i ? { ...v, review_state: e.target.value } : v
                      )
                    )
                  }
                >
                  {['pending', 'approved', 'corrected', 'rejected'].map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </label>
            </div>
          </div>
        ))}
      </section>
      {error && (
        <p
          role="alert"
          className="rounded-md border border-red-300 p-3 text-red-700"
        >
          {error}
        </p>
      )}
      <footer className="flex flex-wrap items-center gap-3 border-t bg-background py-4">
        <Button
          disabled={busy}
          onClick={() => save(changed ? 'corrected' : 'approved')}
        >
          {busy
            ? 'Saving…'
            : changed
              ? 'Save corrections'
              : 'Approve classification'}
        </Button>
        <Button
          variant="outline"
          disabled={busy}
          onClick={() => save('rejected')}
        >
          Reject classification
        </Button>
        <p className="text-xs text-muted-foreground">
          Confirms the values above and saves an audit history.
        </p>
      </footer>
    </article>
  )
}
export default function PlanningReview() {
  const [dirty, setDirty] = useState(false)
  const discard = () => !dirty || window.confirm('Discard your unsaved edits?')
  const [rows, setRows] = useState<ReviewDevelopment[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [filter, setFilter] = useState('all')
  const [offset, setOffset] = useState(0)
  const [more, setMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const load = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true)
      setError('')
      try {
        const response = await fetch(
          `/api/admin/planning/review?limit=25&offset=${offset}&filter=${filter}`,
          { signal }
        )
        const result = await response.json()
        if (!response.ok)
          throw new Error(result.error ?? 'Could not load the queue.')
        setRows(result.developments)
        setMore(Boolean(result.hasMore))
        setSelected(result.developments[0]?.id ?? null)
      } catch (e) {
        if (!signal?.aborted)
          setError(e instanceof Error ? e.message : 'Could not load the queue.')
      } finally {
        if (!signal?.aborted) setLoading(false)
      }
    },
    [offset, filter]
  )
  useEffect(() => {
    const controller = new AbortController()
    void load(controller.signal)
    return () => controller.abort()
  }, [load])
  const active = rows.find((d) => d.id === selected)
  return (
    <main className="mx-auto max-w-7xl space-y-6 p-4 md:p-8">
      <Link href="/admin" className="text-sm text-primary underline">
        ← Admin dashboard
      </Link>
      <header>
        <h1 className="text-3xl font-semibold">Planning review</h1>
        <p className="mt-2 text-muted-foreground">
          Check the evidence, correct the findings and approve useful
          applications.
        </p>
        <p className="mt-2 text-sm">
          <Link href="/admin/planning/completion" className="text-primary underline">
            Planning completion: facts research could not establish →
          </Link>
        </p>
      </header>
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm">
          Show
          <select
            className={inputClass}
            value={filter}
            onChange={(e) => {
              if (discard()) {
                setFilter(e.target.value)
                setOffset(0)
              }
            }}
          >
            <option value="all">All pending classifications</option>
            <option value="uncertain">Low or unknown confidence</option>
            <option value="questions">Unanswered questions</option>
          </select>
        </label>
        <Button
          variant="outline"
          disabled={loading}
          onClick={() => {
            if (discard()) void load()
          }}
        >
          Reload queue
        </Button>
        <p className="text-sm text-muted-foreground">Lowest confidence first</p>
      </div>
      {message && (
        <p role="status" className="rounded-lg border bg-muted p-3">
          {message}
        </p>
      )}
      {error ? (
        <p role="alert" className="text-red-700">
          {error}
        </p>
      ) : loading ? (
        <p role="status">Loading classifications…</p>
      ) : rows.length === 0 ? (
        <p className="rounded-lg border p-8">
          No pending classifications match this filter.
        </p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
          <nav
            aria-label="Classifications"
            className="max-h-80 space-y-2 overflow-y-auto lg:max-h-[75vh] lg:sticky lg:top-6"
          >
            {rows.map((d) => (
              <button
                key={d.id}
                aria-current={selected === d.id ? 'true' : undefined}
                className={`w-full rounded-lg border p-3 text-left text-sm ${selected === d.id ? 'border-primary bg-muted' : 'hover:bg-muted'}`}
                onClick={() => {
                  if (selected !== d.id && discard()) setSelected(d.id)
                }}
              >
                <span className="block font-medium">{d.canonical_name}</span>
                <span className="text-muted-foreground">
                  {d.relevance} relevance ·{' '}
                  {d.confidence == null
                    ? 'Unknown confidence'
                    : `${Math.round(d.confidence * 100)}% confidence`}
                </span>
              </button>
            ))}
            <div className="flex gap-2">
              <Button
                variant="outline"
                disabled={offset === 0}
                onClick={() => {
                  if (discard()) setOffset(Math.max(0, offset - 25))
                }}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                disabled={!more}
                onClick={() => {
                  if (discard()) setOffset(offset + 25)
                }}
              >
                Next
              </Button>
            </div>
          </nav>
          {active && (
            <ReviewEditor
              key={active.id + active.updated_at}
              development={active}
              onDirty={setDirty}
              onSaved={(m) => {
                setMessage(m)
                void load()
              }}
            />
          )}
        </div>
      )}
    </main>
  )
}

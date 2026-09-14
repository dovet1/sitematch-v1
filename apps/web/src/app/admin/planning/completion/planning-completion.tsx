'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import {
  FACT_LABELS,
  REASON_LABELS,
  formatFactValue,
  type FactFinding,
  type FactKey,
  type FactRow,
  type FactValue,
} from '@/lib/planning-intelligence/facts'

type StoredFact = FactRow & { admin_note: string | null; updated_at: string | null }
type Application = {
  role: string
  planning_applications: {
    id: string
    reference: string
    authority_name: string
    description: string | null
    stage: string | null
    date_received: string | null
    links: { council?: string } | null
  } | null
}
export type CompletionDevelopment = {
  id: string
  canonical_name: string
  site_address: string | null
  summary: string | null
  relevance: string | null
  research_outcome: string | null
  research_finished_at: string | null
  research_attempts: number
  facts: StoredFact[]
  applications: Application[]
}

const ROLE_TEXT: Record<string, string> = {
  primary: 'this scheme', principal: 'this scheme', amendment: 'amendment read with the scheme',
  member: 'read with the scheme', condition: 'condition paperwork on the timeline', related: 'follow-up paperwork on the timeline',
}
const application_label = (count: number) => (count > 1 ? `${count} applications grouped · ` : '')

const inputClass = 'w-full rounded-md border border-input bg-background px-3 py-2 text-sm'
const AREA_FACTS = new Set<FactKey>(['existing_floorspace', 'proposed_floorspace', 'net_floorspace', 'site_area'])
const OPEN = new Set(['not_found_after_research', 'conflicting'])

const STATE_TEXT: Record<string, string> = {
  not_checked: 'Not checked',
  found: 'Found',
  not_found_after_research: 'Missing',
  conflicting: 'Conflicting',
  unavailable: 'Unavailable',
  not_applicable: 'Not applicable',
}
const STATE_CLASS: Record<string, string> = {
  found: 'bg-emerald-100 text-emerald-900',
  not_found_after_research: 'bg-amber-100 text-amber-950',
  conflicting: 'bg-red-100 text-red-900',
  unavailable: 'bg-slate-200 text-slate-800',
  not_applicable: 'bg-slate-100 text-slate-700',
  not_checked: 'bg-slate-100 text-slate-700',
}

function safeUrl(url: string | null | undefined): string | null {
  return url && /^https?:\/\//i.test(url) ? url : null
}

function formatAdminValue(value: FactValue | null): string {
  if (!value) return ''
  if ('names' in value || 'useClasses' in value) return formatFactValue(value) ?? ''
  const extent = value.extent === 'unspecified' ? ' — extent not stated' : ''
  return `${formatFactValue(value)}${extent}`
}

function findingText(finding: FactFinding): string {
  if (finding.name) return `${finding.name}${finding.role ? ` (${finding.role.replaceAll('_', ' ')})` : ''}`
  if (finding.useClass) return finding.useClass
  if (typeof finding.sqm === 'number') {
    return formatAdminValue({ sqm: finding.sqm, basis: finding.basis ?? 'unspecified', extent: finding.extent ?? 'unspecified', original: finding.original })
  }
  return ''
}

function Finding({ finding }: { finding: FactFinding }) {
  const url = safeUrl(finding.source.url)
  return (
    <li className={`rounded border p-2 text-sm ${finding.rejected ? 'opacity-50 line-through' : ''}`}>
      <p className="font-medium">
        {findingText(finding)}
        {!finding.completes && <span className="ml-2 text-xs font-normal text-muted-foreground">context only, does not complete this fact</span>}
      </p>
      {finding.note && <p className="text-xs text-muted-foreground">{finding.note}</p>}
      {finding.source.excerpt && <p className="mt-1 text-xs italic">“{finding.source.excerpt.slice(0, 300)}”</p>}
      <p className="mt-1 text-xs text-muted-foreground">
        {finding.source.kind.replaceAll('_', ' ')}
        {finding.source.page ? `, page ${finding.source.page}` : ''}
        {url && <> · <a className="text-primary underline" href={url} target="_blank" rel="noopener noreferrer">source ↗</a></>}
      </p>
    </li>
  )
}

function AddFactForm({ fact, onSubmit, busy }: {
  fact: FactKey
  busy: boolean
  onSubmit: (body: Record<string, unknown>) => void
}) {
  const [text, setText] = useState('')
  const [value, setValue] = useState('')
  const [unit, setUnit] = useState('sqm')
  const [extent, setExtent] = useState('whole_development')
  const [basis, setBasis] = useState(fact === 'site_area' ? 'unspecified' : 'gross_internal')
  const [url, setUrl] = useState('')
  const [excerpt, setExcerpt] = useState('')
  const [page, setPage] = useState('')

  function submit() {
    const source = { url: url.trim() || null, excerpt: excerpt.trim() || null, page: page.trim() || null }
    const list = text.split(',').map(item => item.trim()).filter(Boolean)
    onSubmit({
      action: 'add', source,
      ...(fact === 'operator' ? { names: list } : {}),
      ...(fact === 'existing_use_class' || fact === 'proposed_use_class' ? { useClasses: list } : {}),
      ...(AREA_FACTS.has(fact) ? { area: { value: Number(value), unit, extent, basis } } : {}),
    })
  }

  return (
    <div className="space-y-2 rounded-md border bg-muted/30 p-3">
      {AREA_FACTS.has(fact) ? (
        <div className="grid gap-2 sm:grid-cols-4">
          <input className={inputClass} type="number" step="any" placeholder="Area" value={value} onChange={e => setValue(e.target.value)} aria-label="Area" />
          <select className={inputClass} value={unit} onChange={e => setUnit(e.target.value)} aria-label="Unit">
            <option value="sqm">m²</option><option value="sqft">sq ft</option><option value="hectares">hectares</option><option value="acres">acres</option>
          </select>
          <select className={inputClass} value={extent} onChange={e => setExtent(e.target.value)} aria-label="What the figure covers">
            <option value="whole_development">Whole development</option><option value="unspecified">Not stated</option>
          </select>
          <select className={inputClass} value={basis} onChange={e => setBasis(e.target.value)} aria-label="Measurement basis">
            <option value="gross_internal">Gross internal</option><option value="gross_external">Gross external</option>
            <option value="net_internal">Net internal</option><option value="unspecified">Not stated</option>
          </select>
        </div>
      ) : (
        <input className={inputClass} placeholder={fact === 'operator' ? 'Operator or occupier name(s), comma separated' : 'Use class(es), e.g. E(g)(iii), B8'} value={text} onChange={e => setText(e.target.value)} aria-label={FACT_LABELS[fact]} />
      )}
      {fact === 'operator' && <p className="text-xs text-muted-foreground">Only the business that will occupy or run the space. Not the applicant, developer or agent.</p>}
      <div className="grid gap-2 sm:grid-cols-[1fr_6rem]">
        <input className={inputClass} placeholder="Source link" value={url} onChange={e => setUrl(e.target.value)} aria-label="Source link" />
        <input className={inputClass} placeholder="Page" value={page} onChange={e => setPage(e.target.value)} aria-label="Page" />
      </div>
      <textarea className={inputClass} rows={2} placeholder="Quote the evidence (required if there is no link)" value={excerpt} onChange={e => setExcerpt(e.target.value)} aria-label="Evidence quote" />
      <Button size="sm" disabled={busy} onClick={submit}>Save fact</Button>
    </div>
  )
}

function FactCard({ developmentId, fact, onChanged }: {
  developmentId: string
  fact: StoredFact
  onChanged: () => void
}) {
  const [adding, setAdding] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const open = OPEN.has(fact.state) && !fact.decided_by
  const lastAttempt = fact.attempts.at(-1)
  const completing = fact.findings.filter(f => f.completes && !f.rejected)
  const newSinceDecision = fact.decided_at
    ? fact.findings.filter(f => f.origin !== 'admin' && f.observedAt > fact.decided_at!)
    : []

  async function send(body: Record<string, unknown>) {
    setBusy(true)
    setError('')
    try {
      const response = await fetch('/api/admin/planning/facts', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ developmentId, fact: fact.fact, expectedUpdatedAt: fact.updated_at, ...body }),
      })
      const json = await response.json()
      if (!response.ok) throw new Error(json.error ?? 'Could not save')
      setAdding(false)
      onChanged()
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : 'Could not save')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className={`space-y-2 rounded-lg border p-4 ${open ? 'border-amber-300' : ''}`}>
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="font-semibold">{FACT_LABELS[fact.fact]}</h4>
        <span className={`rounded px-2 py-0.5 text-xs font-medium ${STATE_CLASS[fact.state] ?? ''}`}>
          {STATE_TEXT[fact.state] ?? fact.state}{fact.decided_by ? ' · decided by admin' : ''}
        </span>
      </header>

      {fact.value && <p className="text-sm">{formatAdminValue(fact.value)}</p>}

      {open && (
        <p className="text-sm">
          {fact.state === 'conflicting'
            ? 'The sources give different figures. Choose the right one, add the correct figure, or mark it unavailable.'
            : <>{fact.reason ? REASON_LABELS[fact.reason] : 'Research did not establish this.'} Open the application and add it, or mark it unavailable.</>}
        </p>
      )}
      {open && lastAttempt && lastAttempt.retrievalWarnings.length > 0 && (
        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer">What research tried</summary>
          <p className="mt-1">{lastAttempt.documentsRetrieved} document(s) read, {lastAttempt.webSearches} web search(es).</p>
          <ul className="mt-1 list-disc pl-4">{lastAttempt.retrievalWarnings.slice(0, 6).map((w, i) => <li key={i}>{w}</li>)}</ul>
        </details>
      )}
      {newSinceDecision.length > 0 && (
        <p className="text-xs text-amber-800">New evidence has arrived since this decision. It has not changed the decision.</p>
      )}

      {fact.findings.length > 0 && (
        <ul className="space-y-1">
          {fact.findings.map(finding => (
            <div key={finding.key} className="flex items-start gap-2">
              <div className="flex-1"><Finding finding={finding} /></div>
              {fact.state === 'conflicting' && open && finding.completes && !finding.rejected && completing.length > 1 && (
                <Button size="sm" variant="outline" disabled={busy} onClick={() => send({ action: 'choose', findingKey: finding.key })}>Use this</Button>
              )}
            </div>
          ))}
        </ul>
      )}

      {fact.admin_note && <p className="text-xs text-muted-foreground">Note: {fact.admin_note}</p>}
      {error && <p className="text-sm text-red-700">{error}</p>}

      <div className="flex flex-wrap gap-2">
        {!fact.decided_by && (
          <>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => setAdding(!adding)}>{adding ? 'Cancel' : 'Add with evidence'}</Button>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => send({ action: 'unavailable' })}>Mark unavailable</Button>
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => send({ action: 'not_applicable' })}>Not applicable</Button>
          </>
        )}
        {fact.decided_by && <Button size="sm" variant="ghost" disabled={busy} onClick={() => send({ action: 'reopen' })}>Reopen</Button>}
      </div>
      {adding && <AddFactForm fact={fact.fact} busy={busy} onSubmit={send} />}
    </section>
  )
}

export default function PlanningCompletion() {
  const [developments, setDevelopments] = useState<CompletionDevelopment[] | null>(null)
  const [error, setError] = useState('')
  const [view, setView] = useState<'open' | 'decided'>('open')

  const load = useCallback(async () => {
    setError('')
    try {
      const response = await fetch(`/api/admin/planning/facts?limit=20&view=${view}`, { cache: 'no-store' })
      const json = await response.json()
      if (!response.ok) throw new Error(json.error ?? 'Could not load the queue')
      setDevelopments(json.developments)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load the queue')
    }
  }, [view])

  useEffect(() => { setDevelopments(null); load() }, [load])

  return (
    <main className="mx-auto max-w-6xl space-y-6 p-4 md:p-8">
      <Link href="/admin/planning" className="text-sm text-primary underline">← Classification review</Link>
      <header>
        <h1 className="text-3xl font-semibold">Planning completion</h1>
        <p className="mt-2 text-muted-foreground">
          Schemes research has finished with, and the facts it could not establish. Add each missing fact with its source,
          choose between conflicting figures, or mark it unavailable. Each fact publishes on its own.
        </p>
      </header>
      <div className="flex gap-2">
        <Button size="sm" variant={view === 'open' ? 'default' : 'outline'} onClick={() => setView('open')}>Open facts</Button>
        <Button size="sm" variant={view === 'decided' ? 'default' : 'outline'} onClick={() => setView('decided')}>Decided by admin</Button>
      </div>
      {error && <p className="rounded-md border border-red-300 p-3 text-red-700">{error}</p>}
      {developments === null && !error && <p>Loading…</p>}
      {developments?.length === 0 && <p className="text-muted-foreground">{view === 'open' ? 'Nothing waiting. Research has not left any open facts.' : 'No admin decisions yet.'}</p>}
      {developments?.map(development => {
        const open = development.facts.filter(fact => OPEN.has(fact.state) && !fact.decided_by).length
        return (
          <article key={development.id} className="space-y-4 rounded-xl border p-4 md:p-6">
            <header>
              <h2 className="text-xl font-semibold">{development.canonical_name}</h2>
              {development.site_address && <p className="text-muted-foreground">{development.site_address}</p>}
              <p className="mt-1 text-sm">
                {application_label(development.applications.length)}{open} open fact{open === 1 ? '' : 's'} · research {development.research_outcome === 'attempt_limit' ? 'stopped at its attempt limit' : 'finished'}
                {development.research_finished_at ? ` on ${new Date(development.research_finished_at).toLocaleDateString('en-GB')}` : ''}
              </p>
              {development.summary && <p className="mt-2 text-sm">{development.summary}</p>}
            </header>
            <section className="space-y-2">
              <h3 className="font-semibold">Applications</h3>
              {development.applications.map(({ role, planning_applications: application }) => application && (
                <div key={application.id} className="rounded border p-3 text-sm">
                  <p className="font-medium">
                    {application.reference} · {application.authority_name} · {ROLE_TEXT[role] ?? role}
                    {safeUrl(application.links?.council) && <> · <a className="text-primary underline" href={safeUrl(application.links?.council)!} target="_blank" rel="noopener noreferrer">council record ↗</a></>}
                  </p>
                  <p className="mt-1 text-muted-foreground">{application.description}</p>
                </div>
              ))}
            </section>
            <div className="grid gap-3 lg:grid-cols-2">
              {[...development.facts]
                .sort((a, b) => Number(OPEN.has(b.state) && !b.decided_by) - Number(OPEN.has(a.state) && !a.decided_by))
                .map(fact => <FactCard key={fact.fact} developmentId={development.id} fact={fact} onChanged={load} />)}
            </div>
          </article>
        )
      })}
    </main>
  )
}

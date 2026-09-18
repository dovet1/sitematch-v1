'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  accountsTypeLabel,
  companiesHouseUrl,
  statusLabel,
} from '@/lib/companies-house/facts'
import type { CompanyFactsRow } from '@/lib/companies-house/types'

/**
 * Links a brand to its UK trading company on Companies House. Brand Matcher shows that
 * company's register facts once — and only once — an admin confirms it here.
 *
 * The right entity is the operator that trades and signs leases (ALDI STORES LIMITED), not
 * the parent group or a property/finance vehicle. The suggestions are ordered with that in
 * mind, but they are only suggestions.
 */

interface Candidate {
  company_number: string
  company_name: string
  company_status: string | null
  company_type: string | null
  address_snippet: string | null
  date_of_creation: string | null
  score?: number
}

interface State {
  configured: boolean
  link: {
    company_number: string
    confirmed_at: string
    company_facts: CompanyFactsRow | null
  } | null
  suggestions: (Candidate & { searched_at: string })[]
}

const fmtDate = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'

export function CompaniesHouseSection({ brandId, brandName }: { brandId: string; brandName: string }) {
  const [state, setState] = useState<State | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [changing, setChanging] = useState(false)
  const [query, setQuery] = useState(brandName)
  const [searchResults, setSearchResults] = useState<Candidate[] | null>(null)
  const [manualNumber, setManualNumber] = useState('')

  const call = useCallback(
    async (label: string, input: RequestInfo, init?: RequestInit) => {
      setBusy(label)
      setError(null)
      try {
        const res = await fetch(input, init)
        const body = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(body.error || `Failed (${res.status})`)
        return body
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Request failed')
        return null
      } finally {
        setBusy(null)
      }
    },
    []
  )

  const url = `/api/admin/brands/${brandId}/company`

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      const body = await call('load', url)
      if (!cancelled && body) setState(body)
      if (!cancelled) setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [call, url])

  const apply = (body: State | null) => {
    if (body) setState(body)
    return body
  }

  const confirm = async (companyNumber: string) => {
    const body = apply(
      await call(`confirm:${companyNumber}`, url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyNumber }),
      })
    )
    if (body) {
      setChanging(false)
      setSearchResults(null)
      setManualNumber('')
    }
  }

  const action = (name: 'suggest' | 'refresh') =>
    call(name, url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: name }),
    }).then(apply)

  const unlink = async () => {
    if (!window.confirm(`Remove the Companies House link for ${brandName}? Brand Matcher stops showing its facts.`)) return
    apply(await call('unlink', url, { method: 'DELETE' }))
  }

  const search = async (e: React.FormEvent) => {
    e.preventDefault()
    const body = await call('search', `${url}/search?q=${encodeURIComponent(query)}`)
    if (body) setSearchResults(body.items)
  }

  if (loading) return <div className="py-6 text-sm text-gray-500">Loading…</div>
  if (!state) return <div className="py-6 text-sm text-red-600">{error || 'Failed to load'}</div>

  const facts = state.link?.company_facts ?? null
  const showPicker = !state.link || changing

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
        Link {brandName} to its <span className="font-semibold text-gray-900">UK trading company</span> —
        the entity that operates the stores and signs leases, not the parent group or a property or
        finance vehicle. Brand Matcher shows its Companies House facts once confirmed, as filed and
        never rated.
      </div>

      {!state.configured && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          COMPANIES_HOUSE_KEY is not set on this deployment, so search and confirm will fail.
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      {state.link && (
        <div className="rounded-lg border border-gray-200 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase text-gray-500">Confirmed trading company</p>
              <p className="mt-1 text-lg font-semibold text-gray-900">
                {facts?.company_name ?? state.link.company_number}
              </p>
              <a
                href={companiesHouseUrl(state.link.company_number)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-violet-700 hover:underline"
              >
                {state.link.company_number} on Companies House ↗
              </a>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => action('refresh')}
                disabled={busy != null}
                className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50"
              >
                {busy === 'refresh' ? 'Refreshing…' : 'Refresh facts'}
              </button>
              <button
                onClick={() => setChanging((v) => !v)}
                className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50"
              >
                {changing ? 'Cancel change' : 'Change company'}
              </button>
              <button
                onClick={unlink}
                disabled={busy != null}
                className="rounded-md border border-red-200 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50"
              >
                Unlink
              </button>
            </div>
          </div>
          {facts && (
            <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-sm md:grid-cols-3">
              <Fact label="Status" value={statusLabel(facts.company_status)} />
              <Fact label="Accounts type" value={accountsTypeLabel(facts.last_accounts_type)} />
              <Fact label="Accounts made up to" value={fmtDate(facts.last_accounts_made_up_to)} />
              <Fact label="Accounts" value={facts.accounts_overdue ? 'Overdue' : 'Filed on time'} />
              <Fact label="Next accounts due" value={fmtDate(facts.next_accounts_due)} />
              <Fact label="SIC codes" value={facts.sic_codes.join(', ') || '—'} />
              <Fact label="Registered office" value={facts.registered_office} wide />
              <Fact
                label="Turnover / net assets"
                value="Not read yet — accounts parsing is a later phase"
                wide
              />
              <Fact label="Fetched" value={fmtDate(facts.fetched_at)} />
              <Fact label="Confirmed" value={fmtDate(state.link.confirmed_at)} />
            </dl>
          )}
        </div>
      )}

      {showPicker && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-900">Suggestions</p>
            <button
              onClick={() => action('suggest')}
              disabled={busy != null || !state.configured}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50"
            >
              {busy === 'suggest'
                ? 'Searching…'
                : state.suggestions.length
                  ? 'Search again'
                  : 'Find suggestions'}
            </button>
          </div>
          {state.suggestions.length > 0 ? (
            <CandidateTable rows={state.suggestions} busy={busy} onConfirm={confirm} showScore />
          ) : (
            <p className="text-sm text-gray-500">No suggestions stored yet.</p>
          )}

          <form onSubmit={search} className="flex gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search Companies House"
              className="flex-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm"
            />
            <button
              type="submit"
              disabled={busy != null || query.trim().length < 2}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50"
            >
              {busy === 'search' ? 'Searching…' : 'Search'}
            </button>
          </form>
          {searchResults &&
            (searchResults.length ? (
              <CandidateTable rows={searchResults} busy={busy} onConfirm={confirm} />
            ) : (
              <p className="text-sm text-gray-500">No companies found.</p>
            ))}

          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (manualNumber.trim()) confirm(manualNumber.trim())
            }}
            className="flex items-center gap-2"
          >
            <input
              value={manualNumber}
              onChange={(e) => setManualNumber(e.target.value)}
              placeholder="Or enter a company number, e.g. 02321869"
              className="w-80 rounded-md border border-gray-300 px-3 py-1.5 text-sm"
            />
            <button
              type="submit"
              disabled={busy != null || !manualNumber.trim()}
              className="rounded-md bg-violet-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50"
            >
              Confirm number
            </button>
          </form>
        </div>
      )}
    </div>
  )
}

function Fact({ label, value, wide = false }: { label: string; value: string | null; wide?: boolean }) {
  return (
    <div className={wide ? 'col-span-2 md:col-span-3' : ''}>
      <dt className="text-xs text-gray-500">{label}</dt>
      <dd className="text-gray-900">{value || '—'}</dd>
    </div>
  )
}

function CandidateTable({
  rows,
  busy,
  onConfirm,
  showScore = false,
}: {
  rows: Candidate[]
  busy: string | null
  onConfirm: (companyNumber: string) => void
  showScore?: boolean
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-gray-200">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
          <tr>
            <th className="px-3 py-2">Company</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2">Registered address</th>
            <th className="px-3 py-2">Incorporated</th>
            {showScore && <th className="px-3 py-2 text-right">Score</th>}
            <th className="px-3 py-2" />
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((r) => (
            <tr key={r.company_number}>
              <td className="px-3 py-2">
                <div className="font-medium text-gray-900">{r.company_name}</div>
                <a
                  href={companiesHouseUrl(r.company_number)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-violet-700 hover:underline"
                >
                  {r.company_number} ↗
                </a>
                {r.company_type && <span className="ml-2 text-xs text-gray-400">{r.company_type}</span>}
              </td>
              <td className="px-3 py-2 text-gray-600">{statusLabel(r.company_status) ?? '—'}</td>
              <td className="px-3 py-2 text-gray-600">{r.address_snippet ?? '—'}</td>
              <td className="px-3 py-2 text-gray-600">{fmtDate(r.date_of_creation)}</td>
              {showScore && (
                <td className="px-3 py-2 text-right tabular-nums text-gray-500">
                  {r.score != null ? Number(r.score).toFixed(2) : ''}
                </td>
              )}
              <td className="px-3 py-2 text-right">
                <button
                  onClick={() => onConfirm(r.company_number)}
                  disabled={busy != null}
                  className="rounded-md bg-violet-600 px-3 py-1 text-xs font-medium text-white hover:bg-violet-700 disabled:opacity-50"
                >
                  {busy === `confirm:${r.company_number}` ? 'Confirming…' : 'Confirm'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

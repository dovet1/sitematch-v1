'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface Agency {
  id: string
  name: string
  website: string | null
  domain: string | null
  directory_agents?: { count: number }[]
}

interface Agent {
  id: string
  agency_id: string | null
  name: string
  title: string | null
  email: string | null
  phone: string | null
  linkedin_url: string | null
  region: string | null
  focus: string | null
  directory_agencies: { id: string; name: string } | null
  brand_agents?: { count: number }[]
}

const EMPTY_AGENT = {
  name: '',
  title: '',
  email: '',
  phone: '',
  linkedin_url: '',
  region: '',
  focus: '',
  agency_id: '',
}

export function DirectoryAgentsAdmin() {
  const [agencies, setAgencies] = useState<Agency[]>([])
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  const [agentDraft, setAgentDraft] = useState({ ...EMPTY_AGENT })
  const [editingId, setEditingId] = useState<string | null>(null)
  const [savingAgent, setSavingAgent] = useState(false)

  const [agencyDraft, setAgencyDraft] = useState({ name: '', website: '', domain: '' })
  const [savingAgency, setSavingAgency] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [ag, ags] = await Promise.all([
        fetch(`/api/admin/directory-agents${query.trim() ? `?q=${encodeURIComponent(query.trim())}` : ''}`),
        fetch('/api/admin/directory-agencies'),
      ])
      const agD = await ag.json()
      const agsD = await ags.json()
      if (!ag.ok) throw new Error(agD.error || 'Failed to load agents')
      if (!ags.ok) throw new Error(agsD.error || 'Failed to load agencies')
      setAgents(agD.agents || [])
      setAgencies(agsD.agencies || [])
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [query])

  useEffect(() => {
    const t = setTimeout(load, query ? 300 : 0)
    return () => clearTimeout(t)
  }, [load, query])

  const saveAgent = async () => {
    setSavingAgent(true)
    setError(null)
    try {
      const payload = {
        ...agentDraft,
        agency_id: agentDraft.agency_id || null,
        ...(editingId ? { id: editingId } : {}),
      }
      const res = await fetch('/api/admin/directory-agents', {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(d.error || 'Save failed')
      setAgentDraft({ ...EMPTY_AGENT })
      setEditingId(null)
      load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSavingAgent(false)
    }
  }

  const removeAgent = async (id: string, brandCount: number) => {
    const msg =
      brandCount > 0
        ? `This agent is attached to ${brandCount} brand${brandCount === 1 ? '' : 's'}. Deleting removes it from ${brandCount === 1 ? 'that brand' : 'those brands'} too. Continue?`
        : 'Delete this agent?'
    if (!window.confirm(msg)) return
    const res = await fetch(`/api/admin/directory-agents?id=${id}`, { method: 'DELETE' })
    if (res.ok) load()
  }

  const saveAgency = async () => {
    setSavingAgency(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/directory-agencies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(agencyDraft),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(d.error || 'Save failed')
      setAgencyDraft({ name: '', website: '', domain: '' })
      load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSavingAgency(false)
    }
  }

  const startEdit = (a: Agent) => {
    setEditingId(a.id)
    setAgentDraft({
      name: a.name,
      title: a.title ?? '',
      email: a.email ?? '',
      phone: a.phone ?? '',
      linkedin_url: a.linkedin_url ?? '',
      region: a.region ?? '',
      focus: a.focus ?? '',
      agency_id: a.agency_id ?? '',
    })
  }

  return (
    <div className="space-y-8">
      {error && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      {/* ---- Agencies ---- */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Agency firms</h2>
        <div className="grid grid-cols-[1fr_1fr_1fr_auto] items-end gap-3 rounded-md border border-gray-200 p-4">
          <div>
            <Label>Name</Label>
            <Input
              value={agencyDraft.name}
              onChange={(e) => setAgencyDraft({ ...agencyDraft, name: e.target.value })}
              placeholder="Savills"
            />
          </div>
          <div>
            <Label>Website</Label>
            <Input
              value={agencyDraft.website}
              onChange={(e) => setAgencyDraft({ ...agencyDraft, website: e.target.value })}
              placeholder="https://savills.com"
            />
          </div>
          <div>
            <Label>Logo domain</Label>
            <Input
              value={agencyDraft.domain}
              onChange={(e) => setAgencyDraft({ ...agencyDraft, domain: e.target.value })}
              placeholder="savills.com"
            />
          </div>
          <Button
            type="button"
            disabled={savingAgency || !agencyDraft.name.trim()}
            onClick={saveAgency}
          >
            {savingAgency ? 'Adding…' : 'Add agency'}
          </Button>
        </div>

        {agencies.length > 0 && (
          <ul className="flex flex-wrap gap-2">
            {agencies.map((a) => (
              <li
                key={a.id}
                className="rounded-full border border-gray-300 bg-white px-3 py-1 text-sm text-gray-700"
              >
                {a.name}
                <span className="ml-1.5 text-xs text-gray-400">
                  {a.directory_agents?.[0]?.count ?? 0}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ---- Agents ---- */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{editingId ? 'Edit agent' : 'Add agent'}</h2>
        <div className="space-y-3 rounded-md border border-gray-200 p-4">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Name</Label>
              <Input
                value={agentDraft.name}
                onChange={(e) => setAgentDraft({ ...agentDraft, name: e.target.value })}
              />
            </div>
            <div>
              <Label>Title</Label>
              <Input
                value={agentDraft.title}
                onChange={(e) => setAgentDraft({ ...agentDraft, title: e.target.value })}
                placeholder="Director, Retail Agency"
              />
            </div>
            <div>
              <Label>Agency</Label>
              <select
                className="w-full rounded-md border border-gray-300 px-2 py-2 text-sm"
                value={agentDraft.agency_id}
                onChange={(e) => setAgentDraft({ ...agentDraft, agency_id: e.target.value })}
              >
                <option value="">— independent —</option>
                {agencies.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-3">
            <div>
              <Label>Email</Label>
              <Input
                value={agentDraft.email}
                onChange={(e) => setAgentDraft({ ...agentDraft, email: e.target.value })}
              />
            </div>
            <div>
              <Label>Phone</Label>
              <Input
                value={agentDraft.phone}
                onChange={(e) => setAgentDraft({ ...agentDraft, phone: e.target.value })}
              />
            </div>
            <div>
              <Label>Region</Label>
              <Input
                value={agentDraft.region}
                onChange={(e) => setAgentDraft({ ...agentDraft, region: e.target.value })}
                placeholder="National"
              />
            </div>
            <div>
              <Label>Focus</Label>
              <Input
                value={agentDraft.focus}
                onChange={(e) => setAgentDraft({ ...agentDraft, focus: e.target.value })}
                placeholder="Leisure & F&B"
              />
            </div>
          </div>
          <div>
            <Label>LinkedIn</Label>
            <Input
              value={agentDraft.linkedin_url}
              onChange={(e) => setAgentDraft({ ...agentDraft, linkedin_url: e.target.value })}
              placeholder="https://linkedin.com/in/…"
            />
          </div>
          <div className="flex gap-2">
            <Button type="button" disabled={savingAgent || !agentDraft.name.trim()} onClick={saveAgent}>
              {savingAgent ? 'Saving…' : editingId ? 'Save changes' : 'Add agent'}
            </Button>
            {editingId && (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setEditingId(null)
                  setAgentDraft({ ...EMPTY_AGENT })
                }}
              >
                Cancel
              </Button>
            )}
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">All agents</h2>
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or email…"
            className="w-64"
          />
        </div>

        {loading ? (
          <p className="text-sm text-gray-500">Loading…</p>
        ) : agents.length === 0 ? (
          <p className="text-sm text-gray-500">
            {query ? 'No agents match that search.' : 'No directory agents yet.'}
          </p>
        ) : (
          <ul className="divide-y divide-gray-100 rounded-md border border-gray-200">
            {agents.map((a) => {
              const brandCount = a.brand_agents?.[0]?.count ?? 0
              return (
                <li key={a.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                  <span className="min-w-0 text-sm">
                    <strong>{a.name}</strong>
                    {a.directory_agencies?.name ? ` · ${a.directory_agencies.name}` : ''}
                    {a.title ? <span className="ml-2 text-xs text-gray-500">{a.title}</span> : null}
                    <span className="ml-2 text-xs text-gray-400">
                      {brandCount} brand{brandCount === 1 ? '' : 's'}
                    </span>
                  </span>
                  <span className="flex shrink-0 gap-2">
                    <Button type="button" size="sm" variant="outline" onClick={() => startEdit(a)}>
                      Edit
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => removeAgent(a.id, brandCount)}
                    >
                      Delete
                    </Button>
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}

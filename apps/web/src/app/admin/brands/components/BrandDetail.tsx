'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ImageUpload } from '@/components/ui/image-upload'
import { normalizeDomain, validateDomain } from '@/lib/clearbit-logo'
import { FloorAreasSection } from './FloorAreasSection'

type Tab = 'details' | 'stores' | 'floor-areas' | 'requirements' | 'contacts' | 'agents' | 'activity'

interface BrandData {
  id: string
  name: string
  logo_url: string | null
  domain: string | null
  website_url: string | null
  store_locator_url: string | null
  latest_store_name: string | null
  latest_store_town: string | null
  latest_store_opened_at: string | null
  category: string | null
  storeCount: number
  requirementCount: number
  contactCount: number
}

const TABS: { key: Tab; label: string }[] = [
  { key: 'details', label: 'Details' },
  { key: 'stores', label: 'Stores' },
  { key: 'floor-areas', label: 'Floor areas' },
  { key: 'requirements', label: 'Requirements' },
  { key: 'contacts', label: 'Contacts' },
  // Directory-only sections.
  { key: 'agents', label: 'Agents' },
  { key: 'activity', label: 'Activity' },
]

async function uploadLogo(file: File): Promise<string> {
  const fd = new FormData()
  fd.append('file', file)
  fd.append('type', 'logo')
  const res = await fetch('/api/upload', { method: 'POST', body: fd })
  const d = await res.json().catch(() => ({}))
  if (!res.ok || !d.file?.url) throw new Error(d.error || `Upload failed (${res.status})`)
  return d.file.url as string
}

export function BrandDetail({ brandId }: { brandId: string }) {
  const [tab, setTab] = useState<Tab>('details')
  const [brand, setBrand] = useState<BrandData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/brands/${brandId}`)
      if (!res.ok) throw new Error(`Failed (${res.status})`)
      const data = await res.json()
      setBrand(data.brand)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [brandId])

  useEffect(() => {
    load()
  }, [load])

  if (loading) return <div className="py-8 text-sm text-gray-500">Loading…</div>
  if (error || !brand) return <div className="py-8 text-sm text-red-600">{error || 'Not found'}</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        {brand.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={brand.logo_url} alt="" className="h-14 w-14 rounded-lg object-contain" />
        ) : (
          <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-gray-100 text-lg font-semibold text-gray-500">
            {brand.name.charAt(0).toUpperCase()}
          </div>
        )}
        <div>
          <h2 className="text-xl font-semibold text-gray-900">{brand.name}</h2>
          <p className="text-sm text-gray-500">
            {brand.category || 'No category'} · {brand.storeCount} store
            {brand.storeCount !== 1 ? 's' : ''} · {brand.requirementCount} requirement
            {brand.requirementCount !== 1 ? 's' : ''} · {brand.contactCount} contact
            {brand.contactCount !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      <div className="flex gap-2 border-b border-gray-200">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${
              tab === t.key
                ? 'border-violet-500 text-violet-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'details' && <DetailsSection brand={brand} onSaved={load} />}
      {tab === 'stores' && <StoresSection brandId={brandId} />}
      {tab === 'floor-areas' && <FloorAreasSection brandId={brandId} />}
      {tab === 'requirements' && <RequirementsSection brandId={brandId} brandName={brand.name} />}
      {tab === 'contacts' && <ContactsSection brandId={brandId} onSaved={load} />}
      {tab === 'agents' && <AgentsSection brandId={brandId} />}
      {tab === 'activity' && <ActivitySection brandId={brandId} />}
    </div>
  )
}

function DetailsSection({ brand, onSaved }: { brand: BrandData; onSaved: () => void }) {
  const [name, setName] = useState(brand.name)
  const [logoUrl, setLogoUrl] = useState(brand.logo_url ?? '')
  const [domain, setDomain] = useState(brand.domain ?? '')
  const [websiteUrl, setWebsiteUrl] = useState(brand.website_url ?? '')
  const [storeLocatorUrl, setStoreLocatorUrl] = useState(brand.store_locator_url ?? '')
  const [storeName, setStoreName] = useState(brand.latest_store_name ?? '')
  const [storeTown, setStoreTown] = useState(brand.latest_store_town ?? '')
  const [openedAt, setOpenedAt] = useState(
    brand.latest_store_opened_at ? brand.latest_store_opened_at.slice(0, 10) : ''
  )
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleLogo(file: File | null) {
    if (!file) {
      setLogoUrl('')
      return
    }
    setUploading(true)
    setError(null)
    try {
      setLogoUrl(await uploadLogo(file))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  async function save() {
    const normalizedDomain = domain.trim() ? normalizeDomain(domain) : ''
    if (normalizedDomain && !validateDomain(normalizedDomain)) {
      setError('Enter a valid website domain (e.g. boots.com)')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/brands/${brand.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          logo_url: logoUrl || null,
          domain: normalizedDomain || null,
          website_url: websiteUrl.trim() || null,
          store_locator_url: storeLocatorUrl.trim() || null,
          latest_store_name: storeName || null,
          latest_store_town: storeTown || null,
          latest_store_opened_at: openedAt || null,
        }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.error || `Save failed (${res.status})`)
      }
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      {error && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <div>
        <Label>Brand name</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} />
      </div>

      <div>
        <Label>Website domain</Label>
        <Input
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          placeholder="e.g. boots.com"
        />
        <p className="mt-1 text-xs text-gray-500">
          Primary logo source — drives the logo.dev logo on the assess-area map. The uploaded
          logo below is used as a fallback.
        </p>
      </div>

      {/* Full URLs, distinct from the bare `domain` above which is logo.dev only. */}
      <div>
        <Label>Website URL</Label>
        <Input
          value={websiteUrl}
          onChange={(e) => setWebsiteUrl(e.target.value)}
          placeholder="https://boots.com"
        />
        <p className="mt-1 text-xs text-gray-500">
          Globe link on the directory brand profile. Left blank, the link is hidden.
        </p>
      </div>

      <div>
        <Label>Store locator URL</Label>
        <Input
          value={storeLocatorUrl}
          onChange={(e) => setStoreLocatorUrl(e.target.value)}
          placeholder="https://boots.com/store-locator"
        />
        <p className="mt-1 text-xs text-gray-500">
          The brand&apos;s own store finder — shown beside the estate map as provenance for the
          store count.
        </p>
      </div>

      <div className="space-y-2">
        <Label>Logo (fallback)</Label>
        <ImageUpload
          value={logoUrl || undefined}
          onChange={handleLogo}
          placeholder="Upload brand logo"
          maxSize={2 * 1024 * 1024}
          acceptedTypes={['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml']}
        />
        {uploading && <p className="text-xs text-gray-500">Uploading…</p>}
      </div>

      <div className="space-y-3 rounded-md border border-gray-200 p-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Latest store overrides</h3>
          <p className="text-xs text-gray-500">
            Leave blank to derive the latest store from the estate automatically.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Store name</Label>
            <Input value={storeName} onChange={(e) => setStoreName(e.target.value)} />
          </div>
          <div>
            <Label>Town</Label>
            <Input value={storeTown} onChange={(e) => setStoreTown(e.target.value)} />
          </div>
        </div>
        <div className="max-w-xs">
          <Label>Opened at</Label>
          <Input type="date" value={openedAt} onChange={(e) => setOpenedAt(e.target.value)} />
        </div>
      </div>

      <Button onClick={save} disabled={saving || uploading}>
        {saving ? 'Saving…' : 'Save changes'}
      </Button>
    </div>
  )
}

interface StoreRow {
  id: string
  name: string | null
  town: string | null
  open_date: string | null
  lat: number | null
  lon: number | null
}

function StoresSection({ brandId }: { brandId: string }) {
  const [stores, setStores] = useState<StoreRow[]>([])
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/brands/${brandId}/stores`)
      if (!res.ok) throw new Error(`Failed (${res.status})`)
      const data = await res.json()
      setStores(data.stores || [])
      setCount(data.storeCount ?? 0)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [brandId])

  useEffect(() => {
    load()
  }, [load])

  async function saveStore(store: StoreRow) {
    const res = await fetch(`/api/admin/stores/${store.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: store.name,
        town: store.town,
        open_date: store.open_date,
        lat: store.lat,
        lon: store.lon,
      }),
    })
    if (res.ok) {
      setEditing(null)
      load()
    } else {
      alert('Failed to save store')
    }
  }

  async function deleteStore(id: string) {
    if (!confirm('Delete this store? This triggers a catchment cache rebuild.')) return
    const res = await fetch(`/api/admin/stores/${id}`, { method: 'DELETE' })
    if (res.ok) load()
    else alert('Failed to delete store')
  }

  function patch(id: string, field: keyof StoreRow, value: string) {
    setStores((prev) =>
      prev.map((s) =>
        s.id === id
          ? {
              ...s,
              [field]: field === 'lat' || field === 'lon' ? (value === '' ? null : Number(value)) : value || null,
            }
          : s
      )
    )
  }

  if (loading) return <div className="py-6 text-sm text-gray-500">Loading…</div>
  if (error) return <div className="py-6 text-sm text-red-600">{error}</div>

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-500">
        {count} store{count !== 1 ? 's' : ''}
        {stores.length < count && ` (showing first ${stores.length})`}
      </p>
      {stores.length === 0 ? (
        <div className="py-6 text-sm text-gray-500">No stores linked to this brand.</div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
              <tr>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Town</th>
                <th className="px-3 py-2">Open date</th>
                <th className="px-3 py-2">Lat</th>
                <th className="px-3 py-2">Lon</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {stores.map((s) => {
                const isEditing = editing === s.id
                return (
                  <tr key={s.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2">
                      {isEditing ? (
                        <Input value={s.name ?? ''} onChange={(e) => patch(s.id, 'name', e.target.value)} />
                      ) : (
                        s.name || '—'
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {isEditing ? (
                        <Input value={s.town ?? ''} onChange={(e) => patch(s.id, 'town', e.target.value)} />
                      ) : (
                        s.town || '—'
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {isEditing ? (
                        <Input
                          type="date"
                          value={s.open_date ? s.open_date.slice(0, 10) : ''}
                          onChange={(e) => patch(s.id, 'open_date', e.target.value)}
                        />
                      ) : s.open_date ? (
                        new Date(s.open_date).toLocaleDateString('en-GB')
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {isEditing ? (
                        <Input value={s.lat ?? ''} onChange={(e) => patch(s.id, 'lat', e.target.value)} />
                      ) : (
                        s.lat ?? '—'
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {isEditing ? (
                        <Input value={s.lon ?? ''} onChange={(e) => patch(s.id, 'lon', e.target.value)} />
                      ) : (
                        s.lon ?? '—'
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex justify-end gap-2">
                        {isEditing ? (
                          <>
                            <Button size="sm" onClick={() => saveStore(s)}>
                              Save
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => { setEditing(null); load() }}>
                              Cancel
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button size="sm" variant="outline" onClick={() => setEditing(s.id)}>
                              Edit
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => deleteStore(s.id)}>
                              Delete
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

interface ReqRow {
  id: string
  company_name: string
  listing_type: string | null
  status: string
  updated_at: string
}

function RequirementsSection({ brandId, brandName }: { brandId: string; brandName: string }) {
  const [rows, setRows] = useState<ReqRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError(null)
    fetch(`/api/admin/requirements?brandId=${brandId}`, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`Failed (${res.status})`)
        return res.json()
      })
      .then((data) => setRows(data.requirements || []))
      .catch((err) => {
        if (err?.name !== 'AbortError') setError(err instanceof Error ? err.message : 'Failed to load')
      })
      .finally(() => setLoading(false))
    return () => controller.abort()
  }, [brandId])

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button size="sm" asChild>
          <Link
            href={`/admin/requirements/new?brand=${brandId}&brandName=${encodeURIComponent(brandName)}`}
          >
            + New requirement for {brandName}
          </Link>
        </Button>
      </div>
      {error && <div className="text-sm text-red-600">{error}</div>}
      {loading ? (
        <div className="py-6 text-sm text-gray-500">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="py-6 text-sm text-gray-500">No requirements linked to this brand.</div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-2.5">Company</th>
                <th className="px-4 py-2.5">Type</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5">Updated</th>
                <th className="px-4 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5 font-medium text-gray-900">{r.company_name}</td>
                  <td className="px-4 py-2.5 text-gray-600">{r.listing_type ?? '—'}</td>
                  <td className="px-4 py-2.5 text-gray-600">{r.status}</td>
                  <td className="px-4 py-2.5 text-gray-500">
                    {new Date(r.updated_at).toLocaleDateString('en-GB')}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <Button size="sm" variant="outline" asChild>
                      <Link href={`/admin/requirements/${r.id}`}>Edit</Link>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

interface ContactDraft {
  // Present for saved rows, absent for unsaved ones. Needed to promote an agency contact
  // into a directory agent — save_brand_contacts regenerates ids on every write, so a
  // contact must be saved before it can be promoted.
  id?: string
  contact_name: string
  contact_title: string
  contact_org: string
  contact_kind: string
  contact_email: string
  contact_phone: string
  linkedin_url: string
  is_primary_contact: boolean
}

function ContactsSection({ brandId, onSaved }: { brandId: string; onSaved: () => void }) {
  const [contacts, setContacts] = useState<ContactDraft[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [promoteNotice, setPromoteNotice] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError(null)
    fetch(`/api/admin/brands/${brandId}/contacts`, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`Failed (${res.status})`)
        return res.json()
      })
      .then((data) =>
        setContacts(
          (data.contacts || []).map((c: any) => ({
            id: c.id,
            contact_name: c.contact_name ?? '',
            contact_title: c.contact_title ?? '',
            contact_org: c.contact_org ?? '',
            contact_kind: c.contact_kind ?? '',
            contact_email: c.contact_email ?? '',
            contact_phone: c.contact_phone ?? '',
            linkedin_url: c.linkedin_url ?? '',
            is_primary_contact: Boolean(c.is_primary_contact),
          }))
        )
      )
      .catch((err) => {
        if (err?.name !== 'AbortError') setError(err instanceof Error ? err.message : 'Failed to load')
      })
      .finally(() => setLoading(false))
    return () => controller.abort()
  }, [brandId])

  function update(i: number, patch: Partial<ContactDraft>) {
    setContacts((prev) => prev.map((c, j) => (j === i ? { ...c, ...patch } : c)))
  }

  function setPrimary(i: number, checked: boolean) {
    setContacts((prev) =>
      prev.map((c, j) => ({
        ...c,
        is_primary_contact: j === i ? checked : checked ? false : c.is_primary_contact,
      }))
    )
  }

  async function save() {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/brands/${brandId}/contacts`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contacts: contacts.map((c) => ({
            contact_name: c.contact_name || null,
            contact_title: c.contact_title || null,
            contact_org: c.contact_org || null,
            contact_kind: c.contact_kind || null,
            contact_email: c.contact_email || null,
            contact_phone: c.contact_phone || null,
            linkedin_url: c.linkedin_url || null,
            is_primary_contact: c.is_primary_contact,
          })),
        }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.error || `Save failed (${res.status})`)
      }
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="py-6 text-sm text-gray-500">Loading…</div>

  return (
    <div className="space-y-3">
      {error && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          Contacts shown on the brand info modal and merged into requirement cards.
        </p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() =>
            setContacts((prev) => [
              ...prev,
              {
                contact_name: '',
                contact_title: '',
                contact_org: '',
                contact_kind: '',
                contact_email: '',
                contact_phone: '',
                linkedin_url: '',
                is_primary_contact: prev.length === 0,
              },
            ])
          }
        >
          + Add contact
        </Button>
      </div>

      {contacts.map((c, i) => (
        <div
          key={i}
          className="grid grid-cols-[1fr_1fr_1fr_130px_1fr_1fr_1fr_auto_auto] items-end gap-2 rounded-md border border-gray-200 p-3"
        >
          <div>
            <Label>Name</Label>
            <Input value={c.contact_name} onChange={(e) => update(i, { contact_name: e.target.value })} />
          </div>
          <div>
            <Label>Title</Label>
            <Input value={c.contact_title} onChange={(e) => update(i, { contact_title: e.target.value })} />
          </div>
          <div>
            <Label>Org</Label>
            <Input value={c.contact_org} onChange={(e) => update(i, { contact_org: e.target.value })} />
          </div>
          <div>
            <Label>Kind</Label>
            <select
              className="w-full rounded-md border border-gray-300 px-2 py-2 text-sm"
              value={c.contact_kind}
              onChange={(e) => update(i, { contact_kind: e.target.value })}
            >
              <option value="">—</option>
              <option value="in-house">in-house</option>
              <option value="agency">agency</option>
            </select>
          </div>
          <div>
            <Label>LinkedIn</Label>
            <Input
              value={c.linkedin_url}
              onChange={(e) => update(i, { linkedin_url: e.target.value })}
              placeholder="https://linkedin.com/in/…"
            />
          </div>
          <div>
            <Label>Email</Label>
            <Input value={c.contact_email} onChange={(e) => update(i, { contact_email: e.target.value })} />
          </div>
          <div>
            <Label>Phone</Label>
            <Input value={c.contact_phone} onChange={(e) => update(i, { contact_phone: e.target.value })} />
          </div>
          <label className="flex items-center gap-1 pb-2 text-xs">
            <input
              type="checkbox"
              checked={c.is_primary_contact}
              onChange={(e) => setPrimary(i, e.target.checked)}
            />
            Primary
          </label>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setContacts((prev) => prev.filter((_, j) => j !== i))}
          >
            Remove
          </Button>

          {/*
            An agency-kind contact is free text and cannot be navigated to. Promoting it
            creates a real directory_agents row plus a brand_agents edge, which is what the
            directory's Agents tab and agent profiles read. Only offered once the row is
            saved: save_brand_contacts regenerates ids on every write, so an unsaved row has
            no stable id to promote.
          */}
          {c.contact_kind === 'agency' && (
            <div className="col-span-full mt-1 border-t border-gray-100 pt-2">
              {c.id ? (
                <PromoteContactControl
                  brandId={brandId}
                  contact={c}
                  onPromoted={() => {
                    setPromoteNotice(
                      `${c.contact_name || 'Contact'} is now a directory agent. It stays listed here too — remove it above if you don't want it duplicated on the brand info modal.`
                    )
                  }}
                />
              ) : (
                <p className="text-xs text-gray-500">
                  Save contacts before promoting this agency contact to a directory agent.
                </p>
              )}
            </div>
          )}
        </div>
      ))}

      {promoteNotice && (
        <div className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">{promoteNotice}</div>
      )}

      <Button onClick={save} disabled={saving}>
        {saving ? 'Saving…' : 'Save contacts'}
      </Button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Directory: agents attached to this brand (the brand_agents edge)
// ---------------------------------------------------------------------------

interface BrandAgentRow {
  id: string
  role_note: string | null
  display_order: number
  directory_agents: {
    id: string
    name: string
    title: string | null
    email: string | null
    directory_agencies: { id: string; name: string } | null
  } | null
}

interface AgentOption {
  id: string
  name: string
  title: string | null
  email: string | null
  directory_agencies: { id: string; name: string } | null
}

function AgentsSection({ brandId }: { brandId: string }) {
  const [rows, setRows] = useState<BrandAgentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [options, setOptions] = useState<AgentOption[]>([])
  const [searching, setSearching] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/brands/${brandId}/agents`)
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || 'Failed to load agents')
      setRows(d.agents || [])
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load agents')
    } finally {
      setLoading(false)
    }
  }, [brandId])

  useEffect(() => {
    load()
  }, [load])

  // Debounced agent search for the attach control.
  useEffect(() => {
    if (!query.trim()) {
      setOptions([])
      return
    }
    const t = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await fetch(`/api/admin/directory-agents?q=${encodeURIComponent(query.trim())}`)
        const d = await res.json()
        if (res.ok) setOptions(d.agents || [])
      } finally {
        setSearching(false)
      }
    }, 300)
    return () => clearTimeout(t)
  }, [query])

  const attach = async (agentId: string) => {
    setError(null)
    const res = await fetch(`/api/admin/brands/${brandId}/agents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agent_id: agentId, display_order: rows.length }),
    })
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      setError(d.error || 'Failed to attach agent')
      return
    }
    setQuery('')
    setOptions([])
    load()
  }

  const detach = async (agentId: string) => {
    const res = await fetch(`/api/admin/brands/${brandId}/agents?agent_id=${agentId}`, {
      method: 'DELETE',
    })
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      setError(d.error || 'Failed to detach agent')
      return
    }
    load()
  }

  if (loading) return <p className="text-sm text-gray-500">Loading agents…</p>

  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="rounded-md border border-gray-200 p-4">
        <Label>Attach an existing directory agent</Label>
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search agents by name or email…"
        />
        <p className="mt-1 text-xs text-gray-500">
          Agents are shared across brands — create them under{' '}
          <a href="/admin/directory-agents" className="text-violet-700 underline">
            Directory agents
          </a>
          , then attach here.
        </p>
        {searching && <p className="mt-2 text-xs text-gray-500">Searching…</p>}
        {options.length > 0 && (
          <ul className="mt-2 divide-y divide-gray-100 rounded-md border border-gray-200">
            {options.map((o) => (
              <li key={o.id} className="flex items-center justify-between px-3 py-2">
                <span className="text-sm">
                  <strong>{o.name}</strong>
                  {o.directory_agencies?.name ? ` · ${o.directory_agencies.name}` : ''}
                  {o.email ? <span className="ml-2 text-xs text-gray-500">{o.email}</span> : null}
                </span>
                <Button type="button" size="sm" variant="outline" onClick={() => attach(o.id)}>
                  Attach
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-gray-500">No agents attached to this brand yet.</p>
      ) : (
        <ul className="divide-y divide-gray-100 rounded-md border border-gray-200">
          {rows.map((r) => (
            <li key={r.id} className="flex items-center justify-between px-3 py-2.5">
              <span className="text-sm">
                <strong>{r.directory_agents?.name}</strong>
                {r.directory_agents?.directory_agencies?.name
                  ? ` · ${r.directory_agents.directory_agencies.name}`
                  : ''}
                {r.directory_agents?.title ? (
                  <span className="ml-2 text-xs text-gray-500">{r.directory_agents.title}</span>
                ) : null}
              </span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => r.directory_agents && detach(r.directory_agents.id)}
              >
                Detach
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Directory: curated openings / closures for the brand profile activity band
// ---------------------------------------------------------------------------

interface ActivityRow {
  id: string
  kind: 'opening' | 'closure'
  event_date: string
  is_upcoming: boolean
  headline: string
  url: string | null
}

function ActivitySection({ brandId }: { brandId: string }) {
  const [rows, setRows] = useState<ActivityRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [draft, setDraft] = useState({
    kind: 'opening' as 'opening' | 'closure',
    event_date: '',
    headline: '',
    url: '',
    is_upcoming: false,
  })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/brands/${brandId}/activity`)
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || 'Failed to load activity')
      setRows(d.activity || [])
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load activity')
    } finally {
      setLoading(false)
    }
  }, [brandId])

  useEffect(() => {
    load()
  }, [load])

  const add = async () => {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/brands/${brandId}/activity`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(d.error || 'Failed to add event')
      setDraft({ kind: 'opening', event_date: '', headline: '', url: '', is_upcoming: false })
      load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add event')
    } finally {
      setSaving(false)
    }
  }

  const remove = async (eventId: string) => {
    const res = await fetch(`/api/admin/brands/${brandId}/activity?event_id=${eventId}`, {
      method: 'DELETE',
    })
    if (res.ok) load()
  }

  if (loading) return <p className="text-sm text-gray-500">Loading activity…</p>

  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="space-y-3 rounded-md border border-gray-200 p-4">
        <p className="text-xs text-gray-500">
          Curated because there is no source for it: <code>stores.open_date</code> gives past
          openings only — closures, upcoming signings and news links all have to be entered here.
        </p>
        <div className="grid grid-cols-[130px_150px_1fr] gap-3">
          <div>
            <Label>Kind</Label>
            <select
              className="w-full rounded-md border border-gray-300 px-2 py-2 text-sm"
              value={draft.kind}
              onChange={(e) =>
                setDraft({ ...draft, kind: e.target.value as 'opening' | 'closure' })
              }
            >
              <option value="opening">Opening</option>
              <option value="closure">Closure</option>
            </select>
          </div>
          <div>
            <Label>Date</Label>
            <Input
              type="date"
              value={draft.event_date}
              onChange={(e) => setDraft({ ...draft, event_date: e.target.value })}
            />
          </div>
          <div>
            <Label>Headline</Label>
            <Input
              value={draft.headline}
              onChange={(e) => setDraft({ ...draft, headline: e.target.value })}
              placeholder="Signs for 4,200 sq ft unit at Manchester Arndale"
            />
          </div>
        </div>
        <div className="grid grid-cols-[1fr_auto_auto] items-end gap-3">
          <div>
            <Label>Source URL (optional)</Label>
            <Input
              value={draft.url}
              onChange={(e) => setDraft({ ...draft, url: e.target.value })}
              placeholder="https://…"
            />
          </div>
          <label className="flex items-center gap-1.5 pb-2 text-xs">
            <input
              type="checkbox"
              checked={draft.is_upcoming}
              onChange={(e) => setDraft({ ...draft, is_upcoming: e.target.checked })}
            />
            Upcoming
          </label>
          <Button
            type="button"
            size="sm"
            disabled={saving || !draft.headline.trim() || !draft.event_date}
            onClick={add}
          >
            {saving ? 'Adding…' : 'Add event'}
          </Button>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-gray-500">
          No activity recorded — the band is hidden on the brand profile until there is at
          least one event.
        </p>
      ) : (
        <ul className="divide-y divide-gray-100 rounded-md border border-gray-200">
          {rows.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
              <span className="min-w-0 text-sm">
                <span
                  className={
                    'mr-2 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ' +
                    (r.kind === 'opening'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-red-100 text-red-700')
                  }
                >
                  {r.kind}
                </span>
                <span className="mr-2 font-mono text-xs text-gray-600">{r.event_date}</span>
                {r.headline}
                {r.is_upcoming && (
                  <span className="ml-2 text-[10px] uppercase text-gray-400">upcoming</span>
                )}
              </span>
              <Button type="button" size="sm" variant="outline" onClick={() => remove(r.id)}>
                Delete
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Directory: promote a legacy agency-kind brand_contact into a directory agent
//
// Never a one-click guess. contact_org is free text and cannot be reliably resolved to an
// agency, and two people with the same name at the same firm are not the same person — so
// the admin confirms both the agency and the agent before anything is written.
// ---------------------------------------------------------------------------

interface AgencyOption {
  id: string
  name: string
}

function PromoteContactControl({
  brandId,
  contact,
  onPromoted,
}: {
  brandId: string
  contact: ContactDraft
  onPromoted: () => void
}) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  // Agency: pick an existing one or create from contact_org.
  const [agencyQuery, setAgencyQuery] = useState(contact.contact_org || '')
  const [agencies, setAgencies] = useState<AgencyOption[]>([])
  const [agencyId, setAgencyId] = useState<string | null>(null)

  // Agent: an existing match, or a new row built from the contact.
  const [agentMatches, setAgentMatches] = useState<AgentOption[]>([])
  const [agentId, setAgentId] = useState<string | null>(null)
  const [removeContact, setRemoveContact] = useState(false)

  // Look for existing agencies matching the typed name.
  useEffect(() => {
    if (!open || !agencyQuery.trim()) {
      setAgencies([])
      return
    }
    const t = setTimeout(async () => {
      const res = await fetch(
        `/api/admin/directory-agencies?q=${encodeURIComponent(agencyQuery.trim())}`
      )
      if (res.ok) {
        const d = await res.json()
        setAgencies(d.agencies || [])
      }
    }, 300)
    return () => clearTimeout(t)
  }, [open, agencyQuery])

  // Look for an existing agent by email first, then name. An email hit is preselected but
  // still shown for confirmation; multiple name hits are never auto-merged.
  useEffect(() => {
    if (!open) return
    const term = contact.contact_email || contact.contact_name
    if (!term) return
    ;(async () => {
      const res = await fetch(`/api/admin/directory-agents?q=${encodeURIComponent(term)}`)
      if (!res.ok) return
      const d = await res.json()
      const matches: AgentOption[] = d.agents || []
      setAgentMatches(matches)
      const emailHit =
        contact.contact_email &&
        matches.filter(
          (m) => m.email && m.email.toLowerCase() === contact.contact_email.toLowerCase()
        )
      if (emailHit && emailHit.length === 1) setAgentId(emailHit[0].id)
    })()
  }, [open, contact.contact_email, contact.contact_name])

  const submit = async () => {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/brands/${brandId}/promote-contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contact_id: contact.id,
          agent_id: agentId,
          agency_id: agentId ? null : agencyId,
          agency_name: agentId || agencyId ? null : agencyQuery.trim() || null,
          agent_name: contact.contact_name || null,
          agent_title: contact.contact_title || null,
          agent_email: contact.contact_email || null,
          agent_phone: contact.contact_phone || null,
          agent_linkedin_url: contact.linkedin_url || null,
          remove_contact: removeContact,
        }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(d.error || `Promote failed (${res.status})`)
      setDone(true)
      setOpen(false)
      onPromoted()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Promote failed')
    } finally {
      setBusy(false)
    }
  }

  if (done) {
    return <p className="text-xs text-green-700">Promoted to directory agent.</p>
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs font-medium text-violet-700 underline"
      >
        Promote to directory agent
      </button>
    )
  }

  const canSubmit = Boolean(agentId || agencyId || agencyQuery.trim())

  return (
    <div className="space-y-3 rounded-md bg-gray-50 p-3">
      <p className="text-xs text-gray-600">
        Creates a directory agent and links it to this brand, so it appears in the Agents tab
        and its profile lists every brand it acts for.
      </p>

      {agentMatches.length > 0 && (
        <div>
          <Label>Existing agent</Label>
          <select
            className="w-full rounded-md border border-gray-300 px-2 py-2 text-sm"
            value={agentId ?? ''}
            onChange={(e) => setAgentId(e.target.value || null)}
          >
            <option value="">Create a new agent from this contact</option>
            {agentMatches.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
                {m.directory_agencies?.name ? ` · ${m.directory_agencies.name}` : ''}
                {m.email ? ` · ${m.email}` : ''}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-gray-500">
            {agentMatches.length} possible match{agentMatches.length === 1 ? '' : 'es'} found —
            confirm before linking, or leave as &ldquo;create new&rdquo;.
          </p>
        </div>
      )}

      {!agentId && (
        <div>
          <Label>Agency</Label>
          <Input
            value={agencyQuery}
            onChange={(e) => {
              setAgencyQuery(e.target.value)
              setAgencyId(null)
            }}
            placeholder="Savills"
          />
          {agencies.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1.5">
              {agencies.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => {
                    setAgencyId(a.id)
                    setAgencyQuery(a.name)
                  }}
                  className={
                    'rounded-full border px-2 py-0.5 text-xs ' +
                    (agencyId === a.id
                      ? 'border-violet-500 bg-violet-100 text-violet-800'
                      : 'border-gray-300 bg-white text-gray-700')
                  }
                >
                  {a.name}
                </button>
              ))}
            </div>
          )}
          <p className="mt-1 text-xs text-gray-500">
            {agencyId
              ? 'Linking to the selected existing agency.'
              : 'No match selected — a new agency will be created with this name.'}
          </p>
        </div>
      )}

      <label className="flex items-center gap-1.5 text-xs text-gray-700">
        <input
          type="checkbox"
          checked={removeContact}
          onChange={(e) => setRemoveContact(e.target.checked)}
        />
        Also remove the original contact row
      </label>
      <p className="text-xs text-gray-500">
        Off by default — the brand info modal still reads these contacts, so removing the row
        blanks a card on that already-shipped view.
      </p>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="flex gap-2">
        <Button type="button" size="sm" disabled={busy || !canSubmit} onClick={submit}>
          {busy ? 'Promoting…' : 'Promote'}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </div>
  )
}

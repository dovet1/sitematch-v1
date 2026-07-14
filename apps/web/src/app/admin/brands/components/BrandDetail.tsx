'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ImageUpload } from '@/components/ui/image-upload'
import { normalizeDomain, validateDomain } from '@/lib/clearbit-logo'

type Tab = 'details' | 'stores' | 'requirements' | 'contacts'

interface BrandData {
  id: string
  name: string
  logo_url: string | null
  domain: string | null
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
  { key: 'requirements', label: 'Requirements' },
  { key: 'contacts', label: 'Contacts' },
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
      {tab === 'requirements' && <RequirementsSection brandId={brandId} brandName={brand.name} />}
      {tab === 'contacts' && <ContactsSection brandId={brandId} onSaved={load} />}
    </div>
  )
}

function DetailsSection({ brand, onSaved }: { brand: BrandData; onSaved: () => void }) {
  const [name, setName] = useState(brand.name)
  const [logoUrl, setLogoUrl] = useState(brand.logo_url ?? '')
  const [domain, setDomain] = useState(brand.domain ?? '')
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
  contact_name: string
  contact_title: string
  contact_org: string
  contact_kind: string
  contact_email: string
  contact_phone: string
  is_primary_contact: boolean
}

function ContactsSection({ brandId, onSaved }: { brandId: string; onSaved: () => void }) {
  const [contacts, setContacts] = useState<ContactDraft[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
            contact_name: c.contact_name ?? '',
            contact_title: c.contact_title ?? '',
            contact_org: c.contact_org ?? '',
            contact_kind: c.contact_kind ?? '',
            contact_email: c.contact_email ?? '',
            contact_phone: c.contact_phone ?? '',
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
          className="grid grid-cols-[1fr_1fr_1fr_130px_1fr_1fr_auto_auto] items-end gap-2 rounded-md border border-gray-200 p-3"
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
        </div>
      ))}

      <Button onClick={save} disabled={saving}>
        {saving ? 'Saving…' : 'Save contacts'}
      </Button>
    </div>
  )
}

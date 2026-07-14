'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

interface RefItem {
  id: string
  name: string
  code?: string
}
interface BrandOption {
  id: string
  name: string
}

interface LocationDraft {
  place_name: string
  formatted_address: string
  lng: string
  lat: string
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

interface FormState {
  company_name: string
  brand_id: string | null
  brand_name: string
  listing_type: string
  title: string
  description: string
  site_size_min: string
  site_size_max: string
  site_acreage_min: string
  site_acreage_max: string
  dwelling_count_min: string
  dwelling_count_max: string
  brochure_url: string
  property_page_link: string
  company_domain: string
  clearbit_logo: boolean
  is_featured_free: boolean
  verified_at: string
  status: string
  sectors: string[]
  use_classes: string[]
  locations: LocationDraft[]
  contacts: ContactDraft[]
}

const EMPTY: FormState = {
  company_name: '',
  brand_id: null,
  brand_name: '',
  listing_type: 'commercial',
  title: '',
  description: '',
  site_size_min: '',
  site_size_max: '',
  site_acreage_min: '',
  site_acreage_max: '',
  dwelling_count_min: '',
  dwelling_count_max: '',
  brochure_url: '',
  property_page_link: '',
  company_domain: '',
  clearbit_logo: false,
  is_featured_free: false,
  verified_at: '',
  status: 'active',
  sectors: [],
  use_classes: [],
  locations: [],
  contacts: [],
}

function num(v: string): number | null {
  const n = Number(v)
  return v.trim() === '' || Number.isNaN(n) ? null : n
}

export function RequirementForm({ requirementId }: { requirementId?: string }) {
  const router = useRouter()
  const isEdit = Boolean(requirementId)

  const [form, setForm] = useState<FormState>(EMPTY)
  const [sectorsRef, setSectorsRef] = useState<RefItem[]>([])
  const [useClassesRef, setUseClassesRef] = useState<RefItem[]>([])
  const [brandQuery, setBrandQuery] = useState('')
  const [brandResults, setBrandResults] = useState<BrandOption[]>([])
  const [creatingBrand, setCreatingBrand] = useState(false)
  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }))

  useEffect(() => {
    fetch('/api/public/reference-data')
      .then((r) => r.json())
      .then((d) => {
        setSectorsRef(d.sectors || [])
        setUseClassesRef(d.useClasses || [])
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!requirementId) return
    fetch(`/api/admin/requirements/${requirementId}`)
      .then((r) => r.json())
      .then((d) => {
        const req = d.requirement
        if (!req) throw new Error('Not found')
        setForm({
          company_name: req.company_name ?? '',
          brand_id: req.brand_id ?? null,
          brand_name: req.brands?.name ?? '',
          listing_type: req.listing_type ?? 'commercial',
          title: req.title ?? '',
          description: req.description ?? '',
          site_size_min: req.site_size_min?.toString() ?? '',
          site_size_max: req.site_size_max?.toString() ?? '',
          site_acreage_min: req.site_acreage_min?.toString() ?? '',
          site_acreage_max: req.site_acreage_max?.toString() ?? '',
          dwelling_count_min: req.dwelling_count_min?.toString() ?? '',
          dwelling_count_max: req.dwelling_count_max?.toString() ?? '',
          brochure_url: req.brochure_url ?? '',
          property_page_link: req.property_page_link ?? '',
          company_domain: req.company_domain ?? '',
          clearbit_logo: Boolean(req.clearbit_logo),
          is_featured_free: Boolean(req.is_featured_free),
          verified_at: req.verified_at ? req.verified_at.slice(0, 10) : '',
          status: req.status ?? 'active',
          sectors: (req.requirement_sectors || []).map((s: any) => s.sector_id),
          use_classes: (req.requirement_use_classes || []).map((u: any) => u.use_class_id),
          locations: (req.requirement_locations || []).map((l: any) => ({
            place_name: l.place_name ?? '',
            formatted_address: l.formatted_address ?? '',
            lng: Array.isArray(l.coordinates) ? String(l.coordinates[0] ?? '') : '',
            lat: Array.isArray(l.coordinates) ? String(l.coordinates[1] ?? '') : '',
          })),
          contacts: (req.requirement_contacts || []).map((c: any) => ({
            contact_name: c.contact_name ?? '',
            contact_title: c.contact_title ?? '',
            contact_org: c.contact_org ?? '',
            contact_kind: c.contact_kind ?? '',
            contact_email: c.contact_email ?? '',
            contact_phone: c.contact_phone ?? '',
            is_primary_contact: Boolean(c.is_primary_contact),
          })),
        })
      })
      .catch(() => setError('Could not load requirement'))
      .finally(() => setLoading(false))
  }, [requirementId])

  useEffect(() => {
    if (brandQuery.trim().length < 2) {
      setBrandResults([])
      return
    }
    const controller = new AbortController()
    const t = setTimeout(() => {
      fetch(`/api/public/brands/search?q=${encodeURIComponent(brandQuery)}`, { signal: controller.signal })
        .then((r) => r.json())
        .then((d) => setBrandResults(d.brands || []))
        .catch(() => {})
    }, 250)
    return () => {
      controller.abort()
      clearTimeout(t)
    }
  }, [brandQuery])

  function toggleId(list: string[], id: string): string[] {
    return list.includes(id) ? list.filter((x) => x !== id) : [...list, id]
  }

  function selectBrand(id: string, name: string) {
    set('brand_id', id)
    set('brand_name', name)
    setBrandQuery('')
    setBrandResults([])
  }

  async function createBrand() {
    const name = brandQuery.trim()
    if (!name) return
    setCreatingBrand(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/brands', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok || !d.brand) throw new Error(d.error || `Failed to create brand (${res.status})`)
      selectBrand(d.brand.id, d.brand.name)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create brand')
    } finally {
      setCreatingBrand(false)
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)

    const payload = {
      company_name: form.company_name.trim(),
      brand_id: form.brand_id,
      listing_type: form.listing_type || null,
      title: form.title || null,
      description: form.description || null,
      site_size_min: num(form.site_size_min),
      site_size_max: num(form.site_size_max),
      site_acreage_min: num(form.site_acreage_min),
      site_acreage_max: num(form.site_acreage_max),
      dwelling_count_min: num(form.dwelling_count_min),
      dwelling_count_max: num(form.dwelling_count_max),
      brochure_url: form.brochure_url || null,
      property_page_link: form.property_page_link || null,
      company_domain: form.company_domain || null,
      clearbit_logo: form.clearbit_logo,
      is_featured_free: form.is_featured_free,
      verified_at: form.verified_at || null,
      status: form.status,
      sectors: form.sectors,
      use_classes: form.use_classes,
      locations: form.locations.map((l) => ({
        place_name: l.place_name || null,
        formatted_address: l.formatted_address || null,
        coordinates:
          l.lng.trim() !== '' && l.lat.trim() !== '' ? [Number(l.lng), Number(l.lat)] : null,
      })),
      contacts: form.contacts.map((c) => ({
        contact_name: c.contact_name || null,
        contact_title: c.contact_title || null,
        contact_org: c.contact_org || null,
        contact_kind: c.contact_kind || null,
        contact_email: c.contact_email || null,
        contact_phone: c.contact_phone || null,
        is_primary_contact: c.is_primary_contact,
      })),
    }

    try {
      if (!payload.company_name) throw new Error('Company name is required')
      const url = isEdit ? `/api/admin/requirements/${requirementId}` : '/api/admin/requirements'
      const res = await fetch(url, {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.error || `Save failed (${res.status})`)
      }
      router.push('/admin/requirements')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="py-8 text-sm text-gray-500">Loading…</div>

  return (
    <form onSubmit={onSubmit} className="max-w-3xl space-y-8">
      {error && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Company</h2>
        <div>
          <Label>Company name *</Label>
          <Input value={form.company_name} onChange={(e) => set('company_name', e.target.value)} required />
        </div>

        <div>
          <Label>Brand (links to store estate)</Label>
          {form.brand_id ? (
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-violet-50 px-2 py-1 text-sm text-violet-700">
                {form.brand_name || form.brand_id}
              </span>
              <Button type="button" size="sm" variant="outline" onClick={() => { set('brand_id', null); set('brand_name', '') }}>
                Clear
              </Button>
            </div>
          ) : (
            <div className="relative">
              <Input
                placeholder="Search brands…"
                value={brandQuery}
                onChange={(e) => setBrandQuery(e.target.value)}
              />
              {brandQuery.trim().length >= 2 && (
                  <div className="absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded-md border border-gray-200 bg-white shadow-lg">
                    {brandResults.map((b) => (
                      <button
                        key={b.id}
                        type="button"
                        className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
                        onClick={() => selectBrand(b.id, b.name)}
                      >
                        {b.name}
                      </button>
                    ))}
                    {!brandResults.some(
                      (b) => b.name.toLowerCase() === brandQuery.trim().toLowerCase()
                    ) && (
                      <button
                        type="button"
                        disabled={creatingBrand}
                        className="block w-full border-t border-gray-100 px-3 py-2 text-left text-sm font-medium text-violet-700 hover:bg-violet-50 disabled:opacity-50"
                        onClick={createBrand}
                      >
                        {creatingBrand ? 'Creating…' : `+ Create brand “${brandQuery.trim()}”`}
                      </button>
                    )}
                  </div>
                )}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Listing type</Label>
            <select
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              value={form.listing_type}
              onChange={(e) => set('listing_type', e.target.value)}
            >
              <option value="commercial">commercial</option>
              <option value="residential">residential</option>
            </select>
          </div>
          <div>
            <Label>Status</Label>
            <select
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              value={form.status}
              onChange={(e) => set('status', e.target.value)}
            >
              <option value="active">active</option>
              <option value="archived">archived</option>
            </select>
          </div>
        </div>

        <div>
          <Label>Title</Label>
          <Input value={form.title} onChange={(e) => set('title', e.target.value)} />
        </div>
        <div>
          <Label>Description</Label>
          <Textarea value={form.description} onChange={(e) => set('description', e.target.value)} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div><Label>Company domain</Label><Input value={form.company_domain} onChange={(e) => set('company_domain', e.target.value)} placeholder="example.com" /></div>
          <div><Label>Verified at</Label><Input type="date" value={form.verified_at} onChange={(e) => set('verified_at', e.target.value)} /></div>
        </div>

        <div className="flex gap-6">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.clearbit_logo} onChange={(e) => set('clearbit_logo', e.target.checked)} />
            Use logo.dev logo (needs domain)
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.is_featured_free} onChange={(e) => set('is_featured_free', e.target.checked)} />
            Featured for free tier
          </label>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Size</h2>
        <div className="grid grid-cols-2 gap-4">
          <div><Label>Site size min (sq ft)</Label><Input type="number" value={form.site_size_min} onChange={(e) => set('site_size_min', e.target.value)} /></div>
          <div><Label>Site size max (sq ft)</Label><Input type="number" value={form.site_size_max} onChange={(e) => set('site_size_max', e.target.value)} /></div>
          <div><Label>Acreage min</Label><Input type="number" value={form.site_acreage_min} onChange={(e) => set('site_acreage_min', e.target.value)} /></div>
          <div><Label>Acreage max</Label><Input type="number" value={form.site_acreage_max} onChange={(e) => set('site_acreage_max', e.target.value)} /></div>
          <div><Label>Dwellings min</Label><Input type="number" value={form.dwelling_count_min} onChange={(e) => set('dwelling_count_min', e.target.value)} /></div>
          <div><Label>Dwellings max</Label><Input type="number" value={form.dwelling_count_max} onChange={(e) => set('dwelling_count_max', e.target.value)} /></div>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Links</h2>
        <div><Label>Brochure URL</Label><Input value={form.brochure_url} onChange={(e) => set('brochure_url', e.target.value)} placeholder="https://…" /></div>
        <div><Label>Property page link</Label><Input value={form.property_page_link} onChange={(e) => set('property_page_link', e.target.value)} placeholder="https://…" /></div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Sectors</h2>
        <div className="flex flex-wrap gap-2">
          {sectorsRef.map((s) => (
            <label key={s.id} className={`cursor-pointer rounded-md border px-2.5 py-1 text-sm ${form.sectors.includes(s.id) ? 'border-violet-500 bg-violet-50 text-violet-700' : 'border-gray-200'}`}>
              <input type="checkbox" className="hidden" checked={form.sectors.includes(s.id)} onChange={() => set('sectors', toggleId(form.sectors, s.id))} />
              {s.name}
            </label>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Use classes</h2>
        <div className="flex flex-wrap gap-2">
          {useClassesRef.map((u) => (
            <label key={u.id} className={`cursor-pointer rounded-md border px-2.5 py-1 text-sm ${form.use_classes.includes(u.id) ? 'border-violet-500 bg-violet-50 text-violet-700' : 'border-gray-200'}`}>
              <input type="checkbox" className="hidden" checked={form.use_classes.includes(u.id)} onChange={() => set('use_classes', toggleId(form.use_classes, u.id))} />
              {u.code ? `${u.code} - ${u.name}` : u.name}
            </label>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Locations</h2>
          <Button type="button" size="sm" variant="outline" onClick={() => set('locations', [...form.locations, { place_name: '', formatted_address: '', lng: '', lat: '' }])}>
            + Add location
          </Button>
        </div>
        {form.locations.map((loc, i) => (
          <div key={i} className="grid grid-cols-[1fr_1fr_100px_100px_auto] items-end gap-2 rounded-md border border-gray-200 p-3">
            <div><Label>Place name</Label><Input value={loc.place_name} onChange={(e) => set('locations', form.locations.map((l, j) => j === i ? { ...l, place_name: e.target.value } : l))} /></div>
            <div><Label>Address</Label><Input value={loc.formatted_address} onChange={(e) => set('locations', form.locations.map((l, j) => j === i ? { ...l, formatted_address: e.target.value } : l))} /></div>
            <div><Label>Lng</Label><Input value={loc.lng} onChange={(e) => set('locations', form.locations.map((l, j) => j === i ? { ...l, lng: e.target.value } : l))} /></div>
            <div><Label>Lat</Label><Input value={loc.lat} onChange={(e) => set('locations', form.locations.map((l, j) => j === i ? { ...l, lat: e.target.value } : l))} /></div>
            <Button type="button" size="sm" variant="outline" onClick={() => set('locations', form.locations.filter((_, j) => j !== i))}>Remove</Button>
          </div>
        ))}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Contacts</h2>
          <Button type="button" size="sm" variant="outline" onClick={() => set('contacts', [...form.contacts, { contact_name: '', contact_title: '', contact_org: '', contact_kind: '', contact_email: '', contact_phone: '', is_primary_contact: form.contacts.length === 0 }])}>
            + Add contact
          </Button>
        </div>
        {form.contacts.map((c, i) => (
          <div key={i} className="grid grid-cols-[1fr_1fr_1fr_130px_1fr_1fr_auto_auto] items-end gap-2 rounded-md border border-gray-200 p-3">
            <div><Label>Name</Label><Input value={c.contact_name} onChange={(e) => set('contacts', form.contacts.map((x, j) => j === i ? { ...x, contact_name: e.target.value } : x))} /></div>
            <div><Label>Title</Label><Input value={c.contact_title} onChange={(e) => set('contacts', form.contacts.map((x, j) => j === i ? { ...x, contact_title: e.target.value } : x))} /></div>
            <div><Label>Org</Label><Input value={c.contact_org} onChange={(e) => set('contacts', form.contacts.map((x, j) => j === i ? { ...x, contact_org: e.target.value } : x))} /></div>
            <div>
              <Label>Kind</Label>
              <select
                className="w-full rounded-md border border-gray-300 px-2 py-2 text-sm"
                value={c.contact_kind}
                onChange={(e) => set('contacts', form.contacts.map((x, j) => j === i ? { ...x, contact_kind: e.target.value } : x))}
              >
                <option value="">—</option>
                <option value="in-house">in-house</option>
                <option value="agency">agency</option>
              </select>
            </div>
            <div><Label>Email</Label><Input value={c.contact_email} onChange={(e) => set('contacts', form.contacts.map((x, j) => j === i ? { ...x, contact_email: e.target.value } : x))} /></div>
            <div><Label>Phone</Label><Input value={c.contact_phone} onChange={(e) => set('contacts', form.contacts.map((x, j) => j === i ? { ...x, contact_phone: e.target.value } : x))} /></div>
            <label className="flex items-center gap-1 pb-2 text-xs">
              <input type="checkbox" checked={c.is_primary_contact} onChange={(e) => set('contacts', form.contacts.map((x, j) => ({ ...x, is_primary_contact: j === i ? e.target.checked : (e.target.checked ? false : x.is_primary_contact) })))} />
              Primary
            </label>
            <Button type="button" size="sm" variant="outline" onClick={() => set('contacts', form.contacts.filter((_, j) => j !== i))}>Remove</Button>
          </div>
        ))}
      </section>

      <div className="flex gap-3 border-t border-gray-200 pt-4">
        <Button type="submit" disabled={saving}>{saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create requirement'}</Button>
        <Button type="button" variant="outline" onClick={() => router.push('/admin/requirements')}>Cancel</Button>
      </div>
    </form>
  )
}

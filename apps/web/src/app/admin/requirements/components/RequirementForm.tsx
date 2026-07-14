'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ImageUpload } from '@/components/ui/image-upload'
import { LocationSearch } from '@/components/listings/location-search'
import { fetchCompanyLogo, getClearbitLogoUrl } from '@/lib/clearbit-logo'
import type { LocationSelection } from '@/types/locations'

interface RefItem {
  id: string
  label: string
  code?: string
}
interface BrandOption {
  id: string
  name: string
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
  site_size_min: string
  site_size_max: string
  brochure_url: string
  property_page_link: string
  company_domain: string
  clearbit_logo: boolean
  logo_url: string
  verified_at: string
  status: string
  sectors: string[]
  use_classes: string[]
  locations: LocationSelection[]
  contacts: ContactDraft[]
}

const EMPTY: FormState = {
  company_name: '',
  brand_id: null,
  brand_name: '',
  site_size_min: '',
  site_size_max: '',
  brochure_url: '',
  property_page_link: '',
  company_domain: '',
  clearbit_logo: false,
  logo_url: '',
  verified_at: '',
  status: 'active',
  sectors: [],
  use_classes: [],
  locations: [],
  contacts: [],
}

type LogoMethod = 'domain' | 'upload'

function num(v: string): number | null {
  const n = Number(v)
  return v.trim() === '' || Number.isNaN(n) ? null : n
}

async function uploadFile(file: File, type: 'logo' | 'brochure'): Promise<string> {
  const fd = new FormData()
  fd.append('file', file)
  fd.append('type', type)
  const res = await fetch('/api/upload', { method: 'POST', body: fd })
  const d = await res.json().catch(() => ({}))
  if (!res.ok || !d.file?.url) throw new Error(d.error || `Upload failed (${res.status})`)
  return d.file.url as string
}

export function RequirementForm({
  requirementId,
  initialBrandId,
  initialBrandName,
}: {
  requirementId?: string
  initialBrandId?: string
  initialBrandName?: string
}) {
  const router = useRouter()
  const isEdit = Boolean(requirementId)

  const [form, setForm] = useState<FormState>(() =>
    initialBrandId
      ? { ...EMPTY, brand_id: initialBrandId, brand_name: initialBrandName ?? '' }
      : EMPTY
  )
  const [sectorsRef, setSectorsRef] = useState<RefItem[]>([])
  const [useClassesRef, setUseClassesRef] = useState<RefItem[]>([])
  const [brandQuery, setBrandQuery] = useState('')
  const [brandResults, setBrandResults] = useState<BrandOption[]>([])
  const [creatingBrand, setCreatingBrand] = useState(false)
  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [logoMethod, setLogoMethod] = useState<LogoMethod>('domain')
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [logoLoading, setLogoLoading] = useState(false)
  const [logoUploading, setLogoUploading] = useState(false)
  const [logoError, setLogoError] = useState<string | null>(null)
  const [brochureUploading, setBrochureUploading] = useState(false)
  const [brochureError, setBrochureError] = useState<string | null>(null)

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
          site_size_min: req.site_size_min?.toString() ?? '',
          site_size_max: req.site_size_max?.toString() ?? '',
          brochure_url: req.brochure_url ?? '',
          property_page_link: req.property_page_link ?? '',
          company_domain: req.company_domain ?? '',
          clearbit_logo: Boolean(req.clearbit_logo),
          logo_url: req.logo_url ?? '',
          verified_at: req.verified_at ? req.verified_at.slice(0, 10) : '',
          status: req.status ?? 'active',
          sectors: (req.requirement_sectors || []).map((s: any) => s.sector_id),
          use_classes: (req.requirement_use_classes || []).map((u: any) => u.use_class_id),
          locations: (req.requirement_locations || []).map((l: any, i: number) => ({
            id: l.id || `loc-${i}`,
            place_name: l.place_name ?? '',
            coordinates: Array.isArray(l.coordinates)
              ? [Number(l.coordinates[0]), Number(l.coordinates[1])]
              : [0, 0],
            type: 'preferred',
            formatted_address: l.formatted_address ?? l.place_name ?? '',
            region: l.region ?? undefined,
            country: l.country ?? undefined,
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

        if (req.logo_url) {
          setLogoMethod('upload')
          setLogoPreview(req.logo_url)
        } else if (req.clearbit_logo && req.company_domain) {
          setLogoMethod('domain')
          setLogoPreview(getClearbitLogoUrl(req.company_domain))
        }
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

  // Debounced logo.dev lookup when using the domain method.
  useEffect(() => {
    if (logoMethod !== 'domain') return
    const domain = form.company_domain.trim()
    if (!domain) {
      setLogoPreview(null)
      setLogoError(null)
      set('clearbit_logo', false)
      return
    }
    const t = setTimeout(async () => {
      setLogoLoading(true)
      setLogoError(null)
      try {
        const url = await fetchCompanyLogo(domain)
        if (url) {
          setLogoPreview(url)
          set('clearbit_logo', true)
        } else {
          setLogoPreview(null)
          set('clearbit_logo', false)
          setLogoError('No logo found')
        }
      } catch (err) {
        setLogoPreview(null)
        set('clearbit_logo', false)
        setLogoError(err instanceof Error ? err.message : 'No logo found')
      } finally {
        setLogoLoading(false)
      }
    }, 800)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.company_domain, logoMethod])

  function switchLogoMethod(m: LogoMethod) {
    setLogoMethod(m)
    setLogoError(null)
    if (m === 'domain') {
      set('logo_url', '')
      setLogoPreview(null)
    } else {
      set('clearbit_logo', false)
      setLogoPreview(form.logo_url || null)
    }
  }

  async function handleLogoFile(file: File | null) {
    if (!file) {
      set('logo_url', '')
      setLogoPreview(null)
      return
    }
    setLogoUploading(true)
    setLogoError(null)
    try {
      const url = await uploadFile(file, 'logo')
      set('logo_url', url)
      set('clearbit_logo', false)
      setLogoPreview(url)
    } catch (err) {
      setLogoError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setLogoUploading(false)
    }
  }

  async function handleBrochureFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setBrochureUploading(true)
    setBrochureError(null)
    try {
      const url = await uploadFile(file, 'brochure')
      set('brochure_url', url)
    } catch (err) {
      setBrochureError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setBrochureUploading(false)
      e.target.value = ''
    }
  }

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
      listing_type: 'commercial',
      title: null,
      description: null,
      site_size_min: num(form.site_size_min),
      site_size_max: num(form.site_size_max),
      site_acreage_min: null,
      site_acreage_max: null,
      dwelling_count_min: null,
      dwelling_count_max: null,
      brochure_url: form.brochure_url || null,
      property_page_link: form.property_page_link || null,
      company_domain: form.company_domain || null,
      clearbit_logo: form.clearbit_logo,
      logo_url: form.logo_url || null,
      is_featured_free: false,
      verified_at: form.verified_at || null,
      status: form.status,
      sectors: form.sectors,
      use_classes: form.use_classes,
      locations: form.locations.map((l) => ({
        place_name: l.place_name || null,
        formatted_address: l.formatted_address || null,
        coordinates: Array.isArray(l.coordinates) ? [l.coordinates[0], l.coordinates[1]] : null,
        region: l.region || null,
        country: l.country || null,
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
          <div>
            <Label>Verified at</Label>
            <Input type="date" value={form.verified_at} onChange={(e) => set('verified_at', e.target.value)} />
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Logo</h2>
        <div className="flex gap-6 text-sm">
          <label className="flex items-center gap-2">
            <input type="radio" checked={logoMethod === 'domain'} onChange={() => switchLogoMethod('domain')} />
            Find via company domain
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" checked={logoMethod === 'upload'} onChange={() => switchLogoMethod('upload')} />
            Upload a logo
          </label>
        </div>

        {logoMethod === 'domain' ? (
          <div className="space-y-2">
            <Label>Company domain</Label>
            <Input
              value={form.company_domain}
              onChange={(e) => set('company_domain', e.target.value)}
              placeholder="example.com"
            />
            {logoLoading && (
              <p className="flex items-center gap-2 text-sm text-blue-600">
                <span className="h-3 w-3 animate-spin rounded-full border border-blue-500 border-t-transparent" />
                Looking for logo…
              </p>
            )}
            {logoError && (
              <p className="text-sm text-red-600">{logoError} — try uploading a logo instead.</p>
            )}
            {logoPreview && form.clearbit_logo && (
              <div className="flex items-center gap-3 rounded-md border border-green-200 bg-green-50 p-3">
                <img src={logoPreview} alt="Company logo" className="h-12 w-12 object-contain" />
                <p className="text-sm text-green-700">Logo found from {form.company_domain}</p>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <ImageUpload
              value={form.logo_url || logoPreview || undefined}
              onChange={handleLogoFile}
              placeholder="Upload company logo"
              maxSize={2 * 1024 * 1024}
              acceptedTypes={['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml']}
            />
            {logoUploading && <p className="text-xs text-gray-500">Uploading…</p>}
            {logoError && <p className="text-xs text-red-600">{logoError}</p>}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Size</h2>
        <div className="grid grid-cols-2 gap-4">
          <div><Label>Site size min (sq ft)</Label><Input type="number" value={form.site_size_min} onChange={(e) => set('site_size_min', e.target.value)} /></div>
          <div><Label>Site size max (sq ft)</Label><Input type="number" value={form.site_size_max} onChange={(e) => set('site_size_max', e.target.value)} /></div>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Links</h2>
        <div className="space-y-2">
          <Label>Requirements brochure</Label>
          {form.brochure_url ? (
            <div className="flex items-center gap-3">
              <a href={form.brochure_url} target="_blank" rel="noreferrer" className="max-w-xs truncate text-sm text-violet-700 underline">
                {form.brochure_url.split('/').pop() || form.brochure_url}
              </a>
              <Button type="button" size="sm" variant="outline" onClick={() => set('brochure_url', '')}>Remove</Button>
            </div>
          ) : (
            <input
              type="file"
              accept="application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              disabled={brochureUploading}
              onChange={handleBrochureFile}
              className="block text-sm"
            />
          )}
          {brochureUploading && <p className="text-xs text-gray-500">Uploading…</p>}
          {brochureError && <p className="text-xs text-red-600">{brochureError}</p>}
        </div>
        <div><Label>Property page link</Label><Input value={form.property_page_link} onChange={(e) => set('property_page_link', e.target.value)} placeholder="https://…" /></div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Sectors</h2>
        <div className="flex flex-wrap gap-2">
          {sectorsRef.map((s) => (
            <label key={s.id} className={`cursor-pointer rounded-md border px-2.5 py-1 text-sm ${form.sectors.includes(s.id) ? 'border-violet-500 bg-violet-50 text-violet-700' : 'border-gray-200'}`}>
              <input type="checkbox" className="hidden" checked={form.sectors.includes(s.id)} onChange={() => set('sectors', toggleId(form.sectors, s.id))} />
              {s.label}
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
              {u.label}
            </label>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Locations</h2>
        <LocationSearch
          value={form.locations}
          onChange={(locs) => set('locations', locs)}
          placeholder="Search for UK/Ireland locations…"
        />
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

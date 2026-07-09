'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Shield, Upload, Loader2, Pencil, Trash2, ArrowLeft } from 'lucide-react'
import { cleanAndCropCadImage } from '@/lib/sitesketcher-v2/cad-utils'
import { CalibrationModal } from '../../sitesketcher-v2/components/modals/CalibrationModal'
import type { SavedCad } from '@/types/sitesketcher-v2'

const MAX_FILE_SIZE = 50 * 1024 * 1024
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/jpg']

interface UploadResult {
  fileName: string
  url: string
  storagePath: string
  imageWidthPx: number
  imageHeightPx: number
}

interface Metadata {
  name: string
  brand: string
  format: string
  sourceStore: string
  surveyYear: string
  gia: string
  dims: string
}

interface PendingUpload extends UploadResult {
  metresPerPixel: number
  calibrationPoints: SavedCad['calibrationPoints']
}

const emptyMeta = (name = ''): Metadata => ({
  name,
  brand: '',
  format: '',
  sourceStore: '',
  surveyYear: String(new Date().getFullYear()),
  gia: '',
  dims: '',
})

export function CadLibraryClient() {
  const [cads, setCads] = useState<SavedCad[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)

  // Upload → calibrate → metadata pipeline state.
  const [uploaded, setUploaded] = useState<UploadResult | null>(null)
  const [processedUrl, setProcessedUrl] = useState<string | null>(null)
  const [showCalibration, setShowCalibration] = useState(false)
  const [pending, setPending] = useState<PendingUpload | null>(null)

  // Metadata form (create or edit).
  const [meta, setMeta] = useState<Metadata>(emptyMeta())
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showMetaForm, setShowMetaForm] = useState(false)

  const fetchCads = async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await fetch('/api/sitesketcher-v2/admin/cads')
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to load library')
      const data = await res.json()
      setCads(data.cads || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load library')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCads()
  }, [])

  const handleFile = async (file: File) => {
    setError(null)
    if (!ALLOWED_TYPES.includes(file.type)) {
      setError('Only PNG and JPG images are allowed')
      return
    }
    if (file.size > MAX_FILE_SIZE) {
      setError('File too large (max 50MB)')
      return
    }
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/sitesketcher-v2/upload-cad', { method: 'POST', body: formData })
      if (!res.ok) throw new Error((await res.json()).error || 'Upload failed')
      const result = await res.json()

      // Client cleanup (transparent background + auto-crop), then server process.
      const cleaned = await cleanAndCropCadImage(result.url)
      const processedName = String(result.fileName).replace(/\.(jpg|jpeg|png|pdf)$/i, '.png')
      const procForm = new FormData()
      procForm.append('file', cleaned.processedBlob, processedName)
      procForm.append('originalStoragePath', result.storagePath)
      const procRes = await fetch('/api/sitesketcher-v2/process-cad', { method: 'POST', body: procForm })
      if (!procRes.ok) throw new Error((await procRes.json()).error || 'Failed to process image')
      const processed = await procRes.json()

      setUploaded({
        fileName: processedName,
        url: result.url,
        storagePath: processed.storagePath,
        imageWidthPx: processed.imageWidthPx,
        imageHeightPx: processed.imageHeightPx,
      })
      setProcessedUrl(processed.url)
      setShowCalibration(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload CAD')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleCalibrationComplete = (calibration: {
    name: string
    metresPerPixel: number
    calibrationPoints: NonNullable<SavedCad['calibrationPoints']>
  }) => {
    if (!uploaded) return
    setPending({
      ...uploaded,
      metresPerPixel: calibration.metresPerPixel,
      calibrationPoints: calibration.calibrationPoints,
    })
    setMeta(emptyMeta(calibration.name))
    setEditingId(null)
    setShowCalibration(false)
    setShowMetaForm(true)
  }

  const validateMeta = (): string | null => {
    if (!meta.name.trim()) return 'Name is required'
    if (!meta.brand.trim()) return 'Brand is required'
    if (!meta.format.trim()) return 'Format is required'
    if (!meta.sourceStore.trim()) return 'Source store is required'
    if (!/^\d{4}$/.test(meta.surveyYear.trim())) return 'Survey year must be a 4-digit year'
    return null
  }

  const metaPayload = () => ({
    name: meta.name.trim(),
    brand: meta.brand.trim(),
    format: meta.format.trim(),
    sourceStore: meta.sourceStore.trim(),
    surveyYear: parseInt(meta.surveyYear, 10),
    gia: meta.gia.trim() ? parseFloat(meta.gia) : undefined,
    dims: meta.dims.trim() || undefined,
  })

  const handleMetaSubmit = async () => {
    const validationError = validateMeta()
    if (validationError) {
      setError(validationError)
      return
    }
    setSaving(true)
    setError(null)
    try {
      if (editingId) {
        const res = await fetch(`/api/sitesketcher-v2/admin/cads/${editingId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(metaPayload()),
        })
        if (!res.ok) throw new Error((await res.json()).error || 'Failed to update')
      } else {
        if (!pending) throw new Error('Missing uploaded CAD')
        const res = await fetch('/api/sitesketcher-v2/admin/cads', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...metaPayload(),
            metresPerPixel: pending.metresPerPixel,
            imageWidthPx: pending.imageWidthPx,
            imageHeightPx: pending.imageHeightPx,
            tmpStoragePath: pending.storagePath,
            fileName: pending.fileName,
            calibrationPoints: pending.calibrationPoints,
          }),
        })
        if (!res.ok) throw new Error((await res.json()).error || 'Failed to save to library')
      }
      closeMetaForm()
      fetchCads()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const startEdit = (cad: SavedCad) => {
    setEditingId(cad.id)
    setPending(null)
    setMeta({
      name: cad.name,
      brand: cad.brand ?? '',
      format: cad.format ?? '',
      sourceStore: cad.sourceStore ?? '',
      surveyYear: cad.surveyYear ? String(cad.surveyYear) : String(new Date().getFullYear()),
      gia: cad.gia != null ? String(cad.gia) : '',
      dims: cad.dims ?? '',
    })
    setShowMetaForm(true)
  }

  const closeMetaForm = () => {
    setShowMetaForm(false)
    setPending(null)
    setEditingId(null)
    setUploaded(null)
    setProcessedUrl(null)
  }

  const handleDelete = async (cad: SavedCad) => {
    if (!confirm(`Delete "${cad.name}" from the shared library? This cannot be undone.`)) return
    try {
      const res = await fetch(`/api/sitesketcher-v2/admin/cads/${cad.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to delete')
      fetchCads()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete')
    }
  }

  return (
    <div className="container mx-auto space-y-6 p-6">
      <div className="flex items-center gap-3">
        <Shield className="h-8 w-8 text-primary" />
        <div className="flex-1">
          <h1 className="heading-1">CAD Library</h1>
          <p className="body-large text-muted-foreground">
            Shared, calibrated site plans that every Plus user can place on their sketches.
          </p>
        </div>
        <Link
          href="/admin"
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted"
        >
          <ArrowLeft className="h-4 w-4" /> Admin
        </Link>
      </div>

      {error && (
        <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="rounded-xl border border-border bg-card p-5">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/jpg"
          className="hidden"
          disabled={uploading}
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) handleFile(file)
          }}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
        >
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {uploading ? 'Uploading…' : 'Upload new plan'}
        </button>
        <p className="mt-2 text-xs text-muted-foreground">
          PNG or JPG, max 50MB. You&apos;ll calibrate the scale and add provenance after upload.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : cads.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-16 text-center text-sm text-muted-foreground">
          No plans in the shared library yet. Upload the first one above.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {cads.map((cad) => (
            <div key={cad.id} className="overflow-hidden rounded-xl border border-border bg-card">
              <div className="aspect-[4/3] w-full bg-muted">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={cad.url} alt={cad.name} className="h-full w-full object-cover" />
              </div>
              <div className="space-y-1 p-3">
                <div className="truncate text-sm font-semibold">{cad.brand || cad.name}</div>
                <div className="truncate text-xs text-muted-foreground">
                  {[cad.format, cad.sourceStore, cad.surveyYear].filter(Boolean).join(' · ')}
                </div>
                {(cad.gia != null || cad.dims) && (
                  <div className="truncate text-xs text-muted-foreground">
                    {[cad.gia != null ? `${Math.round(cad.gia)} m²` : null, cad.dims]
                      .filter(Boolean)
                      .join(' · ')}
                  </div>
                )}
                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => startEdit(cad)}
                    className="inline-flex flex-1 items-center justify-center gap-1 rounded-md border border-border py-1.5 text-xs hover:bg-muted"
                  >
                    <Pencil className="h-3 w-3" /> Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(cad)}
                    className="inline-flex items-center justify-center rounded-md border border-border p-1.5 text-red-600 hover:bg-red-50"
                    title="Delete"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCalibration && uploaded && (
        <CalibrationModal
          imageUrl={processedUrl || uploaded.url}
          imageWidthPx={uploaded.imageWidthPx}
          imageHeightPx={uploaded.imageHeightPx}
          fileName={uploaded.fileName}
          onComplete={handleCalibrationComplete}
          onCancel={() => {
            setShowCalibration(false)
            setUploaded(null)
            setProcessedUrl(null)
          }}
        />
      )}

      {showMetaForm && (
        <MetadataModal
          meta={meta}
          setMeta={setMeta}
          saving={saving}
          isEdit={Boolean(editingId)}
          onSubmit={handleMetaSubmit}
          onCancel={closeMetaForm}
        />
      )}
    </div>
  )
}

function MetadataModal({
  meta,
  setMeta,
  saving,
  isEdit,
  onSubmit,
  onCancel,
}: {
  meta: Metadata
  setMeta: (m: Metadata) => void
  saving: boolean
  isEdit: boolean
  onSubmit: () => void
  onCancel: () => void
}) {
  const field = (key: keyof Metadata) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setMeta({ ...meta, [key]: e.target.value })

  const input =
    'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none'
  const label = 'mb-1 block text-xs font-medium text-muted-foreground'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-card p-6 shadow-xl">
        <h2 className="text-lg font-semibold">
          {isEdit ? 'Edit plan details' : 'Add plan to library'}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Provenance is required so users can find the right plan.
        </p>

        <div className="mt-4 space-y-3">
          <div>
            <label className={label}>Name *</label>
            <input className={input} value={meta.name} onChange={field('name')} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label}>Brand *</label>
              <input className={input} value={meta.brand} onChange={field('brand')} />
            </div>
            <div>
              <label className={label}>Format *</label>
              <input
                className={input}
                value={meta.format}
                onChange={field('format')}
                placeholder="e.g. Superstore"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label}>Source store *</label>
              <input className={input} value={meta.sourceStore} onChange={field('sourceStore')} />
            </div>
            <div>
              <label className={label}>Survey year *</label>
              <input
                className={input}
                value={meta.surveyYear}
                onChange={field('surveyYear')}
                inputMode="numeric"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label}>GIA (m²)</label>
              <input
                className={input}
                value={meta.gia}
                onChange={field('gia')}
                inputMode="decimal"
              />
            </div>
            <div>
              <label className={label}>Dimensions</label>
              <input
                className={input}
                value={meta.dims}
                onChange={field('dims')}
                placeholder="e.g. 60 × 40 m"
              />
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-muted disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {isEdit ? 'Save changes' : 'Add to library'}
          </button>
        </div>
      </div>
    </div>
  )
}

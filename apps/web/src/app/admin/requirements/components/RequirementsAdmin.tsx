'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

type Filter = 'all' | 'active' | 'archived' | 'needs-brand'

interface RequirementRow {
  id: string
  company_name: string
  brand_id: string | null
  listing_type: string | null
  status: string
  is_featured_free: boolean
  updated_at: string
  brands: { name: string } | null
}

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'archived', label: 'Archived' },
  { key: 'needs-brand', label: 'Needs brand' },
]

export function RequirementsAdmin() {
  const [filter, setFilter] = useState<Filter>('active')
  const [rows, setRows] = useState<RequirementRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const params = new URLSearchParams()
    if (filter === 'active' || filter === 'archived') params.set('status', filter)
    if (filter === 'needs-brand') params.set('needsBrand', 'true')
    try {
      const res = await fetch(`/api/admin/requirements?${params.toString()}`)
      if (!res.ok) throw new Error(`Failed (${res.status})`)
      const data = await res.json()
      setRows(data.requirements || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => {
    load()
  }, [load])

  async function archive(id: string) {
    if (!confirm('Archive this requirement? It will drop off the unified map.')) return
    const res = await fetch(`/api/admin/requirements/${id}`, { method: 'DELETE' })
    if (res.ok) load()
    else alert('Failed to archive')
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`rounded-md border px-3 py-1.5 text-sm font-medium ${
              filter === f.key
                ? 'border-violet-500 bg-violet-50 text-violet-700'
                : 'border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && <div className="text-sm text-red-600">{error}</div>}
      {loading ? (
        <div className="py-8 text-center text-sm text-gray-500">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="py-8 text-center text-sm text-gray-500">No requirements.</div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-2.5">Company</th>
                <th className="px-4 py-2.5">Brand</th>
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
                  <td className="px-4 py-2.5">
                    {r.brands?.name ?? (
                      <Badge variant="outline" className="border-amber-300 text-amber-700">
                        Needs brand
                      </Badge>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-gray-600">{r.listing_type ?? '—'}</td>
                  <td className="px-4 py-2.5">
                    <Badge variant={r.status === 'active' ? 'default' : 'secondary'}>
                      {r.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-2.5 text-gray-500">
                    {new Date(r.updated_at).toLocaleDateString('en-GB')}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="outline" asChild>
                        <Link href={`/admin/requirements/${r.id}`}>Edit</Link>
                      </Button>
                      {r.status === 'active' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => archive(r.id)}
                        >
                          Archive
                        </Button>
                      )}
                    </div>
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

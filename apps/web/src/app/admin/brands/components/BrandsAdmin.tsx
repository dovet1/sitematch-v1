'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { getClearbitLogoUrl } from '@/lib/clearbit-logo'

interface BrandRow {
  id: string
  name: string
  logo_url: string | null
  domain: string | null
  storeCount: number
  requirementCount: number
  contactCount: number
}

export function BrandsAdmin() {
  const [rows, setRows] = useState<BrandRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError(null)
    fetch('/api/admin/brands', { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`Failed (${res.status})`)
        return res.json()
      })
      .then((data) => setRows(data.brands || []))
      .catch((err) => {
        if (err?.name !== 'AbortError') setError(err instanceof Error ? err.message : 'Failed to load')
      })
      .finally(() => setLoading(false))
    return () => controller.abort()
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((r) => r.name.toLowerCase().includes(q))
  }, [rows, query])

  return (
    <div className="space-y-4">
      <input
        type="search"
        placeholder="Search brands…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="w-full max-w-sm rounded-md border border-gray-300 px-3 py-2 text-sm"
      />

      {error && <div className="text-sm text-red-600">{error}</div>}
      {loading ? (
        <div className="py-8 text-center text-sm text-gray-500">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="py-8 text-center text-sm text-gray-500">No brands.</div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-2.5">Brand</th>
                <th className="px-4 py-2.5 text-right">Stores</th>
                <th className="px-4 py-2.5 text-right">Requirements</th>
                <th className="px-4 py-2.5 text-right">Contacts</th>
                <th className="px-4 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((b) => {
                const logoSrc = (b.domain && getClearbitLogoUrl(b.domain, 64)) || b.logo_url
                return (
                <tr key={b.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-3">
                      {logoSrc ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={logoSrc} alt="" className="h-8 w-8 rounded object-contain" />
                      ) : (
                        <div className="flex h-8 w-8 items-center justify-center rounded bg-gray-100 text-xs font-semibold text-gray-500">
                          {b.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <span className="font-medium text-gray-900">{b.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-right text-gray-600">{b.storeCount}</td>
                  <td className="px-4 py-2.5 text-right text-gray-600">{b.requirementCount}</td>
                  <td className="px-4 py-2.5 text-right text-gray-600">{b.contactCount}</td>
                  <td className="px-4 py-2.5 text-right">
                    <Button size="sm" variant="outline" asChild>
                      <Link href={`/admin/brands/${b.id}`}>Manage</Link>
                    </Button>
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

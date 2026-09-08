'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import type { BrandFloorAreas, AdminFloorAreaProfile, ProfileStore } from '@/types/floor-area-health'
import { formatArea, formatInt } from '@/lib/epc/display'

/**
 * "How does that become the number users see?" — plan §6.3.
 *
 * The profile rows exactly as the public API returns them, each expanding into the shops
 * behind it: included with their areas, excluded with their reason. That is the whole
 * chain on one screen — certificate to store to profile to the size filter — and it is
 * the fastest way to spot the next concession defect, which is how the last one was found.
 */
export function FloorAreasSection({ brandId }: { brandId: string }) {
  const [data, setData] = useState<BrandFloorAreas | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/brands/${brandId}/floor-areas`)
      if (!res.ok) throw new Error(`Failed (${res.status})`)
      setData(await res.json())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [brandId])

  useEffect(() => {
    load()
  }, [load])

  if (loading) return <div className="py-6 text-sm text-gray-500">Loading…</div>
  if (error || !data) return <div className="py-6 text-sm text-red-600">{error || 'Failed to load'}</div>

  // `stores` is the measured shops only; the rest arrive already grouped by why they
  // were left out, because the screen shows the groups and not the rows.
  const { profiles, stores, excluded, estate, brandPublication } = data

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
        <p className="text-sm text-gray-900">
          <span className="font-semibold">{formatInt(estate.measured)}</span> of{' '}
          <span className="font-semibold">{formatInt(estate.stores)}</span> shops measured
          {estate.stores > 0 && ` (${Math.round((estate.measured / estate.stores) * 100)}%)`}
        </p>
        <p className="mt-1 text-sm text-gray-500">{brandPublication.detail}</p>
        <p className="mt-2 text-xs text-gray-500">
          Areas are gross internal — the whole envelope, not the sales area an agent means
          by &ldquo;size&rdquo;. Only high-confidence matches are counted; the rest are
          listed below with the reason.
        </p>
        {estate.truncated && (
          <p className="mt-2 text-xs text-amber-700">
            This brand has more shops than this screen lists; the profile figures are still
            computed over all of them.
          </p>
        )}
      </div>

      {profiles.length === 0 ? (
        <NoProfile stores={stores} />
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
              <tr>
                <th className="px-3 py-2">Profile</th>
                <th className="px-3 py-2 text-right">Shops</th>
                <th className="px-3 py-2 text-right">Min</th>
                <th className="px-3 py-2 text-right">P25</th>
                <th className="px-3 py-2 text-right">Median</th>
                <th className="px-3 py-2 text-right">P75</th>
                <th className="px-3 py-2 text-right">Max</th>
                <th className="px-3 py-2 text-right">Spread</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {profiles.map((p) => {
                const key = p.fasciaId ?? 'brand'
                const isOpen = open === key
                return (
                  <ProfileRows
                    key={key}
                    profile={p}
                    isOpen={isOpen}
                    onToggle={() => setOpen(isOpen ? null : key)}
                    stores={
                      p.fasciaId === null
                        ? stores
                        : stores.filter((s) => s.fasciaId === p.fasciaId)
                    }
                  />
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {excluded.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-900">Not counted</p>
          <p className="text-sm text-gray-500">
            Every shop the aggregate left out, and why, with a few examples of each. A
            cluster of demotions in one fascia is what a concession defect looks like.
          </p>
          <div className="overflow-hidden rounded-lg border border-gray-200">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-gray-100">
                {excluded.map((g) => (
                  <tr key={g.headline} className="align-top">
                    <td className="w-1/3 px-3 py-2 text-gray-900">{g.headline}</td>
                    <td className="px-3 py-2 text-right text-gray-500">{formatInt(g.count)}</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-x-3 gap-y-1">
                        {g.sample.map((s) => (
                          <StoreLink key={s.id} store={s} />
                        ))}
                        {g.count > g.sample.length && (
                          <span className="text-xs text-gray-400">
                            +{formatInt(g.count - g.sample.length)} more
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

function ProfileRows({
  profile, stores, isOpen, onToggle,
}: {
  profile: AdminFloorAreaProfile
  stores: ProfileStore[]
  isOpen: boolean
  onToggle: () => void
}) {
  const included = [...stores].sort((a, b) => (a.sqFt ?? 0) - (b.sqFt ?? 0))
  return (
    <>
      <tr className="hover:bg-gray-50">
        <td className="px-3 py-2 font-medium text-gray-900">
          {profile.fasciaName ?? (profile.fasciaId === null ? 'All fascias' : 'Unnamed fascia')}
          {profile.fasciaId === null && (
            <span className="ml-2 text-xs font-normal text-gray-500">brand level</span>
          )}
        </td>
        <td className="px-3 py-2 text-right">{formatInt(profile.sampleCount)}</td>
        <td className="px-3 py-2 text-right">{formatInt(profile.minSqFt)}</td>
        <td className="px-3 py-2 text-right">{formatInt(profile.p25SqFt)}</td>
        <td className="px-3 py-2 text-right font-semibold">{formatInt(profile.medianSqFt)}</td>
        <td className="px-3 py-2 text-right">{formatInt(profile.p75SqFt)}</td>
        <td className="px-3 py-2 text-right">{formatInt(profile.maxSqFt)}</td>
        <td className="px-3 py-2 text-right text-gray-500">
          {profile.coefficientOfVariation === null
            ? '—'
            : `${Math.round(profile.coefficientOfVariation * 100)}%`}
        </td>
        <td className="px-3 py-2 text-right">
          <button onClick={onToggle} className="text-xs font-medium text-violet-700 hover:underline">
            {isOpen ? 'Hide shops' : 'Show shops'}
          </button>
        </td>
      </tr>
      {isOpen && (
        <tr>
          <td colSpan={9} className="bg-gray-50 px-3 py-3">
            <p className="mb-2 text-xs text-gray-500">
              {formatInt(included.length)} measured shop{included.length === 1 ? '' : 's'} behind
              this row, smallest first. All figures sq ft.
              {included.length !== profile.sampleCount && (
                <span className="ml-1 text-amber-700">
                  The profile counts {formatInt(profile.sampleCount)} — it was last rebuilt{' '}
                  {profile.generatedAt ? new Date(profile.generatedAt).toLocaleDateString('en-GB') : 'at an unknown time'}
                  , so a difference means a match has changed since.
                </span>
              )}
            </p>
            <div className="flex flex-wrap gap-2">
              {included.map((s) => (
                <Link
                  key={s.id}
                  href={`/admin/stores/${s.id}`}
                  className="rounded border border-gray-200 bg-white px-2 py-1 text-xs hover:border-violet-300"
                >
                  <span className="font-medium text-gray-900">{s.name || 'Unnamed'}</span>
                  <span className="text-gray-500"> · {s.town || '—'} · </span>
                  <span className="font-semibold text-gray-900">{formatArea(s.sqFt, s.m2)}</span>
                </Link>
              ))}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

/**
 * Below five measured shops the product publishes no distribution, and neither does this
 * screen: the individual measurements, never drawn as quartiles. Three of a three-shop
 * estate is a census; two of thirty is a corner of it. The denominator travels with them.
 */
function NoProfile({ stores }: { stores: ProfileStore[] }) {
  const measured = [...stores].sort((a, b) => (a.sqFt ?? 0) - (b.sqFt ?? 0))
  if (measured.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 py-6 text-center text-sm text-gray-500">
        No measured shops, so nothing is published for this brand.
      </div>
    )
  }
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-gray-900">Measured shops</p>
      <p className="text-sm text-gray-500">
        Too few for a distribution, so these are the individual measurements the product
        shows instead — not a median, and not a typical size.
      </p>
      <div className="flex flex-wrap gap-2">
        {measured.map((s) => (
          <Link
            key={s.id}
            href={`/admin/stores/${s.id}`}
            className="rounded border border-gray-200 bg-white px-2 py-1 text-xs hover:border-violet-300"
          >
            <span className="font-medium text-gray-900">{s.name || 'Unnamed'}</span>
            <span className="text-gray-500"> · {s.town || '—'} · </span>
            <span className="font-semibold text-gray-900">{formatArea(s.sqFt, s.m2)}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}

function StoreLink({ store }: { store: ProfileStore }) {
  return (
    <Link
      href={`/admin/stores/${store.id}`}
      className="text-xs text-gray-600 underline decoration-gray-300 hover:text-violet-700"
    >
      {store.name || 'Unnamed'}
      {store.town ? ` (${store.town})` : ''}
    </Link>
  )
}

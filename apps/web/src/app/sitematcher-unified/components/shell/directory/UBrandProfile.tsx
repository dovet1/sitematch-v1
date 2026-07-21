'use client'

import { useEffect, useState } from 'react'
import { Globe, FileText, ChevronRight, Check, Store } from 'lucide-react'
import { UStoreEstateMap, type EstateMapMode } from '../UStoreEstateMap'
import { UBrandAvatar, UKicker, UPanel, UPanelHeader, UOcContact } from './UDirectoryPrimitives'
import type { DirectoryBrandProfile } from '../../../types/unified-workspace'

function formatSqft(n: number | null): string | null {
  return n == null ? null : n.toLocaleString()
}

function statedRequirement(min: number | null, max: number | null): string {
  if (min == null && max == null) return '—'
  if (min != null && max != null) return `${min.toLocaleString()} – ${max.toLocaleString()}`
  return (min ?? max)!.toLocaleString()
}

function relativeDate(iso: string | null): string | null {
  if (!iso) return null
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return null
  const days = Math.floor((Date.now() - then) / 86_400_000)
  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 7) return `${days} days ago`
  if (days < 14) return '1 week ago'
  if (days < 60) return `${Math.floor(days / 7)} weeks ago`
  return `${Math.floor(days / 30)} months ago`
}

function formatEventDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
}

export function UBrandProfile({
  data,
  onOpenAgent,
}: {
  data: DirectoryBrandProfile
  onOpenAgent: (agentId: string) => void
}) {
  const { brand, requirement, contacts, agents, activity } = data
  const [mapMode, setMapMode] = useState<EstateMapMode>('estate')

  // Reset the map layer when the profile changes — a target view left over from the
  // previous brand would be confusing (and its targets are gone).
  useEffect(() => setMapMode('estate'), [brand.id])

  const verified = relativeDate(requirement?.verifiedAt ?? null)
  const latestOpening = brand.latestStore
    ? [brand.latestStore.town, brand.latestStore.date ? formatEventDate(brand.latestStore.date) : null]
        .filter(Boolean)
        .join(' · ')
    : null

  return (
    <div className="flex flex-col gap-3.5">
      {/* ---- Hero ---- */}
      <UPanel className="flex flex-wrap items-center gap-4 p-4">
        <UBrandAvatar
          id={brand.id}
          name={brand.name}
          logoUrl={brand.logoUrl}
          domain={brand.domain}
          size={54}
          radius={14}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="truncate text-[21px] font-semibold tracking-[-0.5px] text-sm-ink">
              {brand.name}
            </h2>
            {brand.websiteUrl && (
              <a
                href={brand.websiteUrl}
                target="_blank"
                rel="noopener noreferrer"
                title="Visit website"
                className="text-sm-ink4 transition-colors hover:text-sm-violet"
              >
                <Globe size={15} />
              </a>
            )}
            {brand.storeLocatorUrl && (
              <a
                href={brand.storeLocatorUrl}
                target="_blank"
                rel="noopener noreferrer"
                title="Store finder"
                className="text-sm-ink4 transition-colors hover:text-sm-violet"
              >
                <Store size={15} />
              </a>
            )}
          </div>

          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {brand.category && (
              <span className="rounded-full bg-sm-ink px-2.5 py-1 text-[11px] font-medium text-white">
                {brand.category}
              </span>
            )}
            {requirement?.useClasses.map((u) => (
              <span
                key={u}
                className="rounded-full border border-sm-border bg-sm-bg px-2.5 py-1 text-[11px] text-sm-ink2"
              >
                {u}
              </span>
            ))}
            {requirement ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#DCFCE7] px-2.5 py-1 font-mono text-[9px] font-bold uppercase tracking-[0.09em] text-[#15803D]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#16A34A]" />
                Actively acquiring
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-sm-border-soft px-2.5 py-1 font-mono text-[9px] font-bold uppercase tracking-[0.09em] text-sm-ink3">
                <span className="h-1.5 w-1.5 rounded-full bg-sm-ink4" />
                No requirement on file
              </span>
            )}
          </div>
        </div>

        {/*
          Hero stats. The design's "Head office" and "Operating since" have no columns, so
          the cluster uses what the data actually supports and drops to two stats when
          there is no requirement to date-stamp.
        */}
        <div className="hidden items-start gap-7 border-l border-sm-border-soft pl-6 sm:flex">
          <div>
            <div className="text-[22px] font-semibold leading-none text-sm-ink">
              {brand.storeCount.toLocaleString()}
            </div>
            <UKicker className="mt-1.5 block">UK stores</UKicker>
          </div>
          {latestOpening && (
            <div>
              <div className="text-[15px] font-semibold leading-none text-sm-ink">
                {latestOpening}
              </div>
              <UKicker className="mt-1.5 block">
                {brand.latestStore?.dateIsProxy ? 'Latest added' : 'Latest opening'}
              </UKicker>
            </div>
          )}
          {verified && (
            <div>
              <div className="text-[15px] font-semibold leading-none text-sm-ink">{verified}</div>
              <UKicker className="mt-1.5 block">Verified</UKicker>
            </div>
          )}
        </div>
      </UPanel>

      {/* ---- Main row: requirement + estate map ---- */}
      <div
        className="grid gap-3.5"
        style={{ gridTemplateColumns: 'minmax(0,0.82fr) minmax(0,1.18fr)' }}
      >
        <UPanel className="flex min-h-[310px] flex-col">
          <UPanelHeader title="Expansion requirement" />
          {requirement ? (
            <div className="flex flex-1 flex-col p-4 pt-3">
              <div className="grid grid-cols-2 gap-2.5">
                <div className="rounded-[11px] border border-sm-border-soft bg-sm-bg p-3.5">
                  <UKicker className="block">Stated requirement</UKicker>
                  <div className="mt-1.5 text-[21px] font-semibold leading-none text-sm-ink">
                    {statedRequirement(requirement.sizeMin, requirement.sizeMax)}
                    <span className="ml-1 text-[11px] font-normal text-sm-ink3">sq ft</span>
                  </div>
                </div>

                {/* Curated, not computed: stores has no numeric sq ft, so this is an
                    admin-entered figure and the basis line says where it came from. */}
                <div className="rounded-[11px] border border-sm-violet-tint bg-sm-violet-tint-soft p-3.5">
                  <UKicker className="!text-sm-violet-deep block">Size seen in market</UKicker>
                  {requirement.sizeSeenSqft != null ? (
                    <>
                      <div className="mt-1.5 flex items-center gap-1.5">
                        <Check size={14} className="text-sm-violet-deep" />
                        <span className="text-[21px] font-semibold leading-none text-sm-violet-deep">
                          {formatSqft(requirement.sizeSeenSqft)}
                          <span className="ml-1 text-[11px] font-normal">sq ft</span>
                        </span>
                      </div>
                      {requirement.sizeSeenBasis && (
                        <p className="mt-1.5 text-[10.5px] leading-snug text-sm-ink3">
                          <span className="font-semibold text-sm-ink2">Basis:</span>{' '}
                          {requirement.sizeSeenBasis}
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="mt-1.5 text-[11.5px] text-sm-ink3">Not recorded</p>
                  )}
                </div>
              </div>

              {requirement.summary && (
                <p className="mt-3.5 text-[12.5px] leading-[1.6] text-sm-ink2">
                  {requirement.summary}
                </p>
              )}

              <div className="mt-3.5 grid grid-cols-3 gap-3 border-t border-sm-border-soft pt-3">
                <div>
                  <UKicker className="block">Listing</UKicker>
                  <div className="mt-1 text-[12.5px] capitalize text-sm-ink2">
                    {requirement.listingType || '—'}
                  </div>
                </div>
                <div>
                  <UKicker className="block">Use class</UKicker>
                  <div className="mt-1 truncate text-[12.5px] text-sm-ink2">
                    {requirement.useClasses[0] || '—'}
                  </div>
                </div>
                <div>
                  <UKicker className="block">Verified</UKicker>
                  <div className="mt-1 text-[12.5px] text-sm-ink2">{verified || '—'}</div>
                </div>
              </div>

              {requirement.brochureUrl && (
                <a
                  href={requirement.brochureUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group mt-3.5 flex items-center gap-3 rounded-[11px] bg-sm-ink px-3.5 py-3 transition-colors hover:bg-sm-violet"
                >
                  <FileText size={16} className="flex-shrink-0 text-white" />
                  <span className="flex-1 text-[12.5px] font-medium text-white">
                    View requirement brochure
                  </span>
                  <ChevronRight size={15} className="flex-shrink-0 text-white/70" />
                </a>
              )}

              {requirement.targetNames.length > 0 && (
                <div className="mt-3.5">
                  <UKicker className="block">Target locations</UKicker>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {requirement.targetNames.map((n, i) => (
                      <span
                        key={`${n}-${i}`}
                        className="rounded-full bg-sm-violet-tint-soft px-2.5 py-1 text-[11.5px] text-sm-violet-deep"
                      >
                        {n}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
              <FileText size={22} className="text-sm-ink4" />
              <div className="text-[13.5px] font-semibold text-sm-ink">No requirement on file</div>
              <p className="max-w-[260px] text-[12px] leading-snug text-sm-ink3">
                We don&apos;t hold a live requirement for {brand.name}. Contact the team below to
                ask about their current acquisition plans.
              </p>
            </div>
          )}
        </UPanel>

        <UPanel className="flex min-h-[310px] flex-col overflow-hidden">
          <div className="relative flex-1">
            <UStoreEstateMap
              stores={brand.stores}
              count={brand.storeCount}
              mode={mapMode}
              onModeChange={setMapMode}
              targets={requirement?.targets ?? []}
              showLegend
            />
          </div>
        </UPanel>
      </div>

      {/* ---- Key contacts ---- */}
      <UPanel>
        <UPanelHeader
          title="Key contacts"
          right={
            <span className="font-mono text-[10px] text-sm-ink3">
              {contacts.length} in-house · {agents.length} agents
            </span>
          }
        />
        <div className="p-4 pt-3">
          {contacts.length + agents.length === 0 ? (
            <p className="text-[12.5px] text-sm-ink3">No contacts on file for this brand.</p>
          ) : (
            <div
              className="grid gap-2.5"
              style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))' }}
            >
              {contacts.map((c) => (
                <UOcContact key={c.id} contact={c} />
              ))}
              {agents.map((a) => (
                <UOcContact key={a.id} contact={a} onOpenAgent={onOpenAgent} />
              ))}
            </div>
          )}
        </div>
      </UPanel>

      {/* ---- Activity ---- */}
      {activity.length > 0 && (
        <UPanel>
          <UPanelHeader title="Recent & upcoming activity" />
          <div className="p-4 pt-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {activity.map((e) => {
                const opening = e.kind === 'opening'
                return (
                  <div
                    key={e.id}
                    className="rounded-[11px] border border-sm-border-soft bg-sm-bg p-3.5"
                    style={{ borderTop: `3px solid ${opening ? '#16A34A' : '#DC2626'}` }}
                  >
                    <div className="mb-2 flex flex-wrap items-center gap-1.5">
                      <span
                        className="rounded px-1.5 py-0.5 font-mono text-[8.5px] font-bold uppercase tracking-[0.08em]"
                        style={
                          opening
                            ? { background: '#DCFCE7', color: '#15803D' }
                            : { background: '#FEE2E2', color: '#DC2626' }
                        }
                      >
                        {opening ? 'Opening' : 'Closure'}
                      </span>
                      <span className="font-mono text-[10.5px] font-semibold text-sm-ink">
                        {formatEventDate(e.eventDate)}
                      </span>
                      {e.isUpcoming && (
                        <span className="font-mono text-[8.5px] uppercase tracking-[0.08em] text-sm-ink4">
                          Upcoming
                        </span>
                      )}
                    </div>
                    {e.url ? (
                      <a
                        href={e.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[12.5px] font-medium leading-snug text-sm-ink2 transition-colors hover:text-sm-violet"
                      >
                        {e.headline} <span className="text-sm-ink4">↗</span>
                      </a>
                    ) : (
                      <span className="text-[12.5px] font-medium leading-snug text-sm-ink2">
                        {e.headline}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </UPanel>
      )}
    </div>
  )
}

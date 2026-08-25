'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import mapboxgl from 'mapbox-gl'
import {
  Archive,
  ArrowLeft,
  Building2,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Eye,
  ExternalLink,
  Loader2,
  MapPin,
  Store,
} from 'lucide-react'
import { circleGeometry, geometryBounds } from '@/app/sitematcher-unified/lib/geo'
import type {
  PlanningAlertApplication,
  PlanningAlertDigest,
  PlanningAlertReportState,
  PlanningAlertSubscriptionOption,
} from '@/lib/planning-alerts/types'
import { withCommercialRelevance } from '@/lib/planning-alerts/relevance'

export interface PlanningAlertReportNavigation {
  basePath: string
  currentMonth: string
  latestMonth: string
  activeSubscriptionId?: string
  subscriptions?: PlanningAlertSubscriptionOption[]
  backHref?: string
}

function formatDate(date: string): string {
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    .format(new Date(`${date}T00:00:00Z`))
}

function alertPointCollection(digest: PlanningAlertDigest): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [
    ...digest.stores.map((store): GeoJSON.Feature => ({
      type: 'Feature', properties: { id: store.id, kind: 'store' },
      geometry: { type: 'Point', coordinates: [store.lng, store.lat] },
    })),
    ...digest.nearStoreApplications.map((application): GeoJSON.Feature => ({
      type: 'Feature', properties: { id: application.id, kind: 'near' },
      geometry: { type: 'Point', coordinates: [application.lng, application.lat] },
    })),
    ...digest.patchApplications.map((application): GeoJSON.Feature => ({
      type: 'Feature', properties: { id: application.id, kind: 'patch' },
      geometry: { type: 'Point', coordinates: [application.lng, application.lat] },
    })),
  ]
  return { type: 'FeatureCollection', features }
}

function EstateMap({ digest, selected }: { digest: PlanningAlertDigest; selected: PlanningAlertApplication | null }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const latestDigestRef = useRef(digest)
  latestDigestRef.current = digest
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN

  useEffect(() => {
    if (!containerRef.current || !token || mapRef.current) return
    mapboxgl.accessToken = token
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/light-v11',
      center: [-2.24, 53.48],
      zoom: 9,
      attributionControl: true,
    })
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right')
    mapRef.current = map

    map.on('load', () => {
      const currentDigest = latestDigestRef.current
      const storeBuffers: GeoJSON.FeatureCollection = {
        type: 'FeatureCollection',
        features: currentDigest.stores.map((store) => ({
          type: 'Feature', properties: { id: store.id },
          geometry: circleGeometry(store.lng, store.lat, currentDigest.radiusKm),
        })),
      }
      map.addSource('alert-patch', { type: 'geojson', data: currentDigest.patch.geometry })
      map.addLayer({ id: 'alert-patch-fill', type: 'fill', source: 'alert-patch', paint: { 'fill-color': '#6941C6', 'fill-opacity': 0.08 } })
      map.addLayer({ id: 'alert-patch-line', type: 'line', source: 'alert-patch', paint: { 'line-color': '#6941C6', 'line-width': 2, 'line-dasharray': [2, 2] } })
      map.addSource('store-buffers', { type: 'geojson', data: storeBuffers })
      map.addLayer({ id: 'store-buffer-fill', type: 'fill', source: 'store-buffers', paint: { 'fill-color': '#2563EB', 'fill-opacity': 0.07 } })
      map.addLayer({ id: 'store-buffer-line', type: 'line', source: 'store-buffers', paint: { 'line-color': '#2563EB', 'line-width': 1, 'line-opacity': 0.42 } })

      map.addSource('alert-points', { type: 'geojson', data: alertPointCollection(currentDigest) })
      map.addLayer({
        id: 'alert-store-points', type: 'circle', source: 'alert-points',
        filter: ['==', ['get', 'kind'], 'store'],
        paint: { 'circle-radius': 7, 'circle-color': '#2563EB', 'circle-stroke-color': '#FFFFFF', 'circle-stroke-width': 2 },
      })
      map.addLayer({
        id: 'alert-near-points', type: 'circle', source: 'alert-points',
        filter: ['==', ['get', 'kind'], 'near'],
        paint: { 'circle-radius': 7, 'circle-color': '#D97706', 'circle-stroke-color': '#FFFFFF', 'circle-stroke-width': 2 },
      })
      map.addLayer({
        id: 'alert-patch-points', type: 'circle', source: 'alert-points',
        filter: ['==', ['get', 'kind'], 'patch'],
        paint: { 'circle-radius': 7, 'circle-color': '#6941C6', 'circle-stroke-color': '#FFFFFF', 'circle-stroke-width': 2 },
      })

      const [minLng, minLat, maxLng, maxLat] = geometryBounds(currentDigest.patch.geometry)
      const bounds = new mapboxgl.LngLatBounds([minLng, minLat], [maxLng, maxLat])
      for (const store of currentDigest.stores) bounds.extend([store.lng, store.lat])
      map.fitBounds(bounds, { padding: 54, maxZoom: 12, duration: 0 })
    })

    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [digest.period.start, digest.subscriptionId, token])

  useEffect(() => {
    const source = mapRef.current?.getSource('alert-points') as mapboxgl.GeoJSONSource | undefined
    source?.setData(alertPointCollection(digest))
  }, [digest])

  useEffect(() => {
    if (!selected || !mapRef.current) return
    mapRef.current.flyTo({ center: [selected.lng, selected.lat], zoom: 13, duration: 600 })
  }, [selected])

  if (!token) {
    return (
      <div className="flex min-h-[360px] flex-1 items-center justify-center bg-slate-100 px-8 text-center">
        <div className="max-w-sm">
          <MapPin className="mx-auto h-8 w-8 text-slate-400" aria-hidden="true" />
          <p className="mt-3 text-sm font-semibold text-slate-700">Map preview unavailable</p>
          <p className="mt-1 text-sm text-slate-500">Add NEXT_PUBLIC_MAPBOX_TOKEN to display the estate, patch and application locations.</p>
        </div>
      </div>
    )
  }

  return <div ref={containerRef} className="min-h-[420px] w-full flex-1" role="region" aria-label={`${digest.brand.name} estate and planning application map`} />
}

function ApplicationCard({ application, kind, onSelect }: {
  application: PlanningAlertApplication
  kind: 'near' | 'patch'
  onSelect: () => void
}) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-4">
        <button type="button" onClick={onSelect} className="min-h-11 flex-1 cursor-pointer text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600 focus-visible:ring-offset-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${kind === 'near' ? 'bg-amber-50 text-amber-800' : 'bg-violet-50 text-violet-800'}`}>
              {kind === 'near' ? `${application.nearestStore?.distanceKm.toFixed(1)} km from store` : 'In your patch'}
            </span>
            <span className="text-xs font-medium text-slate-500">{formatDate(application.dateReceived)}</span>
          </div>
          <h3 className="mt-3 text-[15px] font-semibold leading-snug text-slate-900">{application.address}</h3>
          <p className="mt-1 text-xs font-medium text-violet-700">{application.reference}</p>
          <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-600">{application.description}</p>
          {application.relevance && (
            <p className="mt-3 text-xs font-medium text-slate-600">{application.relevance.reason}</p>
          )}
          {application.nearestStore && <p className="mt-3 text-xs text-slate-500">Nearest: {application.nearestStore.name}{application.nearestStore.town ? `, ${application.nearestStore.town}` : ''}</p>}
        </button>
        {application.sourceUrl && (
          <a href={application.sourceUrl} target="_blank" rel="noreferrer" aria-label={`Open ${application.reference} at source`} className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600">
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
          </a>
        )}
      </div>
    </article>
  )
}

const relevancePresentation = {
  priority: {
    label: 'Priority',
    description: 'Major development, commercial changes of use and significant schemes.',
    icon: AlertCircle,
    colour: 'text-rose-700',
    iconBackground: 'bg-rose-50 text-rose-700',
  },
  watchlist: {
    label: 'Watchlist',
    description: 'Smaller schemes, commercial alterations and meaningful progress updates.',
    icon: Eye,
    colour: 'text-amber-700',
    iconBackground: 'bg-amber-50 text-amber-700',
  },
  low: {
    label: 'Low relevance',
    description: 'Routine household, tree, signage and administrative applications.',
    icon: Archive,
    colour: 'text-slate-600',
    iconBackground: 'bg-slate-100 text-slate-600',
  },
} as const

function RelevanceApplicationGroup({
  level,
  applications,
  onSelect,
}: {
  level: keyof typeof relevancePresentation
  applications: PlanningAlertApplication[]
  onSelect: (application: PlanningAlertApplication) => void
}) {
  const presentation = relevancePresentation[level]
  const Icon = presentation.icon
  const cards = (
    <div className="space-y-3">
      {applications.map((application) => (
        <ApplicationCard
          key={application.id}
          application={application}
          kind={application.nearestStore ? 'near' : 'patch'}
          onSelect={() => onSelect(application)}
        />
      ))}
      {applications.length === 0 && (
        <p className="rounded-xl border border-dashed border-slate-300 bg-white p-5 text-sm text-slate-500">
          No applications were classified at this level.
        </p>
      )}
    </div>
  )

  const heading = (
    <div className="flex min-w-0 items-center gap-3">
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${presentation.iconBackground}`}>
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className={`block text-xs font-bold uppercase tracking-wider ${presentation.colour}`}>{presentation.label}</span>
        <span className="mt-0.5 block text-sm leading-5 text-slate-500">{presentation.description}</span>
      </span>
    </div>
  )

  if (level === 'low') {
    return (
      <details className="group rounded-2xl border border-slate-200 bg-slate-100/60">
        <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-4 rounded-2xl px-4 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600 focus-visible:ring-offset-2 [&::-webkit-details-marker]:hidden">
          {heading}
          <span className="shrink-0 text-sm font-semibold tabular-nums text-slate-600">{applications.length}</span>
        </summary>
        <div className="space-y-3 border-t border-slate-200 px-3 pb-3 pt-3 sm:px-4 sm:pb-4">{cards}</div>
      </details>
    )
  }

  return (
    <section>
      <div className="mb-3 flex items-center justify-between gap-4">
        {heading}
        <span className="shrink-0 text-sm font-semibold tabular-nums text-slate-500">{applications.length}</span>
      </div>
      {cards}
    </section>
  )
}

function shiftedMonth(month: string, offset: number): string {
  const [year, monthNumber] = month.split('-').map(Number)
  const date = new Date(Date.UTC(year, monthNumber - 1 + offset, 1))
  return date.toISOString().slice(0, 7)
}

function ReportControls({ navigation, periodLabel }: {
  navigation: PlanningAlertReportNavigation
  periodLabel: string
}) {
  const router = useRouter()
  const previousMonth = shiftedMonth(navigation.currentMonth, -1)
  const nextMonth = shiftedMonth(navigation.currentMonth, 1)
  const canGoForward = nextMonth <= navigation.latestMonth

  const reportUrl = (month: string, subscriptionId = navigation.activeSubscriptionId) => {
    const query = new URLSearchParams({ month })
    if (subscriptionId) query.set('subscription', subscriptionId)
    return `${navigation.basePath}?${query.toString()}`
  }

  return (
    <div className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-2 sm:flex-nowrap sm:justify-end">
      {navigation.subscriptions && navigation.subscriptions.length > 1 && (
        <label className="min-w-0 flex-1 sm:max-w-[290px]">
          <span className="sr-only">Planning alert subscription</span>
          <select
            value={navigation.activeSubscriptionId}
            onChange={(event) => router.push(reportUrl(navigation.currentMonth, event.target.value))}
            className="h-11 w-full cursor-pointer rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 outline-none transition-colors hover:border-slate-400 focus:border-violet-600 focus:ring-2 focus:ring-violet-200"
          >
            {navigation.subscriptions.map((subscription) => (
              <option key={subscription.id} value={subscription.id}>
                {subscription.brandName} · {subscription.patchName}
                {subscription.recipientEmail ? ` · ${subscription.recipientEmail}` : ''}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="flex h-11 shrink-0 items-center rounded-lg border border-slate-200 bg-slate-50">
        <button
          type="button"
          onClick={() => router.push(reportUrl(previousMonth))}
          aria-label={`View the month before ${periodLabel}`}
          className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-l-lg text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-950 focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        </button>
        <div className="flex min-w-[136px] items-center justify-center gap-2 border-x border-slate-200 px-3 text-sm font-medium text-slate-700">
          <CalendarDays className="h-4 w-4 text-slate-500" aria-hidden="true" />
          <span>{periodLabel}</span>
        </div>
        <button
          type="button"
          onClick={() => router.push(reportUrl(nextMonth))}
          disabled={!canGoForward}
          aria-label={`View the month after ${periodLabel}`}
          className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-r-lg text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-950 focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600 disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:bg-transparent"
        >
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}

export function PlanningAlertReport({
  digest: initialDigest,
  generation: initialGeneration,
  navigation,
}: {
  digest: PlanningAlertDigest
  generation?: PlanningAlertReportState['generation']
  navigation?: PlanningAlertReportNavigation
}) {
  const [digest, setDigest] = useState(initialDigest)
  const [generation, setGeneration] = useState(initialGeneration)
  const [generationConnectionError, setGenerationConnectionError] = useState<string | null>(null)
  const [selected, setSelected] = useState<PlanningAlertApplication | null>(null)

  useEffect(() => {
    setDigest(initialDigest)
    setGeneration(initialGeneration)
    setGenerationConnectionError(null)
  }, [initialDigest, initialGeneration])

  useEffect(() => {
    const subscriptionId = navigation?.activeSubscriptionId
    const month = navigation?.currentMonth
    if (!subscriptionId || !month || initialGeneration?.status !== 'processing') return

    let stopped = false
    let activeController: AbortController | null = null
    const wait = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds))

    async function continueGeneration() {
      while (!stopped) {
        activeController = new AbortController()
        try {
          const response = await fetch('/api/planning-alerts/process', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ subscriptionId, month }),
            signal: activeController.signal,
          })
          const payload = await response.json()
          if (!response.ok) throw new Error(payload.error ?? 'Could not continue report generation')
          if (stopped) return
          const state = payload as PlanningAlertReportState
          setDigest(state.digest)
          setGeneration(state.generation)
          setGenerationConnectionError(null)
          if (state.generation.status !== 'processing') return
          await wait(350)
        } catch (error) {
          if (stopped || (error instanceof DOMException && error.name === 'AbortError')) return
          setGenerationConnectionError(
            error instanceof Error ? error.message : 'Could not continue report generation'
          )
          await wait(5000)
        }
      }
    }

    void continueGeneration()
    return () => {
      stopped = true
      activeController?.abort()
    }
  }, [initialGeneration?.status, navigation?.activeSubscriptionId, navigation?.currentMonth])

  const total = digest.nearStoreApplications.length + digest.patchApplications.length
  const applications = [...digest.nearStoreApplications, ...digest.patchApplications]
    .map(withCommercialRelevance)
  const relevanceGroups = {
    priority: applications.filter((application) => application.relevance?.level === 'priority'),
    watchlist: applications.filter((application) => application.relevance?.level === 'watchlist'),
    low: applications.filter((application) => application.relevance?.level === 'low'),
  }
  const isProcessing = generation?.status === 'processing'
  const generationPercent = generation && generation.totalPrefixes > 0
    ? Math.round((generation.processedPrefixes / generation.totalPrefixes) * 100)
    : 0

  return (
    <div className="min-h-dvh bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-[1480px] flex-col items-stretch justify-between gap-3 px-5 py-3 sm:flex-row sm:items-center sm:px-8">
          <div className="flex shrink-0 items-center gap-3">
            {navigation?.backHref && (
              <a
                href={navigation.backHref}
                aria-label="Back to SiteMatcher"
                className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600"
              >
                <ArrowLeft className="h-5 w-5" aria-hidden="true" />
              </a>
            )}
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-700 text-white"><Building2 className="h-5 w-5" aria-hidden="true" /></div>
            <div><div className="font-semibold tracking-tight">SiteMatcher</div><div className="text-xs text-slate-500">Planning intelligence</div></div>
          </div>
          {navigation ? (
            <ReportControls navigation={navigation} periodLabel={digest.period.label} />
          ) : (
            <div className="flex h-11 items-center gap-2 text-sm text-slate-600"><CalendarDays className="h-4 w-4" aria-hidden="true" />{digest.period.label}</div>
          )}
        </div>
      </header>

      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-[1480px] px-5 py-7 sm:px-8 sm:py-9">
          <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-violet-700">Monthly estate watch</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">{digest.brand.name}</h1>
              <p className="mt-2 max-w-2xl text-base leading-7 text-slate-600">New planning activity near your stores and across {digest.patch.name}.</p>
            </div>
            <dl className="grid grid-cols-3 divide-x divide-slate-200 rounded-xl border border-slate-200 bg-slate-50">
              <div className="px-4 py-3 text-center sm:px-6"><dt className="text-xs text-slate-500">Stores</dt><dd className="mt-1 text-xl font-semibold tabular-nums">{digest.stores.length}</dd></div>
              <div className="px-4 py-3 text-center sm:px-6"><dt className="text-xs text-slate-500">Near estate</dt><dd className="mt-1 text-xl font-semibold tabular-nums text-amber-700">{digest.nearStoreApplications.length}</dd></div>
              <div className="px-4 py-3 text-center sm:px-6"><dt className="text-xs text-slate-500">In patch</dt><dd className="mt-1 text-xl font-semibold tabular-nums text-violet-700">{digest.patchApplications.length}</dd></div>
            </dl>
          </div>
        </div>
      </section>

      <div className="mx-auto grid max-w-[1480px] gap-6 px-5 py-6 sm:px-8 lg:grid-cols-[minmax(0,1.08fr)_minmax(390px,0.92fr)]">
        <section className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm lg:sticky lg:top-6 lg:h-[calc(100dvh-3rem)]">
          <EstateMap digest={digest} selected={selected} />
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-slate-200 bg-white px-4 py-3 text-xs text-slate-600">
            <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-blue-600" />Store + {digest.radiusKm} km</span>
            <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-amber-600" />Near a store</span>
            <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-violet-600" />Elsewhere in patch</span>
          </div>
        </section>

        <section aria-label="Planning applications" className="space-y-7">
          {generation && (isProcessing || generation.status === 'failed') && (
            <div className={`rounded-2xl border p-5 ${generation.status === 'failed' ? 'border-rose-200 bg-rose-50' : 'border-blue-200 bg-blue-50'}`}>
              <div className="flex items-start gap-3">
                {isProcessing ? (
                  <Loader2 className="mt-0.5 h-5 w-5 shrink-0 animate-spin text-blue-700" aria-hidden="true" />
                ) : (
                  <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-700" aria-hidden="true" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className={`text-sm font-semibold ${generation.status === 'failed' ? 'text-rose-900' : 'text-blue-950'}`}>
                      {isProcessing ? 'Building this report' : 'Report generation paused'}
                    </p>
                    <span className="text-xs font-semibold tabular-nums text-slate-600">
                      {generation.processedPrefixes.toLocaleString()} of {generation.totalPrefixes.toLocaleString()} postcode areas
                    </span>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/80" aria-label={`${generationPercent}% complete`}>
                    <div className={`h-full rounded-full transition-[width] duration-300 ${generation.status === 'failed' ? 'bg-rose-600' : 'bg-blue-600'}`} style={{ width: `${generationPercent}%` }} />
                  </div>
                  <p className="mt-2 text-xs leading-5 text-slate-600">
                    {isProcessing
                      ? 'Applications found so far are shown below. You can leave this page and resume later without losing completed work.'
                      : generation.error ?? 'Generation stopped after repeated planning-data errors.'}
                  </p>
                  {generationConnectionError && isProcessing && (
                    <p className="mt-1 text-xs text-amber-800">Connection interrupted; retrying automatically. {generationConnectionError}</p>
                  )}
                </div>
              </div>
            </div>
          )}
          {digest.summary && <div className="rounded-xl border border-violet-200 bg-violet-50 p-5"><p className="text-xs font-bold uppercase tracking-wider text-violet-700">Monthly summary</p><p className="mt-2 text-sm leading-6 text-violet-950">{digest.summary}</p></div>}
          {total === 0 && <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center"><Store className="mx-auto h-8 w-8 text-slate-400" aria-hidden="true" /><h2 className="mt-3 font-semibold">{isProcessing ? 'No matching applications found yet' : 'No matching applications'}</h2><p className="mt-1 text-sm text-slate-500">{isProcessing ? 'Matches will appear here as postcode areas are completed.' : `There was no new planning activity in the configured areas during ${digest.period.label}.`}</p></div>}
          {total > 0 && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-violet-700">Commercial relevance</p>
              <h2 className="mt-1 text-xl font-semibold">Applications ranked for review</h2>
              <p className="mt-1 text-sm leading-6 text-slate-500">Every matching application remains available. Low-relevance results are collapsed to keep the strongest signals in view.</p>
            </div>
          )}
          {total > 0 && (
            <RelevanceApplicationGroup level="priority" applications={relevanceGroups.priority} onSelect={setSelected} />
          )}
          {total > 0 && (
            <RelevanceApplicationGroup level="watchlist" applications={relevanceGroups.watchlist} onSelect={setSelected} />
          )}
          {total > 0 && (
            <RelevanceApplicationGroup level="low" applications={relevanceGroups.low} onSelect={setSelected} />
          )}
          <p className="pb-4 text-xs leading-5 text-slate-500">{digest.provider === 'mock' ? 'Demonstration data modelled on the PlanNexus response format.' : 'Planning data provided by PlanNexus.'} Distances are straight-line measurements from application coordinates to the nearest store. The patch boundary is configured by SiteMatcher for this alert.</p>
        </section>
      </div>
    </div>
  )
}

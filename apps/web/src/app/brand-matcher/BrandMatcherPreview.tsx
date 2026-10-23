'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { ChevronDown } from 'lucide-react'
import { useAuth } from '@/contexts/auth-context'
import { parseProPlan, PRO_TRIAL_DAYS } from '@/lib/pro-plan'
import { readSiteParams, toQueryUseClass, workspaceHref, type HomeUseClass, HOME_USE_CLASSES } from '@/lib/brand-matcher-link'
import { formatSqft, SIGNAL_LABEL } from '@/app/sitematcher/lib/brand-matcher'
import { PREVIEW_ROW_GRID } from '@/app/sitematcher/components/shell/brand-matcher/BrandMatchCard'
import { SignalCell, plural } from '@/app/sitematcher/components/shell/brand-matcher/BrandMatcherUi'
import { BrandMatcherScanningView } from '@/app/sitematcher/components/shell/brand-matcher/BrandMatcherScanning'
import type { BrandMatcherPreviewResponse, BrandMatcherPreviewRow } from '@/app/sitematcher/types/brand-matcher'
import { AccountStep, TrialModal, type TrialGateCopy } from '@/components/trial/TrialModal'
import { LockIcon, SiteMatcherLogo, TRIAL_TOOLS, ToolIcon, type TrialTool } from '@/components/trial/trial-ui'

// The logged-out Brand Matcher preview (docs/design_handoff_homepage_trial, trial-01/02). The top
// rows show their signals with the brand blurred; the rest sit behind the inline sign-up card.
// The API sends no brand identities at all (api/public/brand-matcher/preview), so the blurred
// names and the locked rows are placeholders, not hidden data.

const TOOL_COPY: Record<TrialTool, string> = {
  Assess: 'Check the catchment and demographics around this site.',
  Gaps: 'See which towns each brand is missing from.',
  Sketch: 'Sketch a layout for this site in 2D or 3D.',
  Planning: 'Review planning history and applications for this site.',
  Directory: 'Browse verified live requirements from occupiers.',
}

// Placeholder rows behind the gate: shapes only.
const LOCKED_ROWS = 6

type Load =
  | { state: 'loading' }
  | { state: 'error'; message: string }
  | { state: 'ready'; data: BrandMatcherPreviewResponse; elapsedMs: number }

export function BrandMatcherPreview() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const search = useMemo(() => new URLSearchParams(searchParams?.toString() ?? ''), [searchParams])
  const { user } = useAuth()
  const site = useMemo(() => readSiteParams(search), [search])
  const [useClass, setUseClass] = useState<HomeUseClass>(site?.useClass ?? 'all')
  const [load, setLoad] = useState<Load>({ state: 'loading' })
  // The members' scanning screen plays until its steps finish, then the results show.
  const [scanned, setScanned] = useState(false)
  const finishScan = useCallback(() => setScanned(true), [])
  const [modal, setModal] = useState<null | { copy: TrialGateCopy; step: 'account' | 'card' }>(null)
  const plan = parseProPlan(search.get('plan'))

  useEffect(() => {
    if (!site?.sqft) return
    let cancelled = false
    const started = performance.now()
    setLoad({ state: 'loading' })
    setScanned(false)
    fetch('/api/public/brand-matcher/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ postcode: site.postcode, sqft: site.sqft }),
    })
      .then(async (res) => {
        const body = (await res.json().catch(() => null)) as (BrandMatcherPreviewResponse & { error?: string }) | null
        if (cancelled) return
        if (!res.ok || !body?.lists) setLoad({ state: 'error', message: body?.error ?? 'Something went wrong. Please try again.' })
        else setLoad({ state: 'ready', data: body, elapsedMs: performance.now() - started })
      })
      .catch(() => !cancelled && setLoad({ state: 'error', message: 'Something went wrong. Please try again.' }))
    return () => {
      cancelled = true
    }
  }, [site?.postcode, site?.sqft])

  // Back from Google / Microsoft sign-in: pick the flow up at the card step.
  const resumed = useRef(false)
  useEffect(() => {
    if (resumed.current || !user || search.get('trial') !== 'card') return
    resumed.current = true
    setModal({ copy: { title: '', body: '' }, step: 'card' })
  }, [user, search])

  const list = load.state === 'ready' ? load.data.lists[useClass] : null
  const total = list?.total ?? 0

  const gate = useCallback(
    (title: string, body: string) => setModal({ copy: { title, body }, step: 'account' }),
    []
  )
  const startTrial = () =>
    gate(
      `See all ${total} brands for this site`,
      'Start your free trial to unlock the full ranked list and contact details.'
    )
  const unlock = useCallback(() => {
    router.replace(workspaceHref(site ? { ...site, useClass } : null, { welcome: 'trial' }))
  }, [router, site, useClass])

  const signInHref = `/auth?mode=signin&returnUrl=${encodeURIComponent(`/brand-matcher?${search.toString()}`)}`

  return (
    <div className="flex h-screen flex-col bg-white">
      <div className="z-20 flex h-14 shrink-0 items-center justify-between border-b border-[#ECEAF0] bg-white px-5">
        <div className="flex items-center gap-3">
          <Link href="/" aria-label="SiteMatcher home">
            <SiteMatcherLogo />
          </Link>
          <span className="rounded-full border border-dashed border-[#DCD8E2] px-[9px] py-1 font-mono text-[11px] uppercase tracking-[0.8px] text-sm-ink3">
            Preview
          </span>
        </div>
        <div className="flex items-center gap-4 text-[14px]">
          {user ? (
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-sm-violet text-[14px] font-semibold text-white">
              {(user.email ?? '?')[0].toUpperCase()}
            </span>
          ) : (
            <Link href={signInHref} className="font-medium text-sm-ink2 hover:text-sm-ink">
              Sign in
            </Link>
          )}
          <button type="button" onClick={startTrial} className={BTN_V}>
            Start free trial
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        <PreviewRail onLocked={(tool) => gate(`${tool} is included in your trial`, `${TOOL_COPY[tool]} Start your free ${PRO_TRIAL_DAYS}-day trial to use it alongside Brand Matcher.`)} />

        <main className="relative min-w-0 flex-1 overflow-auto bg-[#FAFAFB]">
          {!site ? (
            <Notice title="Enter a site to see matching brands">
              <Link href="/" className="font-semibold text-sm-violet">
                Back to the homepage
              </Link>
            </Notice>
          ) : !site.sqft ? (
            <SizePrompt onSubmit={(sqft) => {
              const q = new URLSearchParams(search.toString())
              q.set('sqft', String(sqft))
              router.replace(`/brand-matcher?${q.toString()}`)
            }} />
          ) : load.state === 'error' ? (
            <Notice title={load.message}>
              <Link href="/" className="font-semibold text-sm-violet">
                Edit site
              </Link>
            </Notice>
          ) : !scanned ? (
            <BrandMatcherScanningView
              ready={load.state === 'ready'}
              count={load.state === 'ready' ? load.data.considered : null}
              sqft={site.sqft}
              useClass={toQueryUseClass(useClass)}
              postcode={site.postcode}
              onDone={finishScan}
              onCancel={() => router.push('/')}
            />
          ) : load.state === 'loading' ? null : (
            <>
              <PreviewHeader
                data={load.data}
                elapsedMs={load.elapsedMs}
                useClass={useClass}
                onUseClass={setUseClass}
                onExport={() =>
                  gate(`Export all ${total} brands`, 'Start your free trial to download the full list with contacts as a spreadsheet.')
                }
              />
              <div className="mx-auto max-w-[1480px] space-y-2.5 px-8 pb-20 pt-6 max-md:px-4">
                {list!.rows.map((r, i) => (
                  <PreviewRow
                    key={i}
                    row={r}
                    rank={i + 1}
                    onContact={() =>
                      gate(
                        'Contact this brand’s property team',
                        'Start your free trial to see each brand’s name and who handles their property, with phone and email.'
                      )
                    }
                  />
                ))}
                <div className="relative">
                  <div aria-hidden className="pointer-events-none select-none space-y-2.5 opacity-70 blur-[7px]">
                    {Array.from({ length: LOCKED_ROWS }, (_, i) => (
                      <PlaceholderRow key={i} rank={list!.rows.length + i + 1} />
                    ))}
                  </div>
                  <div className="absolute inset-0 flex items-start justify-center bg-[linear-gradient(to_bottom,rgba(250,250,251,0),rgba(250,250,251,.7)_120px)] px-2 pt-7">
                    <div className="sticky top-6 w-full max-w-[480px] rounded-[20px] border border-[#E3E0E8] bg-white p-[30px] shadow-[0_30px_70px_-30px_rgba(20,10,40,0.4)] max-sm:p-[22px]">
                      <AccountStep
                        copy={{
                          title:
                            total > list!.rows.length
                              ? `${total - list!.rows.length} more ${plural(total - list!.rows.length, 'brand')} match this site.`
                              : 'See who to call at each brand.',
                          body: 'Start your free 14-day trial to see the full ranking and contact the people who handle property at each brand.',
                        }}
                        plan={plan}
                        onDone={() => setModal({ copy: { title: '', body: '' }, step: 'card' })}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </main>
      </div>

      <TrialModal
        open={modal !== null}
        initialStep={modal?.step ?? 'account'}
        copy={modal?.copy}
        initialPlan={plan}
        unlockLabel={total > 0 ? `Unlocking all ${total} brands…` : 'Unlocking every tool…'}
        onClose={() => setModal(null)}
        onSuccess={unlock}
      />
    </div>
  )
}

function PreviewRail({ onLocked }: { onLocked: (tool: TrialTool) => void }) {
  return (
    <aside className="w-20 shrink-0 border-r border-[#ECEAF0] bg-white max-md:hidden">
      <div className="flex flex-col gap-1.5 px-1.5 py-3.5">
        <div className="flex flex-col items-center gap-1 rounded-[14px] bg-sm-ink py-2.5 text-[11.5px] font-medium text-white">
          <ToolIcon tool="Match" color="#fff" />
          Match
        </div>
        {TRIAL_TOOLS.map((tool) => (
          <button
            type="button"
            key={tool}
            onClick={() => onLocked(tool)}
            className="group relative flex flex-col items-center gap-1 rounded-[14px] py-2.5 text-[11.5px] font-medium text-sm-ink2 hover:bg-[#F5F3F8]"
          >
            <span className="relative flex opacity-40 transition-opacity group-hover:opacity-75">
              <ToolIcon tool={tool} color="#4A4451" />
            </span>
            <span className="absolute left-[48px] top-[26px] flex h-4 w-4 items-center justify-center rounded-full border-[1.5px] border-white bg-sm-violet-tint">
              <LockIcon color="#5421CC" size={9} />
            </span>
            <span className="opacity-40 transition-opacity group-hover:opacity-75">{tool}</span>
            <span className="pointer-events-none absolute left-[76px] top-1/2 z-50 -translate-y-1/2 whitespace-nowrap rounded-lg bg-sm-ink px-2.5 py-[7px] text-[12.5px] font-normal text-white opacity-0 transition-opacity group-hover:opacity-100">
              <b className="font-semibold">{tool}</b> · included in your trial
            </span>
          </button>
        ))}
      </div>
    </aside>
  )
}

function PreviewHeader({
  data,
  elapsedMs,
  useClass,
  onUseClass,
  onExport,
}: {
  data: BrandMatcherPreviewResponse
  elapsedMs: number
  useClass: HomeUseClass
  onUseClass: (uc: HomeUseClass) => void
  onExport: () => void
}) {
  const [open, setOpen] = useState(false)
  const total = data.lists[useClass].total
  const label = HOME_USE_CLASSES.find((u) => u.id === useClass)?.label ?? 'All use classes'

  useEffect(() => {
    if (!open) return
    const close = () => setOpen(false)
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [open])

  return (
    <header className="sticky top-0 z-10 border-b border-[#ECEAF0] bg-white/95 backdrop-blur">
      <div className="flex flex-wrap items-center justify-between gap-4 px-8 py-[22px] max-md:px-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <h1 className="text-[24px] font-bold tracking-[-0.4px] text-sm-ink">
              {total} {plural(total, 'brand')} matched
            </h1>
            <span className="rounded-md bg-[#E9F7EE] px-[7px] py-[3px] text-[12px] font-semibold text-[#2F855A]">
              in {(elapsedMs / 1000).toFixed(1)}s
            </span>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Chip>{formatSqft(data.sqft)} sq ft</Chip>
            <span className="relative">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setOpen(!open)
                }}
                aria-expanded={open}
                className="inline-flex items-center gap-1.5 rounded-full bg-sm-violet-tint px-3 py-1.5 text-[13px] font-medium text-sm-violet-deep"
              >
                {label}
                <ChevronDown size={12} />
              </button>
              {open && (
                <div
                  className="absolute left-0 top-[calc(100%+6px)] z-30 w-[220px] rounded-xl border border-[#E3E0E8] bg-white p-1.5 shadow-[0_18px_40px_-16px_rgba(20,10,40,0.25)]"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="px-2.5 py-1.5 font-mono text-[10.5px] uppercase tracking-[0.8px] text-sm-ink3">Use class</div>
                  {HOME_USE_CLASSES.map((u) => (
                    <button
                      type="button"
                      key={u.id}
                      onClick={() => {
                        onUseClass(u.id)
                        setOpen(false)
                      }}
                      className={
                        'flex w-full justify-between rounded-lg px-2.5 py-[9px] text-[14px] ' +
                        (u.id === useClass ? 'bg-sm-violet-tint font-semibold text-sm-violet-deep' : 'text-sm-ink hover:bg-sm-violet-tint-soft')
                      }
                    >
                      <span>{u.label}</span>
                      <span className="font-mono text-[12px] text-sm-ink3">{data.lists[u.id].total}</span>
                    </button>
                  ))}
                </div>
              )}
            </span>
            <Chip>{data.site.postcode}</Chip>
            {data.site.centre && <Chip>{data.site.centre}</Chip>}
            <Link
              href="/"
              className="rounded-full border border-[#E3E0E8] bg-white px-3 py-[5px] text-[13px] font-medium text-sm-ink hover:border-sm-border-hard"
            >
              Edit site
            </Link>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-10 rounded-xl border border-[#E3E0E8] bg-white px-4 py-[11px] text-[14px] text-sm-ink max-sm:hidden">
            Sort: Best match
            <ChevronDown size={12} className="text-sm-ink3" />
          </span>
          <button type="button" onClick={onExport} className={BTN_V}>
            <LockIcon color="#fff" />
            Export list
          </button>
        </div>
      </div>
      <div className="mx-auto max-w-[1480px] px-8">
        <div
          className={`hidden gap-3.5 whitespace-nowrap px-[22px] pb-2.5 text-[11px] font-bold uppercase tracking-[0.02em] text-[#8A8895] lg:grid ${PREVIEW_ROW_GRID}`}
        >
          <span />
          <span>Brand</span>
          <span className="grid grid-cols-5 gap-2.5 [&>span]:truncate">
            <span>Unit size</span>
            <span>Use class</span>
            <span>Acquisitive</span>
            <span>Demographics</span>
            <span>Nearest store</span>
          </span>
          <span>Turnover</span>
          <span className="text-right">Fit / 100</span>
          <span />
        </div>
      </div>
    </header>
  )
}

// Mirrors the member list's collapsed row (BrandMatchCard), with the brand hidden.
function PreviewRow({ row, rank, onContact }: { row: BrandMatcherPreviewRow; rank: number; onContact: () => void }) {
  const sub = [row.category, row.storeCount > 0 ? `${row.storeCount.toLocaleString('en-GB')} UK ${plural(row.storeCount, 'store')}` : null]
    .filter(Boolean)
    .join(' · ')
  return (
    <article
      className={
        'grid grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-3.5 rounded-2xl border border-[#E4E0F0] bg-white px-[22px] py-4 ' +
        PREVIEW_ROW_GRID
      }
    >
      <span
        aria-hidden
        className="flex h-11 w-11 select-none items-center justify-center rounded-[11px] bg-[#1F3A5F] text-[15px] font-bold text-white blur-[6px]"
      >
        {rank}
      </span>
      <div className="min-w-0">
        <h3 className="select-none truncate text-[17px] font-bold text-[#1C1B22] blur-[6px]" aria-label={`Brand ${rank}, hidden in preview`}>
          Brand name hidden
        </h3>
        {sub && <p className="mt-0.5 text-[13px] leading-snug text-[#8A8895]">{sub}</p>}
      </div>
      <div className="col-span-3 grid grid-cols-2 gap-2.5 sm:grid-cols-5 lg:col-span-1 lg:col-start-3 lg:row-start-1">
        {row.signals.map((s) => (
          <div key={s.key} className="min-w-0">
            <span className="mb-1 block text-[10.5px] font-bold uppercase tracking-[0.02em] text-[#8A8895] lg:hidden">
              {SIGNAL_LABEL[s.key]}
            </span>
            <SignalCell status={s.status} value={s.value} />
          </div>
        ))}
      </div>
      <span className={`hidden text-[13.5px] lg:block ${row.turnover ? 'font-semibold text-[#2A2833]' : 'text-[#8A8895]'}`}>
        {row.turnover ?? '—'}
      </span>
      <span className="col-start-3 row-start-1 whitespace-nowrap text-right lg:col-start-auto lg:row-start-auto">
        <span className="text-[24px] font-bold tabular-nums text-[#4B23C9]">{row.score}</span>
        <span className="text-[12px] font-semibold text-[#8A8895]">/100</span>
      </span>
      <div className="col-span-3 text-right lg:col-span-1">
        <button
          type="button"
          onClick={onContact}
          className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-[10px] bg-[#F1EEFA] px-3.5 py-[9px] text-[13px] font-bold text-[#4B23C9] transition-colors hover:bg-[#E6E0FA]"
        >
          <LockIcon color="#4B23C9" />
          Contact
        </button>
      </div>
    </article>
  )
}

function PlaceholderRow({ rank }: { rank: number }) {
  return (
    <div
      className={
        'grid grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-3.5 rounded-2xl border border-[#E4E0F0] bg-white px-[22px] py-4 ' +
        PREVIEW_ROW_GRID
      }
    >
      <span className="h-11 w-11 rounded-[11px] bg-[#D9D4E8]" />
      <div>
        <div className="text-[17px] font-bold text-[#1C1B22]">Brand {rank}</div>
        <div className="mt-0.5 text-[13px] text-[#8A8895]">Food &amp; beverage · 40 UK stores</div>
      </div>
      <div className="col-span-3 grid grid-cols-2 gap-2.5 sm:grid-cols-5 lg:col-span-1 lg:col-start-3 lg:row-start-1">
        {['Fits', 'Class E', 'High', 'Close', '12 mi'].map((v) => (
          <SignalCell key={v} status="good" value={v} />
        ))}
      </div>
      <span className="hidden text-[13.5px] font-semibold lg:block">£40m</span>
      <span className="col-start-3 row-start-1 text-right text-[24px] font-bold text-[#4B23C9] lg:col-start-auto lg:row-start-auto">78</span>
      <span className="col-span-3 text-right lg:col-span-1">
        <span className="rounded-[10px] bg-[#F1EEFA] px-3.5 py-[9px] text-[13px] font-bold text-[#4B23C9]">Contact</span>
      </span>
    </div>
  )
}

function Notice({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 px-6 text-center">
      <h1 className="text-[18px] font-semibold text-sm-ink">{title}</h1>
      {children && <div className="text-[14px]">{children}</div>}
    </div>
  )
}

function SizePrompt({ onSubmit }: { onSubmit: (sqft: number) => void }) {
  const [value, setValue] = useState('')
  const sqft = Number(value.replace(/[^0-9]/g, ''))
  return (
    <div className="flex min-h-[50vh] items-center justify-center px-6">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (sqft > 0) onSubmit(sqft)
        }}
        className="w-full max-w-[420px] rounded-[18px] border border-[#E3E0E8] bg-white p-7"
      >
        <h1 className="text-[20px] font-semibold tracking-[-0.02em] text-sm-ink">How big is the unit?</h1>
        <p className="mt-1.5 text-[14px] text-sm-ink2">Brands are ranked on the size they trade from, so we need it to match.</p>
        <div className="mt-4 flex gap-2">
          <label className="flex h-11 flex-1 items-center gap-1.5 rounded-[10px] border border-[#E3E0E8] px-3 focus-within:border-sm-violet">
            <input
              inputMode="numeric"
              autoFocus
              value={value}
              onChange={(e) => setValue(e.target.value.replace(/[^0-9,]/g, ''))}
              placeholder="Size"
              className="min-w-0 flex-1 text-[15px] outline-none"
            />
            <span className="text-[14px] text-sm-ink3">sq ft</span>
          </label>
          <button type="submit" className={BTN_V}>
            Find brands
          </button>
        </div>
      </form>
    </div>
  )
}

function Chip({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full bg-sm-violet-tint px-3 py-1.5 text-[13px] font-medium text-sm-violet-deep">{children}</span>
}

const BTN_V =
  'inline-flex items-center gap-2 whitespace-nowrap rounded-[10px] bg-sm-violet px-4 py-2.5 text-[14px] font-semibold text-white transition-colors hover:bg-sm-violet-deep'

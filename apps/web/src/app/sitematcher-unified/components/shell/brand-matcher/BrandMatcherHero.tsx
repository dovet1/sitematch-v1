'use client'

import { useEffect } from 'react'
import {
  ArrowRight,
  BarChart3,
  ChevronDown,
  Landmark,
  LayoutPanelLeft,
  MapPin,
  TrendingUp,
  AlertCircle,
} from 'lucide-react'
import { useBrandMatcherStore } from '../../../lib/stores/brand-matcher-store'
import { formatSqft, classLabel } from '../../../lib/brand-matcher'
import { BRAND_MATCHER_USE_CLASSES, type BrandMatcherUseClass } from '../../../types/brand-matcher'
import { Kicker } from './BrandMatcherUi'

// Dot field behind the hero headline, faded out towards the edges.
const DOT_FIELD: React.CSSProperties = {
  backgroundImage: 'radial-gradient(circle, rgba(112,51,255,0.28) 1.1px, transparent 1.6px)',
  backgroundSize: '26px 26px',
  maskImage: 'radial-gradient(ellipse 46% 60% at 50% 45%, #000 20%, transparent 75%)',
  WebkitMaskImage: 'radial-gradient(ellipse 46% 60% at 50% 45%, #000 20%, transparent 75%)',
}

export function BrandMatcherHero() {
  const form = useBrandMatcherStore((s) => s.form)
  const error = useBrandMatcherStore((s) => s.error)
  const brandsTracked = useBrandMatcherStore((s) => s.brandsTracked)
  const setForm = useBrandMatcherStore((s) => s.setForm)
  const run = useBrandMatcherStore((s) => s.run)
  const loadStats = useBrandMatcherStore((s) => s.loadStats)

  useEffect(() => loadStats(), [loadStats])

  const sqftNumber = Number(form.sqft.replace(/[,\s]/g, ''))
  const sqftText = Number.isFinite(sqftNumber) && sqftNumber > 0 ? `${formatSqft(sqftNumber)} sq ft` : 'unit'

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    void run()
  }

  return (
    <div>
      <section className="relative overflow-hidden border-b border-sm-border bg-[linear-gradient(180deg,#F5F1FF_0%,#FBFAF7_100%)] px-6 pb-16 pt-20">
        <div aria-hidden className="pointer-events-none absolute inset-0" style={DOT_FIELD} />
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-24 h-[420px] w-[520px] -translate-x-1/2 rounded-full border border-sm-violet/10"
        />

        <div className="relative mx-auto max-w-[940px] text-center">
          <span className="text-[12px] font-bold uppercase tracking-[0.24em] text-sm-violet">
            Site → Brands
          </span>
          <h1 className="mt-5 text-[44px] font-bold leading-[1.02] tracking-[-0.03em] text-sm-ink md:text-[64px]">
            Got an empty unit?
            <span className="block text-sm-violet">Meet the brands who want it.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-[620px] text-[16.5px] leading-relaxed text-sm-ink2">
            Tell us the size, use class and location. We&apos;ll rank the brands most likely to
            sign — with the evidence, and who to call.
          </p>

          <form
            onSubmit={submit}
            className="mx-auto mt-10 max-w-[900px] rounded-[22px] border border-sm-border bg-sm-surface p-5 text-left shadow-[0_24px_60px_-28px_rgba(84,33,204,0.35)]"
          >
            <div className="grid gap-3 md:grid-cols-3">
              <label className="block rounded-xl border border-sm-border px-4 py-3 focus-within:border-sm-violet">
                <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-sm-ink3">
                  Size
                </span>
                <span className="mt-1 flex items-baseline gap-1.5">
                  <input
                    inputMode="numeric"
                    placeholder="14,000"
                    value={form.sqft}
                    onChange={(e) => setForm({ sqft: e.target.value })}
                    className="w-full min-w-0 bg-transparent text-[22px] font-semibold text-sm-ink outline-none placeholder:text-sm-ink4"
                    aria-label="Unit size in square feet"
                  />
                  <span className="text-[13px] text-sm-ink3">sq ft</span>
                </span>
              </label>

              <label className="relative block rounded-xl border border-sm-border px-4 py-3 focus-within:border-sm-violet">
                <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-sm-ink3">
                  Use class
                </span>
                <select
                  value={form.useClass}
                  onChange={(e) => setForm({ useClass: e.target.value as BrandMatcherUseClass })}
                  className="mt-1 w-full appearance-none bg-transparent pr-6 text-[22px] font-semibold text-sm-ink outline-none"
                  aria-label="Use class"
                >
                  {BRAND_MATCHER_USE_CLASSES.map((c) => (
                    <option key={c} value={c}>
                      {classLabel(c)}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={16}
                  className="pointer-events-none absolute bottom-5 right-4 text-sm-ink3"
                />
              </label>

              <label className="block rounded-xl border border-sm-border px-4 py-3 focus-within:border-sm-violet">
                <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-sm-ink3">
                  Location
                </span>
                <span className="mt-1 flex items-center gap-2">
                  <MapPin size={16} className="flex-shrink-0 text-sm-violet" />
                  <input
                    placeholder="LS6 2AT"
                    value={form.postcode}
                    onChange={(e) => setForm({ postcode: e.target.value.toUpperCase() })}
                    autoComplete="postal-code"
                    className="w-full min-w-0 bg-transparent text-[22px] font-semibold text-sm-ink outline-none placeholder:text-sm-ink4"
                    aria-label="Site postcode"
                  />
                </span>
              </label>
            </div>

            {error && (
              <div
                role="alert"
                className="mt-3 flex items-center gap-2 rounded-lg bg-[#FDF3F3] px-3 py-2 text-[13px] text-[#C0453F]"
              >
                <AlertCircle size={15} />
                {error}
              </div>
            )}

            <button
              type="submit"
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-sm-violet py-4 text-[16px] font-semibold text-white transition-colors hover:bg-sm-violet-deep"
            >
              Match brands
              <ArrowRight size={18} />
            </button>
          </form>

          <p className="mt-6 text-[13px] font-medium text-sm-ink3">
            {brandsTracked != null && `${brandsTracked.toLocaleString('en-GB')} brands tracked · `}
            From live requirements, measured store estates and planning
          </p>
        </div>
      </section>

      <section className="bg-sm-surface px-6 py-16">
        <div className="mx-auto max-w-[1240px]">
          <div className="text-center">
            <Kicker>How we rank</Kicker>
            <h2 className="mt-3 text-[30px] font-bold tracking-[-0.02em] text-sm-ink">
              Five signals behind every match
            </h2>
            <p className="mx-auto mt-2 max-w-[720px] text-[14.5px] leading-relaxed text-sm-ink2">
              We combine your site&apos;s specs with what we track about each brand — so the
              ranking is explainable, not a black box.
            </p>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <SignalCard
              icon={<LayoutPanelLeft size={17} />}
              tint="bg-sm-violet-tint text-sm-violet"
              title="Site-size fit"
            >
              Does the brand&apos;s average unit size fit your {sqftText}? We match against their
              typical footprint.
            </SignalCard>
            <SignalCard
              icon={<TrendingUp size={17} />}
              tint="bg-[#FDF0DC] text-[#B7860B]"
              title="Acquisitive signals"
            >
              Are they actively growing? Blended from advertised requirements, news articles and
              planning activity.
            </SignalCard>
            <SignalCard
              icon={<Landmark size={17} />}
              tint="bg-[#EAF8F1] text-[#177E4E]"
              title="Published trading facts"
              badge="Coming soon"
            >
              Turnover, net assets, filing history and company status, taken straight from
              Companies House. We show the figures as filed — we don&apos;t rate, grade or score a
              company.
            </SignalCard>
            <SignalCard
              icon={<BarChart3 size={17} />}
              tint="bg-sm-violet-tint text-sm-violet"
              title="Already trades in your type of location"
            >
              We work out whether your site is in a retail park, high street or shopping centre,
              and count the ones nearby the brand already trades in — proof the format works for
              them.
            </SignalCard>
            <SignalCard
              icon={<MapPin size={17} />}
              tint="bg-sm-violet-tint text-sm-violet"
              title="Distance to nearest store"
            >
              How far is their closest branch? A gap near your site is a strong reason for them to
              take it.
            </SignalCard>
            <div className="flex flex-col justify-center rounded-2xl bg-[linear-gradient(135deg,#7033FF_0%,#5421CC_100%)] p-6 text-white">
              <h3 className="text-[20px] font-bold leading-snug">
                Every match comes with the receipts
              </h3>
              <p className="mt-2 text-[14px] leading-relaxed text-white/85">
                Expand any brand to see the exact evidence — and the acquisitions contact to call.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

function SignalCard({
  icon,
  tint,
  title,
  badge,
  children,
}: {
  icon: React.ReactNode
  tint: string
  title: string
  badge?: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-2xl border border-sm-border bg-sm-surface p-6">
      <div className="flex items-start justify-between">
        <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${tint}`}>{icon}</span>
        {badge && (
          <span className="rounded-full bg-sm-border-soft px-2.5 py-1 text-[10.5px] font-semibold text-sm-ink3">
            {badge}
          </span>
        )}
      </div>
      <h3 className="mt-5 text-[16px] font-semibold text-sm-ink">{title}</h3>
      <p className="mt-1.5 text-[13.5px] leading-relaxed text-sm-ink2">{children}</p>
    </div>
  )
}

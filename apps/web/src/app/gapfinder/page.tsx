'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { ArrowRight, BarChart3, Download, Layers3, Map, MapPinned, MonitorUp, Search, Sparkles } from 'lucide-react'
import { isGapFinderViewportSupported } from './viewport'
import { Button } from '@/components/ui/button'
import { PaywallModal } from '@/components/PaywallModal'
import { TrialSignupModal } from '@/components/TrialSignupModal'
import { useAuth } from '@/contexts/auth-context'
import { useSubscriptionAccess } from '@/hooks/useSubscriptionAccess'
import { SummerSaleBanner } from '@/components/gapfinder/SummerSaleBanner'
import { GapFinderHero } from '@/components/gapfinder/GapFinderHero'
import { GapFinderProductShowcase } from '@/components/gapfinder/GapFinderProductShowcase'
import { GapFinderVideoSection } from '@/components/gapfinder/GapFinderVideoSection'
import { GapFinderPricing } from '@/components/gapfinder/GapFinderPricing'

const GapFinderClient = dynamic(() => import('./GapFinderClient'), {
  ssr: false,
  loading: () => <GapFinderLoading />,
})

type ViewportState = 'unknown' | 'supported' | 'unsupported'

function useGapFinderViewportState() {
  const [viewportState, setViewportState] = useState<ViewportState>('unknown')

  useEffect(() => {
    const updateViewportState = () => {
      setViewportState(
        isGapFinderViewportSupported(window.innerWidth) ? 'supported' : 'unsupported'
      )
    }

    updateViewportState()
    window.addEventListener('resize', updateViewportState)

    return () => {
      window.removeEventListener('resize', updateViewportState)
    }
  }, [])

  return viewportState
}

function GapFinderLoading() {
  return (
    <div className="flex h-screen items-center justify-center bg-background">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-violet-200 border-t-violet-600" />
    </div>
  )
}

function GapFinderMobileUnavailable() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-white to-violet-50 px-6">
      <section className="w-full max-w-md text-center">
        <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-100 text-violet-700">
          <MonitorUp className="h-7 w-7" aria-hidden="true" />
        </div>
        <h1 className="text-2xl font-semibold text-gray-950">
          GapFinder works best on a larger screen
        </h1>
        <p className="mt-3 text-base text-gray-600">
          Please try again on desktop or tablet.
        </p>
        <Link
          href="/"
          className="mt-8 inline-flex h-10 items-center justify-center rounded-md bg-violet-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2"
        >
          Back to homepage
        </Link>
      </section>
    </main>
  )
}

const features = [
  {
    icon: BarChart3,
    title: 'Filter markets by population',
    description: 'Build a focused list of built-up areas that match your target catchment size.'
  },
  {
    icon: Layers3,
    title: 'Analyse brand and category gaps',
    description: 'See where operators are present, absent, nearby or missing across comparable places.'
  },
  {
    icon: MapPinned,
    title: 'Check neighbouring operators',
    description: 'Drop a point, review nearby fascias and understand the competitive context around a site.'
  },
  {
    icon: Search,
    title: 'Compare requirement locations',
    description: 'Overlay occupier requirements, switch between brands and compare areas side by side.'
  },
  {
    icon: Download,
    title: 'Export evidence for reports',
    description: 'Take CSV outputs into client decks, acquisition packs or internal opportunity reviews.'
  },
  {
    icon: Map,
    title: 'Map-based visualization',
    description: 'See all locations at a glance with an interactive map showing retail coverage and gaps.'
  }
]

function GapFinderLandingPage({ isLoggedIn }: { isLoggedIn: boolean }) {
  const renderPrimaryCta = () => {
    const primaryButton = (
      <Button className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white px-8 py-5 text-base md:text-lg font-black rounded-2xl shadow-2xl hover:shadow-violet-500/50 hover:scale-105 transition-all duration-300">
        <Sparkles className="mr-2 h-5 w-5" aria-hidden="true" />
        Start Free Trial - 50% Off
        <ArrowRight className="ml-2 h-5 w-5" aria-hidden="true" />
      </Button>
    )

    return isLoggedIn ? (
      <PaywallModal context="gapfinder" redirectTo="/gapfinder">
        {primaryButton}
      </PaywallModal>
    ) : (
      <TrialSignupModal context="gapfinder" redirectPath="/gapfinder">
        {primaryButton}
      </TrialSignupModal>
    )
  }

  return (
    <main className="min-h-screen bg-white text-gray-950">
      <SummerSaleBanner />
      <GapFinderHero isLoggedIn={isLoggedIn} />
      <GapFinderProductShowcase />
      <GapFinderVideoSection />

      {/* Enhanced Features Grid */}
      <section className="relative py-16 md:py-24 bg-white overflow-hidden">
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12 md:mb-16">
            <h2 className="text-3xl md:text-5xl font-black text-gray-900 mb-4">
              Everything you need to spot opportunities
            </h2>
            <p className="text-xl md:text-2xl text-gray-700 font-medium max-w-3xl mx-auto">
              GapFinder brings market filtering, operator coverage and location comparison into a single map-led tool
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <article
                key={feature.title}
                className="group relative rounded-3xl border-3 border-gray-200 bg-white p-6 md:p-8 shadow-lg hover:shadow-2xl hover:scale-105 transition-all duration-300"
              >
                <div className="absolute top-0 left-0 w-2 h-full bg-gradient-to-b from-violet-500 to-purple-600 rounded-l-3xl" />

                <div className="relative mb-5 flex h-16 w-16 md:h-20 md:w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 shadow-xl group-hover:scale-110 group-hover:rotate-3 transition-all duration-300">
                  <feature.icon className="h-8 w-8 md:h-10 md:w-10 text-white" aria-hidden="true" />
                </div>

                <h3 className="text-xl md:text-2xl font-black text-gray-950 mb-3">{feature.title}</h3>
                <p className="text-base md:text-lg leading-relaxed text-gray-600 font-medium">{feature.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <GapFinderPricing isLoggedIn={isLoggedIn} />

      {/* Enhanced Final CTA */}
      <section className="relative bg-gray-950 px-6 py-16 md:py-20 text-white overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-10 right-10 w-96 h-96 bg-violet-500/20 rounded-full blur-3xl" />
          <div className="absolute bottom-10 left-10 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl" />
        </div>

        <div className="relative mx-auto flex max-w-7xl flex-col items-center justify-center gap-8 text-center">
          <div className="max-w-3xl">
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-black mb-4">
              Start finding opportunities today
            </h2>
            <p className="text-lg md:text-xl leading-8 text-white/80 font-medium mb-2">
              Join 1,400+ property professionals using SiteMatcher tools
            </p>
            <p className="text-base md:text-lg text-violet-300 font-bold">
              Limited Time: 50% Off - Save £490/year
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-4">
            {renderPrimaryCta()}
            <Button
              asChild
              variant="outline"
              className="border-3 border-white/30 bg-transparent hover:bg-white hover:text-gray-950 px-8 py-5 text-base md:text-lg font-black rounded-2xl transition-all duration-300"
            >
              <a href="#pricing">View Full Pricing</a>
            </Button>
          </div>

          <p className="text-sm md:text-base text-white/70 font-medium">
            30-day free trial • No credit card required • Cancel anytime
          </p>
        </div>
      </section>
    </main>
  )
}

export default function GapFinderPage() {
  const { user, loading: authLoading } = useAuth()
  const { hasAccess, loading: subscriptionLoading } = useSubscriptionAccess()
  const viewportState = useGapFinderViewportState()

  if (authLoading || subscriptionLoading) {
    return <GapFinderLoading />
  }

  if (!user || !hasAccess) {
    return <GapFinderLandingPage isLoggedIn={Boolean(user)} />
  }

  if (viewportState === 'unknown') {
    return <GapFinderLoading />
  }

  if (viewportState === 'unsupported') {
    return <GapFinderMobileUnavailable />
  }

  return <GapFinderClient />
}

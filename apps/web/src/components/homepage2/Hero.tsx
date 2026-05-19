'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { TrialSignupModal } from '@/components/TrialSignupModal';
import { AlreadySubscribedModal } from '@/components/AlreadySubscribedModal';
import { useAuth } from '@/contexts/auth-context';
import Link from 'next/link';
import { Loader2, PenTool, Mail } from 'lucide-react';

export function Hero() {
  const { user, profile } = useAuth();
  const [isLoadingCheckout, setIsLoadingCheckout] = useState(false);
  const [showAlreadySubscribed, setShowAlreadySubscribed] = useState(false);

  // YouTube video ID for demo
  const DEMO_VIDEO_ID = 'KBOKzYEdPm0';

  // Check if user has active subscription directly from profile
  const hasSubscription = profile?.subscription_status === 'active' || profile?.subscription_status === 'trialing';

  const handleProCheckout = async () => {
    if (!user) return;

    // First check if user is already subscribed
    if (hasSubscription) {
      setShowAlreadySubscribed(true);
      return;
    }

    setIsLoadingCheckout(true);
    try {
      const response = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.id,
          userType: 'search',
          redirectPath: '/search'
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.hasAccess) {
          setShowAlreadySubscribed(true);
          setIsLoadingCheckout(false);
          return;
        }

        console.error('Checkout session error:', data);
        throw new Error(data.details || data.error || 'Failed to create checkout session');
      }

      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error('Error creating checkout session:', error);
      setIsLoadingCheckout(false);
    }
  };

  return (
    <section className="relative bg-gradient-to-br from-violet-50 via-purple-50 to-blue-50 py-8 md:py-12 lg:py-14 overflow-hidden min-h-[calc(100vh-64px)] flex items-center">
      {/* Background decoration - Enhanced */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-10 right-10 w-[500px] h-[500px] bg-violet-300/30 rounded-full blur-3xl" />
        <div className="absolute bottom-10 left-10 w-[500px] h-[500px] bg-purple-300/30 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-blue-200/20 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
          {/* Left: Content */}
          <div className="text-center lg:text-left">
            {/* Main headline */}
            <h1 className="text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-black text-gray-900 mb-4 md:mb-5 leading-tight">
              Connecting commercial property professionals across the UK
            </h1>

            {/* Subheadline - Bolder */}
            <p className="text-lg md:text-xl lg:text-2xl text-gray-700 font-semibold mb-5 md:mb-6 leading-relaxed max-w-2xl mx-auto lg:mx-0">
              Identify expansion opportunities with GapFinder, browse a continually verified directory of live requirements, and connect directly with the people ready to act on them.
            </p>

            {/* CTAs - Bold gradient buttons */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start">
              {user ? (
                hasSubscription ? (
                  <Button
                    asChild
                    size="lg"
                    className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white px-8 py-5 text-base md:text-lg font-black rounded-2xl shadow-2xl hover:shadow-violet-500/50 hover:scale-105 transition-all duration-300"
                  >
                    <Link href="/search">Explore requirements</Link>
                  </Button>
                ) : (
                  <Button
                    asChild
                    size="lg"
                    className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white px-8 py-5 text-base md:text-lg font-black rounded-2xl shadow-2xl hover:shadow-violet-500/50 hover:scale-105 transition-all duration-300"
                  >
                    <Link href="/pricing">Ready to find your next opportunity?</Link>
                  </Button>
                )
              ) : (
                <TrialSignupModal context="search" redirectPath="/search">
                  <Button size="lg" className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white px-8 py-5 text-base md:text-lg font-black rounded-2xl shadow-2xl hover:shadow-violet-500/50 hover:scale-105 transition-all duration-300">
                    Ready to find your next opportunity?
                  </Button>
                </TrialSignupModal>
              )}
            </div>

            {/* Secondary CTA for occupiers - Mobile: simple button */}
            <div className="mt-5 md:mt-6 sm:hidden">
              <div className="inline-flex flex-col items-center gap-3 px-6 py-4 bg-gradient-to-r from-orange-100 to-amber-100 rounded-2xl border-2 border-orange-300 shadow-lg hover:shadow-xl transition-shadow duration-300">
                <p className="text-sm md:text-base font-bold text-gray-700 text-center">
                  Looking to buy or lease a site?
                </p>

                {user ? (
                  <Link
                    href="/occupier/create-listing-quick"
                    className="text-sm md:text-base font-black text-orange-600 hover:text-orange-700 transition-colors flex items-center gap-1"
                  >
                    Post for free
                    <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                ) : (
                  <Link
                    href="/auth?mode=signin&returnUrl=%2Foccupier%2Fcreate-listing-quick"
                    className="text-sm md:text-base font-black text-orange-600 hover:text-orange-700 transition-colors flex items-center gap-1"
                  >
                    Post for free
                    <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                )}
              </div>
            </div>

            {/* Secondary CTA for occupiers - Desktop: card design */}
            <div className="mt-6 md:mt-8 hidden sm:block">
              <div className="inline-block">
                {/* Headline */}
                <div className="text-center mb-4">
                  <span className="text-xs md:text-sm font-bold text-gray-600">
                    Looking to buy or lease a site?
                  </span>
                </div>

                {/* Two mini-cards */}
                <div className="grid grid-cols-2 gap-4">
                  {/* Option 1: Post yourself */}
                  <div className="group relative bg-gradient-to-br from-violet-50 to-purple-50 rounded-2xl p-5 border-2 border-violet-300 hover:border-violet-400 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer overflow-hidden">
                    {/* Decorative accent */}
                    <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-violet-300/30 to-transparent rounded-bl-full"></div>

                    <div className="relative">
                      {/* Icon */}
                      <div className="w-12 h-12 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl flex items-center justify-center mb-3 shadow-lg group-hover:scale-110 group-hover:rotate-3 transition-all duration-300">
                        <PenTool className="w-6 h-6 text-white" />
                      </div>

                      {/* Text */}
                      <h3 className="text-base font-black text-gray-900 mb-1">
                        Post for free
                      </h3>
                      <p className="text-xs text-gray-600 font-medium mb-3">
                        Quick form in under 2 mins
                      </p>

                      {/* CTA Link */}
                      {user ? (
                        <Link
                          href="/occupier/create-listing-quick"
                          className="inline-flex items-center gap-1 text-xs font-bold text-violet-600 hover:text-violet-700"
                        >
                          Get started
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                          </svg>
                        </Link>
                      ) : (
                        <Link
                          href="/auth?mode=signin&returnUrl=%2Foccupier%2Fcreate-listing-quick"
                          className="inline-flex items-center gap-1 text-xs font-bold text-violet-600 hover:text-violet-700"
                        >
                          Get started
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                          </svg>
                        </Link>
                      )}
                    </div>
                  </div>

                  {/* Option 2: Email us */}
                  <div className="group relative bg-gradient-to-br from-blue-50 to-cyan-50 rounded-2xl p-5 border-2 border-blue-300 hover:border-blue-400 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer overflow-hidden">
                    {/* Decorative accent */}
                    <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-blue-300/30 to-transparent rounded-bl-full"></div>

                    <div className="relative">
                      {/* Icon */}
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-xl flex items-center justify-center mb-3 shadow-lg group-hover:scale-110 group-hover:rotate-3 transition-all duration-300">
                        <Mail className="w-6 h-6 text-white" />
                      </div>

                      {/* Text */}
                      <h3 className="text-base font-black text-gray-900 mb-1">
                        Email us - free
                      </h3>
                      <p className="text-xs text-gray-600 font-medium mb-3">
                        We'll post for you
                      </p>

                      {/* CTA Link */}
                      <a
                        href="mailto:rob@sitematcher.co.uk?subject=Site%20Requirement"
                        className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-700"
                      >
                        Email rob@sitematcher.co.uk
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                        </svg>
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Product demo video */}
          <div className="relative mt-6 lg:mt-0 lg:-translate-y-24 xl:-translate-y-28">
            {/* Decorative accent behind video */}
            <div className="absolute top-4 right-4 w-full h-full bg-gradient-to-br from-violet-200 to-purple-200 rounded-3xl transform rotate-3"></div>

            <div className="relative bg-white rounded-3xl shadow-2xl p-3 md:p-4 border-4 border-violet-200 transform hover:scale-[1.02] transition-transform duration-500">
              <div className="aspect-video rounded-2xl overflow-hidden bg-slate-950 ring-2 ring-violet-100">
                <iframe
                  src={`https://www.youtube.com/embed/${DEMO_VIDEO_ID}?rel=0&modestbranding=1`}
                  title="SiteMatcher product demo"
                  className="w-full h-full"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Already Subscribed Modal */}
      {showAlreadySubscribed && (
        <AlreadySubscribedModal
          open={showAlreadySubscribed}
          onClose={() => setShowAlreadySubscribed(false)}
          subscriptionStatus="active"
        />
      )}

    </section>
  );
}

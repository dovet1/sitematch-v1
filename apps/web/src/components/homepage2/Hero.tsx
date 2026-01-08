'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { TrialSignupModal } from '@/components/TrialSignupModal';
import { AuthChoiceModal } from '@/components/auth/auth-choice-modal';
import { AlreadySubscribedModal } from '@/components/AlreadySubscribedModal';
import { useAuth } from '@/contexts/auth-context';
import Link from 'next/link';
import { Loader2, PenTool, Mail } from 'lucide-react';

export function Hero() {
  const { user } = useAuth();
  const [isLoadingCheckout, setIsLoadingCheckout] = useState(false);
  const [subscriptionStatus, setSubscriptionStatus] = useState<'active' | 'trialing' | null>(null);
  const [showAlreadySubscribed, setShowAlreadySubscribed] = useState(false);

  // Fetch subscription status when component mounts and user is logged in
  useEffect(() => {
    const fetchSubscriptionStatus = async () => {
      if (!user?.id) {
        setSubscriptionStatus(null);
        return;
      }

      try {
        const response = await fetch('/api/user/subscription-status');
        if (response.ok) {
          const data = await response.json();
          setSubscriptionStatus(data.subscriptionStatus);
        }
      } catch (error) {
        console.error('Error fetching subscription status:', error);
      }
    };

    fetchSubscriptionStatus();
  }, [user?.id]);

  const handleProCheckout = async () => {
    if (!user) return;

    // First check if user is already subscribed
    if (subscriptionStatus === 'active' || subscriptionStatus === 'trialing') {
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
        if (data.subscriptionStatus === 'active' || data.subscriptionStatus === 'trialing') {
          setSubscriptionStatus(data.subscriptionStatus);
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
            {/* Social proof badge - Bold */}
            <div className="inline-flex items-center gap-2 px-4 py-2.5 bg-violet-100 rounded-full border-2 border-violet-300 mb-4 md:mb-5 transform rotate-[-0.5deg] shadow-md">
              <svg className="w-5 h-5 text-violet-600" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              <span className="text-sm md:text-base font-bold text-violet-700 uppercase tracking-wide">Over 1,400 property professionals</span>
            </div>

            {/* Main headline - Bold with highlighted text */}
            <h1 className="text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-black text-gray-900 mb-4 md:mb-5 leading-tight">
              Connect your sites with verified companies{' '}
              <span className="relative inline-block">
                <span className="relative z-10 text-gray-900">actively seeking their next location</span>
                <span className="absolute inset-0 bg-violet-200 transform skew-y-1 rotate-1"></span>
              </span>
            </h1>

            {/* Subheadline - Bolder */}
            <p className="text-lg md:text-xl lg:text-2xl text-gray-700 font-semibold mb-5 md:mb-6 leading-relaxed max-w-2xl mx-auto lg:mx-0">
              Access a curated directory of verified property requirements. Match your sites with qualified companies ready to commit.
            </p>

            {/* CTAs - Bold gradient buttons */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start">
              {user ? (
                subscriptionStatus === 'active' || subscriptionStatus === 'trialing' ? (
                  <Button
                    asChild
                    size="lg"
                    className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white px-8 py-5 text-base md:text-lg font-black rounded-2xl shadow-2xl hover:shadow-violet-500/50 hover:scale-105 transition-all duration-300"
                  >
                    <Link href="/search">Explore requirements</Link>
                  </Button>
                ) : (
                  <>
                    <Button
                      asChild
                      size="lg"
                      className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white px-8 py-5 text-base md:text-lg font-black rounded-2xl shadow-2xl hover:shadow-violet-500/50 hover:scale-105 transition-all duration-300"
                    >
                      <Link href="/pricing">Start Free Trial</Link>
                    </Button>
                    <Button
                      asChild
                      size="lg"
                      variant="outline"
                      className="border-3 border-violet-300 hover:border-violet-400 hover:bg-violet-50 px-8 py-5 text-base md:text-lg font-black rounded-2xl hover:shadow-xl transition-all duration-300"
                    >
                      <Link href="/pricing">View Pricing</Link>
                    </Button>
                  </>
                )
              ) : (
                <>
                  <TrialSignupModal context="search" redirectPath="/search">
                    <Button size="lg" className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white px-8 py-5 text-base md:text-lg font-black rounded-2xl shadow-2xl hover:shadow-violet-500/50 hover:scale-105 transition-all duration-300">
                      Start Free Trial
                    </Button>
                  </TrialSignupModal>
                  <Button
                    asChild
                    size="lg"
                    variant="outline"
                    className="border-3 border-violet-300 hover:border-violet-400 hover:bg-violet-50 px-8 py-5 text-base md:text-lg font-black rounded-2xl hover:shadow-xl transition-all duration-300"
                  >
                    <Link href="/pricing">View Pricing</Link>
                  </Button>
                </>
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
                  <AuthChoiceModal
                    redirectTo="/occupier/create-listing-quick"
                    title="Sign in to post requirements"
                    description="Access your account to create and manage property listings"
                  >
                    <button className="text-sm md:text-base font-black text-orange-600 hover:text-orange-700 transition-colors flex items-center gap-1">
                      Post for free
                      <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </AuthChoiceModal>
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
                        <AuthChoiceModal
                          redirectTo="/occupier/create-listing-quick"
                          title="Sign in to post requirements"
                          description="Access your account to create and manage property listings"
                        >
                          <button className="inline-flex items-center gap-1 text-xs font-bold text-violet-600 hover:text-violet-700">
                            Get started
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                            </svg>
                          </button>
                        </AuthChoiceModal>
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

          {/* Right: Product screenshot/demo - Enhanced */}
          <div className="relative mt-6 lg:mt-0">
            {/* Decorative accent behind screenshot */}
            <div className="absolute top-4 right-4 w-full h-full bg-gradient-to-br from-violet-200 to-purple-200 rounded-3xl transform rotate-3"></div>

            <div className="relative bg-white rounded-3xl shadow-2xl p-3 md:p-4 border-4 border-violet-200 transform hover:scale-[1.02] transition-transform duration-500">
              <div className="aspect-[16/10] md:aspect-[4/3] rounded-2xl overflow-hidden bg-slate-50 ring-2 ring-violet-100">
                <img
                  src="/map-screenshot.png"
                  alt="SiteMatcher requirement map showing distribution across UK and Ireland"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    // Fallback if image fails to load
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                    console.error('Failed to load map screenshot');
                  }}
                />
              </div>
            </div>

            {/* Floating stats cards - Enhanced and bold */}
            <div className="hidden md:block absolute -bottom-8 -left-8 bg-white rounded-2xl shadow-2xl p-5 border-3 border-green-200 hover:scale-110 transition-transform duration-300">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-gradient-to-br from-green-400 to-emerald-500 rounded-2xl flex items-center justify-center shadow-lg">
                  <svg className="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
                <div>
                  <p className="text-3xl font-black text-gray-900">7,500+</p>
                  <p className="text-sm font-bold text-gray-600">Active Requirements</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Already Subscribed Modal */}
      {subscriptionStatus && (
        <AlreadySubscribedModal
          open={showAlreadySubscribed}
          onClose={() => setShowAlreadySubscribed(false)}
          subscriptionStatus={subscriptionStatus}
        />
      )}
    </section>
  );
}

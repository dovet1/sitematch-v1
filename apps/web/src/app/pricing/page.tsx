'use client';

import { useState, useEffect } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TrialSignupModal } from '@/components/TrialSignupModal';
import { AuthChoiceModal } from '@/components/auth/auth-choice-modal';
import { AlreadySubscribedModal } from '@/components/AlreadySubscribedModal';
import { useAuth } from '@/contexts/auth-context';
import Link from 'next/link';
import { Footer } from '@/components/homepage2/Footer';

export default function PricingPage() {
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
        // Check subscription status from user profile
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

    // First check if user is already subscribed (use cached status or fetch)
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
        // Check if user is already subscribed
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
  const plans = [
    {
      name: 'Free',
      price: '£0',
      period: '',
      description: 'Perfect for occupiers',
      features: [
        'Post and manage unlimited requirements',
        'Access to our agency directory',
      ],
      cta: 'Get Started',
      highlighted: false,
      isFree: true,
    },
    {
      name: 'Pro',
      price: '£487.50',
      originalPrice: '£975',
      period: '/year',
      description: 'For property professionals',
      features: [
        'Everything in Free',
        'Browse 1000s of verified requirements',
        'SiteSketcher access',
        'Create an agency profile',
      ],
      cta: 'Start Free Trial',
      highlighted: true,
      badge: '50% Off - Limited Time',
      isFree: false,
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-white">
      <section className="py-24">
        <div className="max-w-7xl mx-auto px-6">
          {/* Header */}
          <div className="text-center mb-16">
            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
              Simple, transparent pricing
            </h1>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Start with Free, upgrade to Pro when you're ready. 30-day free trial on Pro.
            </p>
          </div>

          {/* Pricing Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`relative rounded-3xl p-8 ${
                  plan.highlighted
                    ? 'bg-gradient-to-br from-violet-600 to-purple-700 text-white border-4 border-violet-400 shadow-2xl scale-105'
                    : 'bg-white border-2 border-gray-200'
                }`}
              >
                {/* Badge */}
                {plan.badge && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <span className="bg-orange-500 text-white px-4 py-1 rounded-full text-sm font-semibold whitespace-nowrap">
                      {plan.badge}
                    </span>
                  </div>
                )}

                {/* Plan name */}
                <h3 className={`text-2xl font-bold mb-2 ${plan.highlighted ? 'text-white' : 'text-gray-900'}`}>
                  {plan.name}
                </h3>
                <p className={`text-sm mb-6 ${plan.highlighted ? 'text-violet-100' : 'text-gray-600'}`}>
                  {plan.description}
                </p>

                {/* Price */}
                <div className="mb-6">
                  {'originalPrice' in plan && (
                    <div className="mb-2">
                      <span className={`text-xl line-through ${plan.highlighted ? 'text-violet-200' : 'text-gray-400'}`}>
                        {plan.originalPrice}
                      </span>
                    </div>
                  )}
                  <div>
                    <span className={`text-5xl font-bold ${plan.highlighted ? 'text-white' : 'text-gray-900'}`}>
                      {plan.price}
                    </span>
                    <span className={`text-lg ${plan.highlighted ? 'text-violet-100' : 'text-gray-600'}`}>
                      {plan.period}
                    </span>
                  </div>
                </div>

                {/* CTA */}
                {plan.isFree ? (
                  user ? (
                    <Button
                      asChild
                      className="w-full mb-6 py-6 text-lg font-semibold rounded-xl bg-violet-600 text-white hover:bg-violet-700"
                    >
                      <Link href="/occupier/create-listing-quick">{plan.cta}</Link>
                    </Button>
                  ) : (
                    <AuthChoiceModal
                      redirectTo="/occupier/create-listing-quick"
                      title="Sign in to post requirements"
                      description="Access your account to create and manage property listings"
                    >
                      <Button className="w-full mb-6 py-6 text-lg font-semibold rounded-xl bg-violet-600 text-white hover:bg-violet-700">
                        {plan.cta}
                      </Button>
                    </AuthChoiceModal>
                  )
                ) : user ? (
                  subscriptionStatus === 'active' || subscriptionStatus === 'trialing' ? (
                    <Button
                      asChild
                      className={`w-full mb-6 py-6 text-lg font-semibold rounded-xl ${
                        plan.highlighted
                          ? 'bg-white text-violet-700 hover:bg-violet-50'
                          : 'bg-violet-600 text-white hover:bg-violet-700'
                      }`}
                    >
                      <Link href="/search">Explore requirements</Link>
                    </Button>
                  ) : (
                    <Button
                      onClick={handleProCheckout}
                      disabled={isLoadingCheckout}
                      className={`w-full mb-6 py-6 text-lg font-semibold rounded-xl ${
                        plan.highlighted
                          ? 'bg-white text-violet-700 hover:bg-violet-50'
                          : 'bg-violet-600 text-white hover:bg-violet-700'
                      }`}
                    >
                      {isLoadingCheckout ? (
                        <>
                          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                          Loading...
                        </>
                      ) : (
                        plan.cta
                      )}
                    </Button>
                  )
                ) : (
                  <TrialSignupModal context="search" redirectPath="/search">
                    <Button
                      className={`w-full mb-6 py-6 text-lg font-semibold rounded-xl ${
                        plan.highlighted
                          ? 'bg-white text-violet-700 hover:bg-violet-50'
                          : 'bg-violet-600 text-white hover:bg-violet-700'
                      }`}
                    >
                      {plan.cta}
                    </Button>
                  </TrialSignupModal>
                )}

                {/* Features */}
                <ul className="space-y-3">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-start gap-3">
                      <Check className={`w-5 h-5 flex-shrink-0 mt-0.5 ${plan.highlighted ? 'text-white' : 'text-violet-600'}`} />
                      <span className={`text-sm ${plan.highlighted ? 'text-violet-50' : 'text-gray-600'}`}>
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Additional info */}
          <div className="text-center mt-12">
            <p className="text-base text-gray-600">
              Prefer to pay by bank transfer? Contact us at{' '}
              <a href="mailto:tom@sitematcher.co.uk" className="text-violet-600 font-semibold hover:underline">
                tom@sitematcher.co.uk
              </a>{' '}
              to request an invoice
            </p>
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
      <Footer />
    </div>
  );
}

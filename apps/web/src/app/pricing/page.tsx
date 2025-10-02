'use client';

import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TrialSignupModal } from '@/components/TrialSignupModal';
import Link from 'next/link';

export default function PricingPage() {
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
      price: '£488',
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
                    <span className="bg-orange-500 text-white px-4 py-1 rounded-full text-sm font-semibold">
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
                  <Button
                    asChild
                    className="w-full mb-6 py-6 text-lg font-semibold rounded-xl bg-violet-600 text-white hover:bg-violet-700"
                  >
                    <Link href="/occupier/create-listing-quick">{plan.cta}</Link>
                  </Button>
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
            <div className="inline-flex items-center gap-2 px-6 py-3 bg-orange-50 border border-orange-200 rounded-xl">
              <svg className="w-5 h-5 text-orange-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5 2a1 1 0 011 1v1h1a1 1 0 010 2H6v1a1 1 0 01-2 0V6H3a1 1 0 010-2h1V3a1 1 0 011-1zm0 10a1 1 0 011 1v1h1a1 1 0 110 2H6v1a1 1 0 11-2 0v-1H3a1 1 0 110-2h1v-1a1 1 0 011-1zM12 2a1 1 0 01.967.744L14.146 7.2 17.5 9.134a1 1 0 010 1.732l-3.354 1.935-1.18 4.455a1 1 0 01-1.933 0L9.854 12.8 6.5 10.866a1 1 0 010-1.732l3.354-1.935 1.18-4.455A1 1 0 0112 2z" clipRule="evenodd" />
              </svg>
              <span className="text-sm font-semibold text-gray-700">
                50% introductory discount automatically applied at checkout
              </span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

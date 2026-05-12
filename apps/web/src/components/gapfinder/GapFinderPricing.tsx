'use client';

import { useState } from 'react';
import { Check, Sparkles, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TrialSignupModal } from '@/components/TrialSignupModal';
import { PaywallModal } from '@/components/PaywallModal';
import { motion } from 'framer-motion';

interface GapFinderPricingProps {
  isLoggedIn: boolean;
}

export function GapFinderPricing({ isLoggedIn }: GapFinderPricingProps) {
  const [billingInterval, setBillingInterval] = useState<'month' | 'year'>('year');

  const plans = [
    {
      name: 'Free',
      price: '£0',
      period: '',
      description: 'Try before you buy',
      features: [
        'Post unlimited property requirements',
        '30-day trial of all premium features',
        'Basic access to SiteSketcher',
        'Basic access to SiteAnalyser',
      ],
      cta: 'Get Started Free',
      highlighted: false,
      isFree: true,
    },
    {
      name: 'Pro',
      price: billingInterval === 'year' ? '£490' : '£49',
      originalPrice: billingInterval === 'year' ? '£980' : '£99',
      period: billingInterval === 'year' ? '/year' : '/month',
      description: 'For property professionals',
      features: [
        'Everything in Free',
        'Find retail white space across the UK',
        'Compare markets side-by-side',
        'Analyze operator coverage',
        'Export gap analysis to CSV',
        'Full access to all SiteMatcher tools',
      ],
      cta: 'Start Free Trial - 50% Off',
      highlighted: true,
      badge: '50% Off - Limited Time',
      isFree: false,
    },
  ];

  return (
    <section id="pricing" className="relative py-16 md:py-24 bg-gradient-to-br from-violet-50 via-purple-50 to-pink-50 overflow-hidden">
      {/* Decorative elements */}
      <div className="absolute inset-0">
        <div className="absolute top-20 right-10 w-96 h-96 bg-violet-300/20 rounded-full blur-3xl"></div>
        <div className="absolute bottom-20 left-10 w-80 h-80 bg-purple-300/20 rounded-full blur-3xl"></div>
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6">
        {/* Header */}
        <motion.div
          className="text-center mb-12 md:mb-16"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          <h2 className="text-3xl md:text-5xl lg:text-6xl font-black text-gray-900 mb-4 md:mb-6 leading-tight">
            Simple,{' '}
            <span className="relative inline-block">
              <span className="relative z-10">transparent pricing</span>
              <span className="absolute inset-0 bg-violet-200 transform -skew-y-1 -rotate-1"></span>
            </span>
          </h2>
          <p className="text-xl md:text-2xl text-gray-700 font-medium max-w-3xl mx-auto mb-8">
            30-day free trial • No credit card required • Cancel anytime
          </p>

          {/* Billing Toggle */}
          <div className="flex items-center justify-center gap-3">
            <div className="inline-flex items-center gap-0 bg-white/80 backdrop-blur-sm rounded-full p-1.5 shadow-xl border-2 border-violet-200">
              <button
                className={`px-6 md:px-8 py-3 rounded-full transition-all duration-300 font-bold text-sm md:text-base ${
                  billingInterval === 'month'
                    ? 'bg-gradient-to-r from-gray-700 to-gray-800 shadow-lg text-white scale-105'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
                onClick={() => setBillingInterval('month')}
              >
                Monthly
              </button>
              <div className="relative">
                <button
                  className={`px-6 md:px-8 py-3 rounded-full transition-all duration-300 font-bold text-sm md:text-base ${
                    billingInterval === 'year'
                      ? 'bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-lg scale-105'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                  onClick={() => setBillingInterval('year')}
                >
                  Annual
                </button>
                <span className="absolute -top-6 -right-4 bg-gradient-to-r from-orange-500 to-red-500 text-white text-xs md:text-sm px-3 py-1 rounded-full whitespace-nowrap font-black shadow-lg transform rotate-6">
                  2 Months Free
                </span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 max-w-5xl mx-auto mb-12 md:mb-16">
          {plans.map((plan, index) => (
            <motion.div
              key={plan.name}
              className={`relative rounded-[2rem] p-8 md:p-10 border-4 transition-all duration-500 ${
                plan.highlighted
                  ? 'bg-gradient-to-br from-violet-600 via-purple-600 to-violet-700 text-white border-violet-400 shadow-2xl md:scale-105 hover:scale-110'
                  : 'bg-white/95 backdrop-blur-sm border-gray-300 shadow-xl hover:shadow-2xl hover:-translate-y-2'
              }`}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{
                duration: 0.5,
                delay: 0.2 + index * 0.15,
                ease: "easeOut"
              }}
            >
              {/* Badge */}
              {plan.badge && (
                <div className="absolute -top-5 left-1/2 transform -translate-x-1/2">
                  <span className="relative z-10 bg-gradient-to-r from-orange-500 to-red-500 text-white px-5 py-2 rounded-full text-sm md:text-base font-black whitespace-nowrap shadow-xl flex items-center gap-2">
                    <Sparkles className="w-4 h-4" />
                    {plan.badge}
                  </span>
                </div>
              )}

              {/* Decorative corner gradient */}
              {!plan.highlighted && (
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-violet-100 to-purple-100 opacity-40 rounded-bl-full"></div>
              )}

              {/* Plan Icon */}
              <div className="relative mb-6">
                <div className={`inline-flex w-16 h-16 md:w-20 md:h-20 rounded-2xl items-center justify-center ${
                  plan.highlighted
                    ? 'bg-white/20 backdrop-blur-sm'
                    : 'bg-gradient-to-br from-violet-500 to-purple-600'
                } shadow-xl`}>
                  {plan.isFree ? (
                    <Sparkles className={`w-8 h-8 md:w-10 md:h-10 ${plan.highlighted ? 'text-white' : 'text-white'}`} />
                  ) : (
                    <Zap className={`w-8 h-8 md:w-10 md:h-10 ${plan.highlighted ? 'text-white' : 'text-white'}`} />
                  )}
                </div>
              </div>

              {/* Plan name */}
              <h3 className={`text-3xl md:text-4xl font-black mb-2 ${plan.highlighted ? 'text-white' : 'text-gray-900'}`}>
                {plan.name}
              </h3>
              <p className={`text-base md:text-lg mb-6 md:mb-8 font-bold ${plan.highlighted ? 'text-violet-100' : 'text-gray-600'}`}>
                {plan.description}
              </p>

              {/* Price */}
              <div className="mb-6 md:mb-8">
                {'originalPrice' in plan && (
                  <div className="mb-2">
                    <span className={`text-xl md:text-2xl line-through font-bold ${plan.highlighted ? 'text-violet-200' : 'text-gray-400'}`}>
                      {plan.originalPrice}
                    </span>
                  </div>
                )}
                <div>
                  <span className={`text-5xl md:text-6xl font-black ${plan.highlighted ? 'text-white' : 'text-gray-900'}`}>
                    {plan.price}
                  </span>
                  <span className={`text-xl md:text-2xl font-bold ${plan.highlighted ? 'text-violet-100' : 'text-gray-600'}`}>
                    {plan.period}
                  </span>
                </div>
              </div>

              {/* CTA */}
              {plan.isFree ? (
                isLoggedIn ? (
                  <Button
                    asChild
                    className="w-full mb-6 md:mb-8 py-6 md:py-7 text-lg md:text-xl font-black rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 text-white hover:from-violet-700 hover:to-purple-700 shadow-xl hover:shadow-2xl hover:scale-105 transition-all duration-300"
                  >
                    <a href="/gapfinder">{plan.cta}</a>
                  </Button>
                ) : (
                  <TrialSignupModal context="gapfinder" redirectPath="/gapfinder" billingInterval={billingInterval}>
                    <Button className="w-full mb-6 md:mb-8 py-6 md:py-7 text-lg md:text-xl font-black rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 text-white hover:from-violet-700 hover:to-purple-700 shadow-xl hover:shadow-2xl hover:scale-105 transition-all duration-300">
                      {plan.cta}
                    </Button>
                  </TrialSignupModal>
                )
              ) : (
                isLoggedIn ? (
                  <PaywallModal context="gapfinder" redirectTo="/gapfinder">
                    <Button
                      className={`w-full mb-6 md:mb-8 py-6 md:py-7 text-lg md:text-xl font-black rounded-xl shadow-xl hover:shadow-2xl hover:scale-105 transition-all duration-300 ${
                        plan.highlighted
                          ? 'bg-white text-violet-700 hover:bg-violet-50'
                          : 'bg-gradient-to-r from-violet-600 to-purple-600 text-white hover:from-violet-700 hover:to-purple-700'
                      }`}
                    >
                      {plan.cta}
                    </Button>
                  </PaywallModal>
                ) : (
                  <TrialSignupModal context="gapfinder" redirectPath="/gapfinder" billingInterval={billingInterval}>
                    <Button
                      className={`w-full mb-6 md:mb-8 py-6 md:py-7 text-lg md:text-xl font-black rounded-xl shadow-xl hover:shadow-2xl hover:scale-105 transition-all duration-300 ${
                        plan.highlighted
                          ? 'bg-white text-violet-700 hover:bg-violet-50'
                          : 'bg-gradient-to-r from-violet-600 to-purple-600 text-white hover:from-violet-700 hover:to-purple-700'
                      }`}
                    >
                      {plan.cta}
                    </Button>
                  </TrialSignupModal>
                )
              )}

              {/* Features */}
              <ul className="space-y-4">
                {plan.features.map((feature, idx) => (
                  <li key={idx} className="flex items-start gap-3">
                    <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${
                      plan.highlighted ? 'bg-white/20' : 'bg-violet-100'
                    }`}>
                      <Check className={`w-4 h-4 ${plan.highlighted ? 'text-white' : 'text-violet-600'} font-bold`} />
                    </div>
                    <span className={`text-base md:text-lg font-medium ${plan.highlighted ? 'text-violet-50' : 'text-gray-700'}`}>
                      {feature}
                    </span>
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>

        {/* Additional info */}
        <motion.div
          className="text-center max-w-3xl mx-auto"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6, delay: 0.5, ease: "easeOut" }}
        >
          <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-6 md:p-8 shadow-xl border-2 border-violet-200">
            <p className="text-base md:text-lg text-gray-700 font-medium">
              Questions about GapFinder?{' '}
              <a href="mailto:rob@sitematcher.co.uk" className="text-violet-600 font-black hover:underline hover:text-violet-700 transition-colors">
                Contact us
              </a>
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

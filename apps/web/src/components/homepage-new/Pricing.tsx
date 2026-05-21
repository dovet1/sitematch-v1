'use client';

import { useState } from 'react';
import { PricingCard } from './PricingCard';
import { RevealWrapper } from './RevealWrapper';
import { getPromotionMessage } from '@/data/homepage-new/constants';

export function Pricing() {
  const [period, setPeriod] = useState<'monthly' | 'annual'>('annual');

  return (
    <RevealWrapper>
      <section className="px-5 md:px-20 py-16 md:py-24 text-center">
        {/* Eyebrow */}
        <div className="inline-flex items-center gap-2 font-mono text-[11px] tracking-[1.4px] text-sm-ink3 uppercase">
          <span className="w-1.5 h-1.5 rounded-full bg-sm-violet" />
          Pricing
        </div>

        {/* Heading */}
        <h2 className="font-semibold text-section-h2 leading-[1.02] tracking-[-0.035em] mt-4 mb-3 text-sm-ink balance">
          Simple, transparent pricing.
        </h2>

        {/* Subtitle */}
        <p className="font-normal text-[17px] text-sm-ink2 m-0">
          Start with Free, upgrade to Pro when you're ready. 30-day free trial on Pro & Plus.
        </p>

        {/* Period Toggle */}
        <div className="inline-flex items-center mt-[26px] p-1 bg-sm-surface border border-sm-border rounded-full">
          {['monthly', 'annual'].map((k) => (
            <button
              key={k}
              onClick={() => setPeriod(k as 'monthly' | 'annual')}
              className={`px-[18px] py-2 border-none cursor-pointer rounded-full font-medium text-sm transition-colors ${
                period === k ? 'bg-sm-ink text-white' : 'bg-transparent text-sm-ink2'
              }`}
            >
              {k === 'monthly' ? 'Monthly' : 'Annual · save 17%'}
            </button>
          ))}
        </div>

        {/* Sale Chip */}
        {getPromotionMessage() && (
          <div className="inline-flex items-center gap-2 mt-[18px] px-3 py-1.5 rounded-full bg-[rgba(112,51,255,0.06)] border border-[rgba(112,51,255,0.18)] font-normal text-xs text-sm-violet-deep">
            <span className="w-1.5 h-1.5 rounded-full bg-sm-violet" />
            {getPromotionMessage()}
          </div>
        )}

        {/* Cards */}
        <div className="mt-[50px] grid grid-cols-3 gap-[18px] max-w-[1180px] mx-auto text-left max-md:grid-cols-1 max-md:gap-3.5">
          <PricingCard tier="free" period={period} />
          <PricingCard tier="pro" period={period} />
          <PricingCard tier="plus" period={period} featured />
        </div>

        {/* Footer Note */}
        <div className="mt-6 font-normal text-[13px] text-sm-ink3">
          All plans include the full SiteMatcher database. Cancel anytime. No card required for trial.
        </div>
      </section>
    </RevealWrapper>
  );
}

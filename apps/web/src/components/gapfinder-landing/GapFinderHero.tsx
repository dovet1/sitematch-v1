'use client';

import { RevealWrapper } from '../homepage-new/RevealWrapper';
import { useAuth } from '@/contexts/auth-context';
import { TrialSignupModal } from '@/components/TrialSignupModal';
import { PaywallModal } from '@/components/PaywallModal';

export function GapFinderHero() {
  const { user } = useAuth();

  const trialButton = (
    <button className="px-5 py-[13px] rounded-sm-btn bg-sm-violet text-white font-medium text-[15px] border border-sm-violet tracking-[-0.1px] hover:bg-sm-violet-deep transition-colors">
      Try GapFinder Now
    </button>
  );

  return (
    <RevealWrapper>
      <section className="px-10 pt-20 pb-0 text-center max-md:px-5 max-md:pt-12">
        {/* Eyebrow */}
        <div className="inline-flex items-center gap-2 font-mono text-[11px] tracking-[1.4px] text-sm-ink3 uppercase">
          <span className="w-1.5 h-1.5 rounded-full bg-sm-violet" />
          GapFinder
        </div>

        {/* H1 */}
        <h1 className="mx-auto mt-[18px] max-w-[1080px] font-semibold text-sm-ink text-hero-h1 leading-[0.98] tracking-[-0.04em] balance">
          GapFinder - see where every brand isn't yet.
        </h1>

        {/* Subtitle */}
        <p className="mx-auto mt-6 max-w-[620px] text-sm-ink2 leading-[1.45] balance" style={{ fontSize: 'clamp(16px, 1.6vw, 20px)' }}>
          GapFinder maps brand presence across the UK so you can find the gaps before anyone else. Spot opportunities your competitors miss.
        </p>

        {/* CTAs */}
        <div className="flex justify-center gap-2.5 mt-8 flex-wrap">
          {user ? (
            <PaywallModal context="gapfinder" redirectTo="/gapfinder">
              {trialButton}
            </PaywallModal>
          ) : (
            <TrialSignupModal context="gapfinder" redirectPath="/gapfinder" tier="plus">
              {trialButton}
            </TrialSignupModal>
          )}
        </div>
      </section>
    </RevealWrapper>
  );
}

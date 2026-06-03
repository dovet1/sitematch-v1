'use client';

import { VideoSlot } from './VideoSlot';
import { RevealWrapper } from './RevealWrapper';
import { useAuth } from '@/contexts/auth-context';
import { useSubscriptionTier } from '@/hooks/useSubscriptionTier';
import { useRouter } from 'next/navigation';

export function Hero() {
  const { user } = useAuth();
  const { hasPlusAccess } = useSubscriptionTier();
  const router = useRouter();

  const handleSeeInAction = () => {
    window.scrollBy({
      top: window.innerHeight * 0.8,
      behavior: 'smooth'
    });
  };

  const trialButton = (
    <button className="px-5 py-[13px] rounded-sm-btn bg-sm-violet text-white font-medium text-[15px] border border-sm-violet tracking-[-0.1px] hover:bg-sm-violet-deep transition-colors">
      Start 30-day free trial
    </button>
  );

  return (
    <RevealWrapper>
      <section className="px-10 pt-20 pb-0 text-center max-md:px-5 max-md:pt-12">

        {/* H1 */}
        <h1 className="mx-auto mt-[18px] max-w-[1080px] font-semibold text-sm-ink text-hero-h1 leading-[0.98] tracking-[-0.04em] balance">
          Connecting UK commercial property professionals
        </h1>

        {/* Subtitle */}
        <p className="mx-auto mt-6 max-w-[620px] text-sm-ink2 leading-[1.45] balance" style={{ fontSize: 'clamp(16px, 1.6vw, 20px)' }}>
           Identify expansion opportunities with GapFinder, browse a continually verified directory of live requirements, and connect directly with the people ready to act on them.
        </p>

        {/* CTAs */}
        <div className="flex justify-center gap-2.5 mt-8 flex-wrap">
          <button
            onClick={() => {
              if (!user) {
                // GapFinder is Plus - preserve tier context
                router.push('/auth?mode=signup&returnUrl=/pricing&tier=plus');
              } else if (!hasPlusAccess) {
                // CRITICAL: Use hasPlusAccess for GapFinder
                router.push('/pricing');
              } else {
                router.push('/gapfinder');
              }
            }}
            className="px-5 py-[13px] rounded-sm-btn bg-sm-violet text-white font-medium text-[15px] border border-sm-violet tracking-[-0.1px] hover:bg-sm-violet-deep transition-colors"
          >
            Start 30-day free trial
          </button>
          <button
            onClick={handleSeeInAction}
            className="px-5 py-[13px] rounded-sm-btn bg-transparent text-sm-ink font-medium text-[15px] border border-sm-border tracking-[-0.1px] hover:bg-sm-border-soft transition-colors"
          >
            See it in action ↓
          </button>
        </div>

        {/* Video Placeholder */}
        <div className="mx-auto mt-16 max-w-[1180px] max-md:mt-10">
          <VideoSlot
            label="Full product overview"
            note="60-second walkthrough showing the dashboard, map and key flows"
            ratio="16/9"
            videoSrc="/gapfinder/homepage_gifs/gf_gif.mp4"
            alt="GapFinder product overview demonstration"
          />
        </div>
      </section>
    </RevealWrapper>
  );
}

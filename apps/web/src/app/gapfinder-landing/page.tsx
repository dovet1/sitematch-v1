'use client';

import { GapFinderHero } from '@/components/gapfinder-landing/GapFinderHero';
import { GapFinderFeatures } from '@/components/gapfinder-landing/GapFinderFeatures';
import { Pricing } from '@/components/homepage-new/Pricing';
import { Footer } from '@/components/homepage2/Footer';

export default function GapFinderLanding() {
  return (
    <main className="bg-sm-bg min-h-screen">
      <GapFinderHero />
      <GapFinderFeatures />
      <Pricing />
      <Footer />
    </main>
  );
}

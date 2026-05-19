'use client';

import { GapFinderHero } from '@/components/gapfinder-landing/GapFinderHero';
import { GapFinderFeatures } from '@/components/gapfinder-landing/GapFinderFeatures';
import { Footer } from '@/components/homepage2/Footer';

export default function GapFinderLanding() {
  return (
    <main className="bg-sm-bg min-h-screen">
      <GapFinderHero />
      <GapFinderFeatures />
      <Footer />
    </main>
  );
}

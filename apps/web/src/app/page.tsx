'use client';

import { Hero } from '@/components/homepage-bm/Hero';
import { TrustedBy } from '@/components/homepage-new/TrustedBy';
import { Signals } from '@/components/homepage-bm/Signals';
import { Steps } from '@/components/homepage-bm/Steps';
import { Modes } from '@/components/homepage-bm/Modes';
import { Testimonial } from '@/components/homepage-new/Testimonial';
import { Pricing } from '@/components/homepage-bm/Pricing';
import { FAQ } from '@/components/homepage-bm/FAQ';
import { FinalCta } from '@/components/homepage-bm/FinalCta';
import { Footer } from '@/components/homepage2/Footer';

// Brand Matcher-led homepage (docs/design_handoff_homepage_trial).
export default function Home() {
  return (
    <main className="bg-sm-bg min-h-screen">
      <Hero />
      <TrustedBy />
      <Signals />
      <Steps />
      <Modes />
      <Testimonial />
      <Pricing />
      <FAQ />
      <FinalCta />
      <Footer />
    </main>
  );
}

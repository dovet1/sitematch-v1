'use client';

import { Pricing } from '@/components/homepage-bm/Pricing';
import { FAQ } from '@/components/homepage-bm/FAQ';
import { Footer } from '@/components/homepage2/Footer';

// Same plans as the homepage (docs/design_handoff_homepage_trial): SiteMatcher Pro at £199 per
// person per month or £1,990 per year, with a 14-day trial; Enterprise on request. Existing
// subscribers on earlier plans manage them from the account menu.
export default function PricingPage() {
  return (
    <main className="min-h-screen bg-sm-bg">
      <Pricing />
      <FAQ />
      <Footer />
    </main>
  );
}

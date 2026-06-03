'use client';

import { Hero } from '@/components/homepage-new/Hero';
import { TrustedBy } from '@/components/homepage-new/TrustedBy';
import { Features } from '@/components/homepage-new/Features';
import { Testimonial } from '@/components/homepage-new/Testimonial';
import { Pricing } from '@/components/homepage-new/Pricing';
import { FAQ } from '@/components/homepage-new/FAQ';
import { Footer } from '@/components/homepage2/Footer';

export default function Home() {
  return (
    <main className="bg-sm-bg min-h-screen">
      <Hero />
      <TrustedBy />
      <Features />
      <Testimonial />
      <Pricing />
      <FAQ />
      <Footer />
    </main>
  );
}

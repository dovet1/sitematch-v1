import { Hero } from '@/components/homepage2/Hero';
import { TheProblem } from '@/components/homepage2/TheProblem';
import { DatabaseDifferentiators } from '@/components/homepage2/DatabaseDifferentiators';
import { FeaturedListings } from '@/components/homepage2/FeaturedListings';
import { ToolsShowcase } from '@/components/homepage2/ToolsShowcase';
import { FreePostingCTA } from '@/components/homepage2/FreePostingCTA';
import { Pricing } from '@/components/homepage2/Pricing';
import { FAQ } from '@/components/homepage2/FAQ';
import { FinalCTA } from '@/components/homepage2/FinalCTA';
import { Footer } from '@/components/homepage2/Footer';

export default function Home() {
  return (
    <main className="min-h-screen bg-white">
      {/* Hero Section */}
      <Hero />

      {/* The Problem */}
      <TheProblem />

      {/* Solution #1: Database + Kerry Testimonial */}
      <DatabaseDifferentiators />

      {/* Featured Listings */}
      <FeaturedListings />

      {/* Solution #2: Tools + Henry Testimonial */}
      <ToolsShowcase />

      {/* Solution #3: Free Posting */}
      <FreePostingCTA />

      {/* Pricing Section */}
      <Pricing />

      {/* FAQ */}
      <FAQ />

      {/* Final CTA */}
      <FinalCTA />

      {/* Footer */}
      <Footer />
    </main>
  );
}

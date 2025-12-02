import { Hero } from '@/components/homepage2/Hero';
import { Partners } from '@/components/homepage2/Partners';
import { Benefits } from '@/components/homepage2/Benefits';
import { FeaturedListings } from '@/components/homepage2/FeaturedListings';
import { ToolsShowcase } from '@/components/homepage2/ToolsShowcase';
import { HowItWorks } from '@/components/homepage2/HowItWorks';
import { Pricing } from '@/components/homepage2/Pricing';
import { Testimonials } from '@/components/homepage2/Testimonials';
import { FAQ } from '@/components/homepage2/FAQ';
import { FinalCTA } from '@/components/homepage2/FinalCTA';
import { Footer } from '@/components/homepage2/Footer';

export default function Home() {
  return (
    <main className="min-h-screen bg-white">
      {/* Hero Section */}
      <Hero />

      {/* Partners Section */}
      <Partners />

      {/* Benefits Section */}
      <Benefits />

      {/* Featured Listings */}
      <FeaturedListings />

      {/* Tools Showcase */}
      <ToolsShowcase />

      {/* How It Works */}
      <HowItWorks />

      {/* Pricing Section */}
      <Pricing />

      {/* Testimonials */}
      <Testimonials />

      {/* FAQ */}
      <FAQ />

      {/* Final CTA */}
      <FinalCTA />

      {/* Footer */}
      <Footer />
    </main>
  );
}

import { HeroSearch } from '@/components/search/HeroSearch';
import { ValueProposition } from '@/components/homepage/ValueProposition';
import { HowItWorks } from '@/components/homepage/HowItWorks';
import { Testimonials } from '@/components/homepage/Testimonials';
import { TrustIndicators } from '@/components/homepage/TrustIndicators';
import { HomeCTA } from '@/components/homepage/HomeCTA';

export default function Home() {
  return (
    <main className="min-h-screen bg-background">
      {/* Hero Section */}
      <HeroSearch />

      {/* Platform Value Proposition */}
      <ValueProposition />

      {/* How It Works */}
      <HowItWorks />

      {/* Testimonials */}
      <Testimonials />

      {/* Trust Indicators */}
      <TrustIndicators />

      {/* Call to Action */}
      <HomeCTA />
    </main>
  );
}
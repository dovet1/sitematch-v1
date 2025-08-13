import { HeroSearch } from '@/components/search/HeroSearch';
import { CompanyCarousel } from '@/components/homepage/CompanyCarousel';
import { HowItWorks } from '@/components/homepage/HowItWorks';
import { Testimonials } from '@/components/homepage/Testimonials';
import { FAQ } from '@/components/homepage/FAQ';
import { MeetTheFounders } from '@/components/homepage/MeetTheFounders';
import { Footer } from '@/components/homepage/Footer';

export default function Home() {
  return (
    <main className="min-h-screen bg-background">
      {/* Hero Section */}
      <HeroSearch />

      {/* Company Carousel */}
      <CompanyCarousel />

      {/* How It Works */}
      <HowItWorks />

      {/* Testimonials */}
      <Testimonials />

      {/* FAQ */}
      <FAQ />

      {/* Meet the Founders */}
      <MeetTheFounders />

      {/* Footer */}
      <Footer />
    </main>
  );
}
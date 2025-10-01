import { HeroSearch } from '@/components/search/HeroSearch';
import { CompanyCarousel } from '@/components/homepage/CompanyCarousel';
import { PostRequirements } from '@/components/homepage/PostRequirements';
import { BrowseRequirements } from '@/components/homepage/BrowseRequirements';
import { SiteSketcherSection } from '@/components/homepage/SiteSketcherSection';
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

      {/* Browse Requirements - Primary Action */}
      <BrowseRequirements />

      {/* Post Requirements - Secondary Action */}
      <PostRequirements />

      {/* SiteSketcher */}
      <SiteSketcherSection />

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
'use client';

import { useEffect, useRef, useState } from 'react';
import { createClientClient } from '@/lib/supabase';

interface Company {
  id: string;
  name: string;
  logo: string;
}

export function CompanyCarousel() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const carouselRef = useRef<HTMLDivElement>(null);
  const [isAnimating, setIsAnimating] = useState(true);
  const [isHydrated, setIsHydrated] = useState(false);

  // Fetch companies from database
  useEffect(() => {
    const fetchCompanies = async () => {
      try {
        const supabase = createClientClient();
        const { data, error } = await supabase
          .from('listings')
          .select('id, company_name, company_domain')
          .eq('clearbit_logo', true)
          .eq('status', 'approved')
          .not('company_domain', 'is', null)
          .limit(20);

        if (error) {
          console.error('Error fetching companies:', error);
          return;
        }

        if (data) {
          const companyData: Company[] = data.map(listing => ({
            id: listing.id,
            name: listing.company_name,
            logo: `https://logo.clearbit.com/${listing.company_domain}`
          }));
          
          setCompanies(companyData);
        }
      } catch (error) {
        console.error('Error fetching companies:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchCompanies();
  }, []);

  // Ensure client-side hydration
  useEffect(() => {
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (!isHydrated || loading || companies.length === 0) return;
    
    const container = carouselRef.current;
    if (!container) return;

    let animationId: number;
    let scrollSpeed = 0.5; // pixels per frame
    let isAnimationActive = false;
    
    const animate = () => {
      if (!container || !isAnimating || !isAnimationActive) {
        return;
      }
      
      try {
        const { scrollLeft, scrollWidth, clientWidth } = container;
        
        // Ensure we have content to scroll
        if (scrollWidth <= clientWidth) {
          return;
        }
        
        // Reset position when we've scrolled past half the content (since we duplicated it)
        if (scrollLeft >= (scrollWidth - clientWidth) / 2) {
          container.scrollLeft = 0;
        } else {
          container.scrollLeft += scrollSpeed;
        }
        
        animationId = requestAnimationFrame(animate);
      } catch (error) {
        // Silently handle any errors and stop animation
        console.warn('Animation error:', error);
        isAnimationActive = false;
      }
    };

    // Pause on hover
    const handleMouseEnter = () => {
      setIsAnimating(false);
      isAnimationActive = false;
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };

    const handleMouseLeave = () => {
      setIsAnimating(true);
      if (isHydrated && !loading) {
        isAnimationActive = true;
        animationId = requestAnimationFrame(animate);
      }
    };

    // Start animation after a delay to ensure DOM is ready
    const startTimer = setTimeout(() => {
      if (isAnimating && container && companies.length > 0) {
        isAnimationActive = true;
        animationId = requestAnimationFrame(animate);
      }
    }, 250); // Increased delay for production stability

    container.addEventListener('mouseenter', handleMouseEnter);
    container.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      clearTimeout(startTimer);
      isAnimationActive = false;
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
      if (container) {
        container.removeEventListener('mouseenter', handleMouseEnter);
        container.removeEventListener('mouseleave', handleMouseLeave);
      }
    };
  }, [isAnimating, isHydrated, loading, companies.length]);

  // Don't render if no companies available
  if (loading) {
    return (
      <section className="company-carousel py-20 bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="company-carousel__container max-w-7xl mx-auto px-6">
          <h2 className="company-carousel__title text-3xl font-bold text-gray-800 text-center mb-12">
            Companies We Work With
          </h2>
          <div className="flex justify-center items-center h-20">
            <div className="animate-pulse text-gray-500">Loading companies...</div>
          </div>
        </div>
      </section>
    );
  }

  if (companies.length === 0) {
    return null; // Don't show section if no companies
  }

  return (
    <section className="company-carousel py-20 bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="company-carousel__container max-w-7xl mx-auto px-6">
        <h2 className="company-carousel__title text-3xl font-bold text-gray-800 text-center mb-12">
          Companies We Work With
        </h2>
        
        <div className="relative overflow-hidden">
          <div
            ref={carouselRef}
            className="flex gap-4 md:gap-8 overflow-x-hidden px-6"
            style={{ 
              scrollbarWidth: 'none', 
              msOverflowStyle: 'none',
              WebkitOverflowScrolling: 'touch',
              '::-webkit-scrollbar': {
                display: 'none'
              }
            } as any}
          >
            {/* Duplicate companies for seamless infinite scroll */}
            {[...companies, ...companies].map((company, index) => (
              <div
                key={`${company.id}-${index}`}
                className="company-carousel__item group relative flex-shrink-0 w-28 h-16 md:w-36 md:h-20 bg-white rounded-xl md:rounded-2xl shadow-sm border border-gray-100 flex items-center justify-center transition-all duration-300 hover:shadow-md hover:scale-105 cursor-pointer"
              >
                <div className="company-carousel__logo flex items-center justify-center w-full h-full p-2 md:p-4">
                  <img
                    src={company.logo}
                    alt={`${company.name} logo`}
                    className="max-w-full max-h-full object-contain"
                    onError={(e) => {
                      // Fallback to colored placeholder if Clearbit logo fails
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                      const placeholder = target.nextElementSibling as HTMLElement;
                      if (placeholder) {
                        placeholder.style.display = 'flex';
                      }
                    }}
                  />
                  <div 
                    className="w-8 h-8 md:w-12 md:h-12 bg-gradient-to-r from-violet-400 to-purple-600 rounded md:rounded-lg items-center justify-center hidden"
                  >
                    <span className="text-white text-xs md:text-sm font-bold">
                      {company.name.charAt(0)}
                    </span>
                  </div>
                </div>
                
                {/* Company name overlay - appears on hover */}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/70 to-transparent text-white text-xs font-medium p-2 rounded-b-xl md:rounded-b-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
                  <span className="block text-center leading-tight">
                    {company.name}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
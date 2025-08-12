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
  const [isMobile, setIsMobile] = useState(false);

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

  // Ensure client-side hydration and detect mobile
  useEffect(() => {
    setIsHydrated(true);
    // Detect mobile devices including iOS Safari
    const isMobileDevice = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || 
                          ('ontouchstart' in window) || 
                          (navigator.maxTouchPoints > 0);
    setIsMobile(isMobileDevice);
  }, []);

  useEffect(() => {
    if (!isHydrated || loading || companies.length === 0) return;
    
    const container = carouselRef.current;
    if (!container) return;

    if (!isMobile) {
      // Desktop only: Use requestAnimationFrame for scroll-based animation
      let animationId: number;
      let scrollSpeed = 0.5;
      let isAnimationActive = false;
      
      const animate = () => {
        if (!container || !isAnimating || !isAnimationActive) {
          return;
        }
        
        try {
          const { scrollLeft, scrollWidth, clientWidth } = container;
          
          if (scrollWidth <= clientWidth) {
            return;
          }
          
          if (scrollLeft >= (scrollWidth - clientWidth) / 2) {
            container.scrollLeft = 0;
          } else {
            container.scrollLeft += scrollSpeed;
          }
          
          animationId = requestAnimationFrame(animate);
        } catch (error) {
          console.warn('Animation error:', error);
          isAnimationActive = false;
        }
      };

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

      const startTimer = setTimeout(() => {
        if (isAnimating && container && companies.length > 0) {
          isAnimationActive = true;
          animationId = requestAnimationFrame(animate);
        }
      }, 250);

      container.addEventListener('mouseenter', handleMouseEnter);
      container.addEventListener('mouseleave', handleMouseLeave);

      return () => {
        clearTimeout(startTimer);
        isAnimationActive = false;
        if (animationId) {
          cancelAnimationFrame(animationId);
        }
        container.removeEventListener('mouseenter', handleMouseEnter);
        container.removeEventListener('mouseleave', handleMouseLeave);
      };
    }
    // Mobile: No JavaScript needed, pure CSS animation handles everything
  }, [isAnimating, isHydrated, loading, companies.length, isMobile]);

  // Don't render if no companies available
  if (loading) {
    return (
      <section className="company-carousel py-20 bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="company-carousel__container max-w-7xl mx-auto px-6">
          <h2 className="company-carousel__title text-3xl font-bold text-gray-800 text-center mb-12">
            Companies we work with
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
          Companies we work with
        </h2>
        
        <div 
          className="relative overflow-hidden"
          style={{ 
            touchAction: 'pan-y',
            maxWidth: '100%',
            width: '100%'
          }}
        >
          <div
            ref={carouselRef}
            className={`flex gap-4 md:gap-8 px-6 ${isMobile ? 'mobile-carousel' : 'desktop-carousel'}`}
            style={isMobile ? {
              // Mobile: Pure CSS animation, no scroll at all
              animation: companies.length > 0 ? `scroll-left ${companies.length * 4}s linear infinite` : 'none',
              touchAction: 'none',
              pointerEvents: 'none',
              transform: 'translateZ(0)',
              width: 'max-content',
              willChange: 'transform'
            } : { 
              // Desktop: Scrollable
              scrollbarWidth: 'none', 
              msOverflowStyle: 'none',
              overflowX: 'hidden'
            }}
          >
            {/* Duplicate companies for seamless infinite scroll */}
            {[...companies, ...companies].map((company, index) => (
              <div
                key={`${company.id}-${index}`}
                className={`company-carousel__item group relative flex-shrink-0 w-28 h-16 md:w-36 md:h-20 bg-white rounded-xl md:rounded-2xl shadow-sm border border-gray-100 flex items-center justify-center transition-all duration-300 hover:shadow-md hover:scale-105 ${isMobile ? 'pointer-events-none' : 'cursor-pointer'}`}
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
      
      {/* CSS animations for mobile */}
      <style jsx>{`
        @keyframes scroll-left {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-50%);
          }
        }
        
        .mobile-carousel {
          /* Mobile: Pure CSS transform animation, no scrolling at all */
          overflow: visible !important;
          -webkit-overflow-scrolling: unset !important;
          touch-action: none !important;
          pointer-events: none !important;
        }
        
        .desktop-carousel {
          /* Desktop: Allow scrolling for mouse interaction */
          overflow-x: hidden;
        }
        
        .desktop-carousel::-webkit-scrollbar {
          display: none;
        }
        
        @media (max-width: 768px) {
          .company-carousel {
            /* Completely prevent any horizontal scroll behavior */
            overflow-x: hidden !important;
            overscroll-behavior-x: none !important;
            -webkit-overflow-scrolling: unset !important;
            touch-action: pan-y !important;
            max-width: 100vw !important;
            width: 100% !important;
          }
          
          .company-carousel * {
            /* Ensure no child elements can create horizontal scroll */
            touch-action: pan-y !important;
            -webkit-overflow-scrolling: unset !important;
          }
          
          .company-carousel__item {
            transform: translateZ(0);
            -webkit-transform: translateZ(0);
            pointer-events: none !important;
            touch-action: none !important;
          }
          
          /* Ensure the parent container doesn't overflow */
          .company-carousel__container {
            max-width: 100vw !important;
            overflow: hidden !important;
            width: 100% !important;
          }
          
          /* Contain any wide content within the carousel */
          .mobile-carousel {
            position: relative !important;
            left: 0 !important;
            right: 0 !important;
          }
        }
      `}</style>
    </section>
  );
}
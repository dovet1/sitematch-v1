'use client';

import { useEffect, useRef, useState } from 'react';
import { createClientClient } from '@/lib/supabase';

interface Company {
  id: string;
  name: string;
  logo: string;
}

export function Partners() {
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
          const token = process.env.NEXT_PUBLIC_LOGO_DEV_TOKEN
          const companyData: Company[] = data.map(listing => ({
            id: listing.id,
            name: listing.company_name,
            logo: token ? `https://img.logo.dev/${listing.company_domain}?token=${token}` : ''
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
  }, [isAnimating, isHydrated, loading, companies.length, isMobile]);

  if (loading || companies.length === 0) return null;

  return (
    <section className="py-16 bg-white border-y border-gray-100">
      <div className="max-w-7xl mx-auto px-6">
        <p className="text-center text-sm font-semibold text-gray-500 uppercase tracking-wider mb-8">
          For companies of every size and sector
        </p>

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
              animation: companies.length > 0 ? `scroll-left ${companies.length * 4}s linear infinite` : 'none',
              touchAction: 'none',
              pointerEvents: 'none',
              transform: 'translateZ(0)',
              width: 'max-content',
              willChange: 'transform'
            } : {
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
              overflowX: 'hidden'
            }}
          >
            {[...companies, ...companies].map((company, index) => (
              <div
                key={`${company.id}-${index}`}
                className={`group relative flex-shrink-0 w-28 h-16 md:w-36 md:h-20 bg-white rounded-xl md:rounded-2xl shadow-sm border border-gray-100 flex items-center justify-center transition-all duration-300 hover:shadow-md hover:scale-105 ${isMobile ? 'pointer-events-none' : 'cursor-pointer'}`}
              >
                <div className="flex items-center justify-center w-full h-full p-2 md:p-4">
                  <img
                    src={company.logo}
                    alt={`${company.name} logo`}
                    className="max-w-full max-h-full object-contain"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                      const placeholder = target.nextElementSibling as HTMLElement;
                      if (placeholder) {
                        placeholder.style.display = 'flex';
                      }
                    }}
                  />
                  <div className="w-8 h-8 md:w-12 md:h-12 bg-gradient-to-r from-violet-400 to-purple-600 rounded md:rounded-lg items-center justify-center hidden">
                    <span className="text-white text-xs md:text-sm font-bold">
                      {company.name.charAt(0)}
                    </span>
                  </div>
                </div>

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
          overflow: visible !important;
          -webkit-overflow-scrolling: unset !important;
          touch-action: none !important;
          pointer-events: none !important;
        }

        .desktop-carousel {
          overflow-x: hidden;
        }

        .desktop-carousel::-webkit-scrollbar {
          display: none;
        }

        @media (max-width: 768px) {
          .mobile-carousel > div {
            transform: translateZ(0);
            -webkit-transform: translateZ(0);
            pointer-events: none !important;
            touch-action: none !important;
          }
        }
      `}</style>
    </section>
  );
}

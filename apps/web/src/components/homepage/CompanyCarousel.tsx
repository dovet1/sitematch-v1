'use client';

import { useEffect, useRef } from 'react';

const companies = [
  { name: 'TechCorp', logo: '/logos/techcorp.svg' },
  { name: 'InnovateLtd', logo: '/logos/innovate.svg' },
  { name: 'GlobalSolutions', logo: '/logos/global.svg' },
  { name: 'FutureVentures', logo: '/logos/future.svg' },
  { name: 'DigitalFirst', logo: '/logos/digital.svg' },
  { name: 'SmartBusiness', logo: '/logos/smart.svg' },
  { name: 'NextGenTech', logo: '/logos/nextgen.svg' },
  { name: 'CloudServ', logo: '/logos/cloud.svg' },
  { name: 'DataSystems', logo: '/logos/data.svg' },
  { name: 'WebSolutions', logo: '/logos/web.svg' },
  { name: 'MobileTech', logo: '/logos/mobile.svg' },
  { name: 'Enterprise', logo: '/logos/enterprise.svg' },
];

export function CompanyCarousel() {
  const carouselRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = carouselRef.current;
    if (!container) return;

    // Create a continuous scroll animation
    let animationId: number;
    let scrollSpeed = 0.5; // pixels per frame
    
    const animate = () => {
      if (container) {
        const { scrollLeft, scrollWidth, clientWidth } = container;
        
        // Reset position when we've scrolled past half the content (since we duplicated it)
        if (scrollLeft >= (scrollWidth - clientWidth) / 2) {
          container.scrollLeft = 0;
        } else {
          container.scrollLeft += scrollSpeed;
        }
      }
      animationId = requestAnimationFrame(animate);
    };

    // Start the animation
    animationId = requestAnimationFrame(animate);

    // Pause on hover
    const handleMouseEnter = () => {
      cancelAnimationFrame(animationId);
    };

    const handleMouseLeave = () => {
      animationId = requestAnimationFrame(animate);
    };

    container.addEventListener('mouseenter', handleMouseEnter);
    container.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      cancelAnimationFrame(animationId);
      container.removeEventListener('mouseenter', handleMouseEnter);
      container.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, []);

  return (
    <section className="company-carousel py-20 bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="company-carousel__container max-w-7xl mx-auto px-6">
        <h2 className="company-carousel__title text-3xl font-bold text-gray-800 text-center mb-12">
          Companies We Work With
        </h2>
        
        <div className="relative overflow-hidden">
          <div
            ref={carouselRef}
            className="company-carousel__track flex gap-4 md:gap-8 overflow-x-hidden scrollbar-hide px-6"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {/* Duplicate companies for seamless infinite scroll */}
            {[...companies, ...companies].map((company, index) => (
              <div
                key={index}
                className="company-carousel__item flex-shrink-0 w-28 h-16 md:w-36 md:h-20 bg-white rounded-xl md:rounded-2xl shadow-sm border border-gray-100 flex items-center justify-center transition-all duration-300 hover:shadow-md hover:scale-105"
              >
                <div className="company-carousel__logo-placeholder text-center p-2 md:p-4">
                  <div className="w-4 h-4 md:w-8 md:h-8 bg-gradient-to-r from-violet-400 to-purple-600 rounded md:rounded-lg mx-auto mb-1 md:mb-2"></div>
                  <span className="text-xs font-medium text-gray-600 leading-tight">
                    {company.name}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <style jsx>{`
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </section>
  );
}
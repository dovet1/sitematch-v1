'use client';

import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Quote } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function Testimonials() {
  const testimonials = [
    {
      quote: "SiteMatch helped us find the perfect retail unit for our expanding coffee chain. The detailed requirements and direct contact with decision-makers made the process incredibly efficient.",
      author: "Sarah Chen",
      role: "Expansion Director",
      company: "Artisan Coffee Co.",
      type: "Occupier",
      image: null, // Placeholder for future photo implementation
    },
    {
      quote: "As a small business looking for warehouse space, we struggled to get attention from agents. SiteMatch gave us direct access to property owners who were genuinely interested in our requirements.",
      author: "Mike Thompson",
      role: "Operations Manager",
      company: "Thompson Logistics",
      type: "Occupier",
      image: null,
    },
    {
      quote: "The quality of leads from SiteMatch is outstanding. We've closed three deals in six months, and the tenants we've found are exactly what we were looking for.",
      author: "Emma Rodriguez",
      role: "Property Portfolio Manager",
      company: "Urban Developments",
      type: "Landlord",
      image: null,
    },
    {
      quote: "We needed to relocate our manufacturing facility quickly. SiteMatch's detailed search filters and nationwide coverage helped us find options we never would have discovered otherwise.",
      author: "James Wilson",
      role: "Facilities Director",
      company: "TechManufacturing Ltd",
      type: "Occupier",
      image: null,
    },
    {
      quote: "The transparency of SiteMatch is refreshing. No hidden fees, no complex contracts - just genuine connections between property needs and opportunities.",
      author: "Rachel Adams",
      role: "Commercial Director",
      company: "Adams Property Group",
      type: "Landlord",
      image: null,
    },
  ];

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);
  const [touchStart, setTouchStart] = useState(0);
  const [touchEnd, setTouchEnd] = useState(0);

  const nextTestimonial = () => {
    setCurrentIndex((prev) => (prev + 1) % testimonials.length);
  };

  const prevTestimonial = () => {
    setCurrentIndex((prev) => (prev - 1 + testimonials.length) % testimonials.length);
  };

  const goToTestimonial = (index: number) => {
    setCurrentIndex(index);
  };

  useEffect(() => {
    if (!isAutoPlaying) return;
    
    const interval = setInterval(() => {
      nextTestimonial();
    }, 5000);

    return () => clearInterval(interval);
  }, [isAutoPlaying]);

  const handleMouseEnter = () => setIsAutoPlaying(false);
  const handleMouseLeave = () => setIsAutoPlaying(true);

  // Touch event handlers for swipe functionality
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.targetTouches[0].clientX);
    setTouchEnd(0); // Reset touch end
    setIsAutoPlaying(false); // Pause auto-play during touch
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart) return;
    
    // If no touchMove occurred, use changedTouches from touchEnd
    const finalTouchEnd = touchEnd || e.changedTouches[0].clientX;
    const distance = touchStart - finalTouchEnd;
    const isLeftSwipe = distance > 50;
    const isRightSwipe = distance < -50;

    console.log('Swipe detected:', { touchStart, finalTouchEnd, distance, isLeftSwipe, isRightSwipe });

    if (isLeftSwipe) {
      nextTestimonial();
    } else if (isRightSwipe) {
      prevTestimonial();
    }
    
    // Reset touch values
    setTouchStart(0);
    setTouchEnd(0);
    
    // Resume auto-play after a delay
    setTimeout(() => setIsAutoPlaying(true), 3000);
  };

  return (
    <section className="testimonials py-20 bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="testimonials__container max-w-7xl mx-auto px-6">
        <h2 className="testimonials__title text-3xl font-bold text-gray-800 text-center mb-16">
          What Our Users Say
        </h2>

        {/* Carousel */}
        <div 
          className="testimonials__carousel relative max-w-4xl mx-auto"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          <div 
            className="testimonials__card bg-white rounded-2xl p-8 md:p-12 relative shadow-lg border border-gray-100 select-none"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            style={{ 
              touchAction: 'manipulation',
              userSelect: 'none',
              WebkitUserSelect: 'none'
            }}
          >
            {/* Quote Icon */}
            <Quote className="w-12 h-12 text-violet-600 mb-6" />
            
            {/* Testimonial Content */}
            <div className="min-h-[180px] md:min-h-[200px] flex flex-col justify-between">
              <blockquote className="text-base md:text-lg lg:text-xl text-gray-700 leading-relaxed mb-6 md:mb-8 font-medium">
                "{testimonials[currentIndex].quote}"
              </blockquote>
              
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="text-center sm:text-left">
                  <p className="font-bold text-gray-800 text-base md:text-lg">
                    {testimonials[currentIndex].author}
                  </p>
                  <p className="text-gray-600 font-medium text-sm md:text-base">
                    {testimonials[currentIndex].role}
                  </p>
                  <p className="text-xs md:text-sm text-gray-500">
                    {testimonials[currentIndex].company}
                  </p>
                </div>
                
                <div className="flex items-center justify-center sm:justify-end gap-2">
                  <span className={`px-3 md:px-4 py-1 md:py-2 rounded-full text-xs md:text-sm font-semibold ${
                    testimonials[currentIndex].type === 'Occupier' 
                      ? 'bg-blue-100 text-blue-800 border border-blue-200' 
                      : 'bg-green-100 text-green-800 border border-green-200'
                  }`}>
                    {testimonials[currentIndex].type}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Navigation Buttons - Hidden on mobile */}
          <Button
            variant="outline"
            size="sm"
            onClick={prevTestimonial}
            className="hidden md:flex absolute -left-2 md:-left-6 top-1/2 -translate-y-1/2 w-10 h-10 md:w-12 md:h-12 p-0 rounded-full shadow-lg bg-white hover:bg-gray-50 border-gray-200"
            aria-label="Previous testimonial"
          >
            <ChevronLeft className="w-4 h-4 md:w-5 md:h-5 text-gray-600" />
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={nextTestimonial}
            className="hidden md:flex absolute -right-2 md:-right-6 top-1/2 -translate-y-1/2 w-10 h-10 md:w-12 md:h-12 p-0 rounded-full shadow-lg bg-white hover:bg-gray-50 border-gray-200"
            aria-label="Next testimonial"
          >
            <ChevronRight className="w-4 h-4 md:w-5 md:h-5 text-gray-600" />
          </Button>
        </div>

        {/* Dots Indicator */}
        <div className="testimonials__dots flex justify-center mt-8 gap-3">
          {testimonials.map((_, index) => (
            <button
              key={index}
              onClick={() => goToTestimonial(index)}
              className={`w-3 h-3 rounded-full transition-all duration-300 ${
                index === currentIndex 
                  ? 'bg-violet-600 scale-125' 
                  : 'bg-gray-300 hover:bg-gray-400'
              }`}
              aria-label={`Go to testimonial ${index + 1}`}
            />
          ))}
        </div>

      </div>

      <style jsx>{`
        @media (max-width: 768px) {
          .testimonials {
            padding: 48px 0;
          }
          
          .testimonials__title {
            font-size: 24px;
            margin-bottom: 32px;
          }
          
          .testimonials__card {
            padding: 24px;
            cursor: grab;
            transition: transform 0.2s ease;
          }
          
          .testimonials__card:active {
            cursor: grabbing;
            transform: scale(0.98);
          }
        }
        
        /* Smooth transition for testimonial changes */
        .testimonials__card {
          transition: opacity 0.3s ease, transform 0.2s ease;
        }
      `}</style>
    </section>
  );
}
'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight, Quote } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function Testimonials() {
  const testimonials = [
    {
      quote: "SiteMatch helped us find the perfect retail unit for our expanding coffee chain. The detailed requirements and direct contact with decision-makers made the process incredibly efficient.",
      author: "Sarah Chen",
      role: "Expansion Director",
      company: "Artisan Coffee Co.",
      type: "Property Seeker",
      image: null, // Placeholder for future photo implementation
    },
    {
      quote: "As a small business looking for warehouse space, we struggled to get attention from agents. SiteMatch gave us direct access to property owners who were genuinely interested in our requirements.",
      author: "Mike Thompson",
      role: "Operations Manager",
      company: "Thompson Logistics",
      type: "Requirement Lister",
      image: null,
    },
    {
      quote: "The quality of leads from SiteMatch is outstanding. We've closed three deals in six months, and the tenants we've found are exactly what we were looking for.",
      author: "Emma Rodriguez",
      role: "Property Portfolio Manager",
      company: "Urban Developments",
      type: "Property Seeker",
      image: null,
    },
    {
      quote: "We needed to relocate our manufacturing facility quickly. SiteMatch's detailed search filters and nationwide coverage helped us find options we never would have discovered otherwise.",
      author: "James Wilson",
      role: "Facilities Director",
      company: "TechManufacturing Ltd",
      type: "Requirement Lister",
      image: null,
    },
    {
      quote: "The transparency of SiteMatch is refreshing. No hidden fees, no complex contracts - just genuine connections between property needs and opportunities.",
      author: "Rachel Adams",
      role: "Commercial Director",
      company: "Adams Property Group",
      type: "Property Seeker",
      image: null,
    },
  ];

  const [currentIndex, setCurrentIndex] = useState(0);

  const nextTestimonial = () => {
    setCurrentIndex((prev) => (prev + 1) % testimonials.length);
  };

  const prevTestimonial = () => {
    setCurrentIndex((prev) => (prev - 1 + testimonials.length) % testimonials.length);
  };

  const goToTestimonial = (index: number) => {
    setCurrentIndex(index);
  };

  return (
    <section className="py-20 bg-background">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-16">
          <h2 className="heading-2 font-bold text-foreground mb-4">
            What Our Users Say
          </h2>
          <p className="body-large text-muted-foreground max-w-2xl mx-auto">
            Real stories from property seekers and requirement listers who've found success through SiteMatch.
          </p>
        </div>

        {/* Carousel */}
        <div className="relative max-w-4xl mx-auto">
          <div className="bg-muted/30 rounded-2xl p-8 md:p-12 relative">
            {/* Quote Icon */}
            <Quote className="w-8 h-8 text-primary-600 mb-6" />
            
            {/* Testimonial Content */}
            <div className="min-h-[200px] flex flex-col justify-between">
              <blockquote className="text-lg md:text-xl text-foreground leading-relaxed mb-8">
                "{testimonials[currentIndex].quote}"
              </blockquote>
              
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <p className="font-semibold text-foreground">
                    {testimonials[currentIndex].author}
                  </p>
                  <p className="text-muted-foreground">
                    {testimonials[currentIndex].role}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {testimonials[currentIndex].company}
                  </p>
                </div>
                
                <div className="flex items-center gap-2">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    testimonials[currentIndex].type === 'Property Seeker' 
                      ? 'bg-blue-50 text-blue-700' 
                      : 'bg-green-50 text-green-700'
                  }`}>
                    {testimonials[currentIndex].type}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Navigation Buttons */}
          <Button
            variant="outline"
            size="sm"
            onClick={prevTestimonial}
            className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 p-0 rounded-full shadow-md"
            aria-label="Previous testimonial"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={nextTestimonial}
            className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 p-0 rounded-full shadow-md"
            aria-label="Next testimonial"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>

        {/* Dots Indicator */}
        <div className="flex justify-center mt-8 gap-2">
          {testimonials.map((_, index) => (
            <button
              key={index}
              onClick={() => goToTestimonial(index)}
              className={`w-3 h-3 rounded-full transition-colors ${
                index === currentIndex 
                  ? 'bg-primary-600' 
                  : 'bg-border hover:bg-muted-foreground'
              }`}
              aria-label={`Go to testimonial ${index + 1}`}
            />
          ))}
        </div>

        {/* Mobile Grid (Alternative view for smaller screens) */}
        <div className="md:hidden mt-12 space-y-6">
          {testimonials.slice(0, 3).map((testimonial, index) => (
            <div key={index} className="bg-muted/30 rounded-lg p-6">
              <blockquote className="text-sm text-foreground mb-4">
                "{testimonial.quote}"
              </blockquote>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-sm">{testimonial.author}</p>
                  <p className="text-xs text-muted-foreground">{testimonial.company}</p>
                </div>
                <span className={`px-2 py-1 rounded-full text-xs ${
                  testimonial.type === 'Property Seeker' 
                    ? 'bg-blue-50 text-blue-700' 
                    : 'bg-green-50 text-green-700'
                }`}>
                  {testimonial.type}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
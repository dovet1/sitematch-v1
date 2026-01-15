'use client';

import { ArrowRight, Check, Sparkles, Quote } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/auth-context';
import Image from 'next/image';

interface UpgradeCTAProps {
  onUpgradeClick: () => void;
}

export function UpgradeCTA({ onUpgradeClick }: UpgradeCTAProps) {
  const { user } = useAuth();

  const testimonials = [
    {
      quote: "With SiteMatcher I can see the market in seconds. It's easily the fastest way I've found to spot real opportunities.",
      author: "Kerry Northfold",
      role: "Director",
      company: "Vedra Property Group",
      image: "/testimonials/kerry-northfold.jpg"
    },
    {
      quote: "SiteMatcher shows me who's active and exactly what they're looking for. I get contacts instantly.",
      author: "Henry Foreman",
      role: "Partner",
      company: "FMX Urban Property Advisory",
      image: "/testimonials/henry-foreman.jpg"
    }
  ];

  return (
    <div className="col-span-full my-12">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-600 via-violet-700 to-purple-800 p-8 md:p-12 shadow-2xl">
        {/* Background decoration */}
        <div className="absolute top-0 right-0 -mt-4 -mr-4 h-40 w-40 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute bottom-0 left-0 -mb-4 -ml-4 h-40 w-40 rounded-full bg-white/10 blur-3xl" />

        <div className="relative z-10 max-w-4xl mx-auto text-center">
          {/* Icon */}
          <div className="inline-flex items-center justify-center w-16 h-16 mb-6 rounded-full bg-white/20 backdrop-blur-sm">
            <Sparkles className="w-8 h-8 text-white" />
          </div>

          {/* Heading */}
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Unlock 3,500+ more verified requirements
          </h2>

          {/* Subheading */}
          <p className="text-lg md:text-xl text-white/90 mb-6 max-w-2xl mx-auto">
            Upgrade to pro and get unlimited access to all property requirements, advanced search filters, and our site feasibility tools.
          </p>

          {/* CTA Button - Below Subheading */}
          <Button
            onClick={onUpgradeClick}
            size="lg"
            className="bg-white text-violet-700 hover:bg-gray-50 font-semibold px-8 py-6 text-lg rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 group mb-2"
          >
            {user ? 'Upgrade to pro' : 'Start free trial'}
            <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </Button>

          {!user && (
            <p className="text-sm text-white/70 mb-8">
              Cancel anytime
            </p>
          )}

          {user && (
            <div className="mb-8" />
          )}

          {/* Benefits */}
          <div className="grid md:grid-cols-3 gap-4 mb-8 text-left">
            <div className="flex items-start gap-3 bg-white/10 backdrop-blur-sm rounded-lg p-4">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-white/20 flex items-center justify-center mt-0.5">
                <Check className="w-4 h-4 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-white mb-1">Full Access</h3>
                <p className="text-sm text-white/80">Browse all verified listings with detailed requirements</p>
              </div>
            </div>

            <div className="flex items-start gap-3 bg-white/10 backdrop-blur-sm rounded-lg p-4">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-white/20 flex items-center justify-center mt-0.5">
                <Check className="w-4 h-4 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-white mb-1">Advanced Filters</h3>
                <p className="text-sm text-white/80">Search by location, sector, size, and more</p>
              </div>
            </div>

            <div className="flex items-start gap-3 bg-white/10 backdrop-blur-sm rounded-lg p-4">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-white/20 flex items-center justify-center mt-0.5">
                <Check className="w-4 h-4 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-white mb-1">Contact Details</h3>
                <p className="text-sm text-white/80">Get direct access to decision makers</p>
              </div>
            </div>
          </div>

          {/* Testimonials */}
          <div className="grid md:grid-cols-2 gap-4 mb-8">
            {testimonials.map((testimonial, index) => (
              <div key={index} className="bg-white/10 backdrop-blur-sm rounded-lg p-4 text-left">
                <Quote className="w-6 h-6 text-white/60 mb-2" />
                <p className="text-white/90 text-sm mb-4 italic">
                  "{testimonial.quote}"
                </p>
                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full overflow-hidden relative">
                    <Image
                      src={testimonial.image}
                      alt={testimonial.author}
                      width={40}
                      height={40}
                      className="object-cover"
                    />
                  </div>
                  <div>
                    <div className="font-semibold text-white text-sm">{testimonial.author}</div>
                    <div className="text-white/70 text-xs">{testimonial.role}, {testimonial.company}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

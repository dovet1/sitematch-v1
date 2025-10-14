'use client';

import { Star } from 'lucide-react';

export function Testimonials() {
  const testimonials = [
    {
      quote: "With SiteMatcher I can see the market in seconds. Searching and filtering is straightforward, contacts are right there, and the flyers give me the detail when I need it. It's easily the fastest way I've found to spot real opportunities.",
      author: "Kerry Northfold",
      role: "Director & Advisor",
      company: "Vedra Property Group & Property Managers Association",
      rating: 5,
    },
    {
      quote: "SiteMatcher shows me who's active and exactly what they're looking for. I get contacts instantly, and if I want to test an idea, SiteSketcher lets me draw a quick feasibility in minutes. It's straightforward, simple, and saves a huge amount of time.",
      author: "Henry Foreman",
      role: "Partner",
      company: "FMX Urban Property Advisory",
      rating: 5,
    },
  ];

  return (
    <section className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-6">
        {/* Header */}
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            Loved by property professionals
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Join hundreds of professionals closing more deals with SiteMatcher
          </p>
        </div>

        {/* Testimonials Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          {testimonials.map((testimonial, index) => (
            <div
              key={index}
              className="bg-gradient-to-br from-slate-50 to-white rounded-2xl p-8 border border-gray-200 hover:shadow-xl transition-all duration-300"
            >
              {/* Stars */}
              <div className="flex gap-1 mb-4">
                {[...Array(testimonial.rating)].map((_, i) => (
                  <Star key={i} className="w-5 h-5 text-yellow-400 fill-current" />
                ))}
              </div>

              {/* Quote */}
              <blockquote className="text-gray-700 mb-6 leading-relaxed">
                "{testimonial.quote}"
              </blockquote>

              {/* Author */}
              <div className="flex items-center gap-4">
                <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-violet-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-lg">
                  {testimonial.author.split(' ')[0][0]}{testimonial.author.split(' ')[1][0]}
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-gray-900">{testimonial.author}</p>
                  <p className="text-sm text-gray-600">{testimonial.role}</p>
                  <p className="text-sm text-gray-500">{testimonial.company}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

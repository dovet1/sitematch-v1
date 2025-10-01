'use client';

import { Star } from 'lucide-react';

export function Testimonials() {
  const testimonials = [
    {
      quote: "SiteMatcher helped us secure 3 new tenants in our first month. The quality of leads is outstanding.",
      author: "Sarah Chen",
      role: "Portfolio Manager",
      company: "Urban Developments",
      rating: 5,
    },
    {
      quote: "Finally, a platform that connects us directly with occupiers. No more wasted time on unqualified leads.",
      author: "James Wilson",
      role: "Commercial Agent",
      company: "Wilson Property Group",
      rating: 5,
    },
    {
      quote: "The verification process means we only see serious requirements. It's saved us countless hours.",
      author: "Emma Rodriguez",
      role: "Development Director",
      company: "Landmark Estates",
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
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
                <div className="w-12 h-12 bg-gradient-to-br from-violet-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-lg">
                  {testimonial.author.split(' ')[0][0]}{testimonial.author.split(' ')[1][0]}
                </div>
                <div>
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

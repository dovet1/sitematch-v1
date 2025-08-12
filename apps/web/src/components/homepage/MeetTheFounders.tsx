'use client';

import { Building, Code } from 'lucide-react';

export function MeetTheFounders() {
  const founders = [
    {
      name: 'Rob',
      role: 'Co-Founder & CEO',
      background: 'Property Acquisition Expert',
      description: 'As a former Property Director at Aldi and Head of Acquisitions at Marks & Spencer, Rob knows the impact of getting property requirements in front of the right audience. He set out to build a simple, fast, and targeted platform that helps the industry to close deals and bring exceptional spaces to life.',
      expertise: ['Commercial Property', 'Retail Expansion', 'Location Strategy', 'Market Analysis'],
      linkedin: '#',
      photo: null,
    },
    {
      name: 'Tom',
      role: 'Co-Founder & CTO',
      background: 'Technology & Product Development',
      description: 'As CTO and co-founder, Tom draws on his background in software engineering, product management, and operations to build a platform that delivers real results for commercial occupiers. He’s worked on B2B and B2C products and advised VC firms on technical due diligence, backing businesses ready to scale.',
      expertise: ['Full-Stack Development', 'Product Strategy', 'Platform Architecture', 'PropTech Innovation'],
      linkedin: '#',
      photo: null,
    },
  ];

  return (
    <section className="founders py-20 bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="founders__container max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="founders__title text-3xl font-bold text-gray-800 mb-4">
            Meet Our Founders
          </h2>
          <p className="founders__subtitle text-lg text-gray-600 max-w-3xl mx-auto">
            Combining years of hands-on property experience with in-house web development, we simplify connections across the property industry to make deals happen
          </p>
        </div>

        {/* Founder Profiles */}
        <div className="founders__grid grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 mb-16">
          {founders.map((founder, index) => (
            <div 
              key={index}
              className="founders__card bg-white rounded-3xl p-6 md:p-8 lg:p-10 text-center shadow-lg hover:shadow-xl hover:-translate-y-2 transition-all duration-300 border border-gray-100"
            >
              {/* Photo Placeholder */}
              <div className="founders__photo w-24 h-24 md:w-32 md:h-32 mx-auto mb-4 md:mb-6 bg-gradient-to-br from-violet-500 to-orange-500 rounded-full flex items-center justify-center shadow-lg">
                {index === 0 ? (
                  <Building className="w-8 h-8 md:w-12 md:h-12 text-white" />
                ) : (
                  <Code className="w-8 h-8 md:w-12 md:h-12 text-white" />
                )}
              </div>

              {/* Founder Details */}
              <h3 className="founders__name text-xl md:text-2xl font-bold text-gray-800 mb-2">
                {founder.name}
              </h3>
              <p className="founders__role text-base md:text-lg font-semibold text-violet-600 mb-2">
                {founder.role}
              </p>
              <p className="founders__background text-xs md:text-sm text-gray-600 mb-4 md:mb-6 font-medium">
                {founder.background}
              </p>

              {/* Description */}
              <p className="founders__description text-sm md:text-base text-gray-700 leading-relaxed">
                {founder.description}
              </p>
            </div>
          ))}
        </div>

      </div>

      <style jsx>{`
        @media (max-width: 1024px) {
          .founders__grid {
            grid-template-columns: 1fr;
            gap: 32px;
          }
        }
        
        @media (max-width: 768px) {
          .founders {
            padding: 48px 0;
          }
          
          .founders__title {
            font-size: 24px;
            margin-bottom: 16px;
          }
          
          .founders__card {
            padding: 32px 24px;
          }
          
          .founders__photo {
            width: 100px;
            height: 100px;
          }
          
          .founders__values {
            gap: 16px;
          }
        }
      `}</style>
    </section>
  );
}
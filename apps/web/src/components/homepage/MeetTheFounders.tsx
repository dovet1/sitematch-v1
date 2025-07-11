'use client';

import { ExternalLink, Building, Code, Linkedin } from 'lucide-react';

export function MeetTheFounders() {
  const founders = [
    {
      name: 'Rob',
      role: 'Co-Founder & Property Expert',
      background: 'Property Acquisition Specialist',
      description: 'With over 8 years in commercial property acquisition, Rob has worked with major retailers, restaurant chains, and growing businesses to secure prime locations across the UK. His deep understanding of the challenges occupiers face when finding space led to the creation of SiteMatch.',
      expertise: ['Commercial Property', 'Retail Expansion', 'Location Strategy', 'Market Analysis'],
      linkedin: '#',
      photo: null,
    },
    {
      name: 'Tom',
      role: 'Co-Founder & CTO',
      background: 'Technology & Product Development',
      description: 'A full-stack developer and technology strategist with 10+ years building scalable platforms. Tom previously led development teams at fintech and proptech startups, bringing deep expertise in creating user-centric solutions for complex business challenges.',
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
            Combining deep property market expertise with cutting-edge technology to solve 
            real challenges in commercial property matching.
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
              <p className="founders__description text-sm md:text-base text-gray-700 leading-relaxed mb-4 md:mb-6">
                {founder.description}
              </p>

              {/* Expertise Tags */}
              <div className="founders__expertise flex flex-wrap justify-center gap-2 mb-4 md:mb-6">
                {founder.expertise.map((skill, skillIndex) => (
                  <span 
                    key={skillIndex}
                    className="px-2 md:px-3 py-1 bg-violet-100 text-violet-700 rounded-full text-xs md:text-sm font-medium border border-violet-200"
                  >
                    {skill}
                  </span>
                ))}
              </div>

              {/* LinkedIn Link */}
              <a
                href={founder.linkedin}
                className="founders__linkedin inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors duration-200 text-sm md:text-base"
                aria-label={`View ${founder.name}'s LinkedIn profile`}
              >
                <Linkedin className="w-4 h-4" />
                <span className="hidden sm:inline">Connect on LinkedIn</span>
                <span className="sm:hidden">LinkedIn</span>
              </a>
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
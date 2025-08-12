'use client';

import { FileText, Shield, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function HowItWorks() {
  const steps = [
    {
      icon: FileText,
      title: 'Put your needs on the map - literally',
      description: 'Post your site and location requirements—searchable, filterable, and ready to be discovered by the property industry. Get seen, get shortlisted, and get ahead when the right opportunities land.',
    },
    {
      icon: Shield,
      title: 'Free to view - no barriers',
      description: 'Requirements are visible to everyone, with no paywalls, no hidden fees, and no restrictions. Maximum exposure, zero cost.',
    },
    {
      icon: Users,
      title: 'Tools that drive daily visitors',
      description: 'We offer powerful, no-cost tools like SiteSketcher—a fast, intuitive way to create site feasibility drawings. This attracts hundreds of agents, landlords, developers, and occupiers who use it to sketch ideas, assess potential, and share concepts.',
    },
  ];

  return (
    <section className="how-it-works py-20 bg-white">
      <div className="how-it-works__container max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="how-it-works__title text-3xl font-bold text-gray-800 mb-4">
            How It Works
          </h2>
          <p className="text-lg text-gray-600">
            Are you buying or leasing sites?
          </p>
        </div>

        <div className="how-it-works__steps grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12 relative mb-8 md:mb-12">
          {/* Connector lines for desktop */}
          <div className="hidden md:block absolute top-15 left-1/3 w-1/3 h-0.5 bg-gradient-to-r from-violet-500 to-orange-500 transform -translate-x-1/2"></div>
          <div className="hidden md:block absolute top-15 left-2/3 w-1/3 h-0.5 bg-gradient-to-r from-violet-500 to-orange-500 transform -translate-x-1/2"></div>

          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <div key={index} className="how-it-works__step text-center relative">
                <div 
                  className="how-it-works__step-icon w-24 h-24 md:w-30 md:h-30 mx-auto mb-4 md:mb-6 bg-gradient-to-br from-violet-500 to-purple-600 rounded-full flex items-center justify-center relative shadow-lg shadow-violet-500/30"
                  data-step={index + 1}
                >
                  <div className="absolute -top-1 -right-1 md:-top-2 md:-right-2 w-6 h-6 md:w-8 md:h-8 bg-orange-500 rounded-full flex items-center justify-center text-white font-bold text-xs md:text-sm">
                    {index + 1}
                  </div>
                  <Icon className="w-6 h-6 md:w-8 md:h-8 text-white" />
                </div>
                
                <h3 className="how-it-works__step-title text-lg md:text-xl font-semibold text-gray-800 mb-3 md:mb-4">
                  {step.title}
                </h3>
                <p className="how-it-works__step-description text-sm md:text-base text-gray-600 leading-relaxed max-w-sm mx-auto px-4 md:px-0">
                  {step.description}
                </p>
              </div>
            );
          })}
        </div>

        <div className="text-center">
          <Button 
            asChild 
            className="bg-violet-600 hover:bg-violet-700 text-white px-8 py-3 text-lg font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all duration-200"
          >
            <a href="/occupier/create-listing?fresh=true">
              Post Your Requirement
            </a>
          </Button>
        </div>
      </div>

      <style jsx>{`
        .how-it-works__step-icon {
          width: 120px;
          height: 120px;
        }
        
        @media (max-width: 768px) {
          .how-it-works {
            padding: 48px 0;
          }
          
          .how-it-works__title {
            font-size: 24px;
            margin-bottom: 32px;
          }
          
          .how-it-works__step-icon {
            width: 100px;
            height: 100px;
          }
          
          .how-it-works__steps {
            gap: 32px;
          }
        }
      `}</style>
    </section>
  );
}
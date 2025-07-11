'use client';

import { FileText, Shield, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function HowItWorks() {
  const steps = [
    {
      icon: FileText,
      title: 'Post Requirement',
      description: 'Share your specific commercial property needs including location, size, budget, and timing requirements.',
    },
    {
      icon: Shield,
      title: 'Admin Review',
      description: 'Our team reviews and verifies your requirement to ensure quality and authenticity for all users.',
    },
    {
      icon: Users,
      title: 'Landlords Contact You',
      description: 'Qualified property owners and agents reach out directly with suitable options that match your needs.',
    },
  ];

  return (
    <section className="how-it-works py-20 bg-white">
      <div className="how-it-works__container max-w-7xl mx-auto px-6">
        <h2 className="how-it-works__title text-3xl font-bold text-gray-800 text-center mb-16">
          How It Works
        </h2>

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
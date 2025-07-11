'use client';

import { ArrowRight, Clock, Shield, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function EnhancedCTA() {
  return (
    <section className="additional-cta py-20 bg-gradient-to-br from-violet-600 to-purple-700 text-white text-center">
      <div className="additional-cta__container max-w-4xl mx-auto px-6">
        <h2 className="additional-cta__headline text-2xl md:text-3xl lg:text-4xl font-bold mb-4 leading-tight">
          Ready to Find Your Perfect Commercial Space?
        </h2>
        <p className="additional-cta__subtitle text-base md:text-lg lg:text-xl opacity-90 mb-8 md:mb-10 leading-relaxed px-4 md:px-0">
          Join thousands of businesses who have successfully connected through SiteMatch. 
          Post your requirement today and get responses from qualified landlords within 72 hours.
        </p>

        <div className="additional-cta__buttons flex flex-col sm:flex-row gap-4 md:gap-6 justify-center mb-6 md:mb-8 px-4 md:px-0">
          <Button 
            asChild 
            className="additional-cta__button additional-cta__button--primary bg-white text-violet-700 hover:bg-gray-50 px-6 md:px-8 py-3 md:py-4 text-base md:text-lg font-semibold rounded-xl shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all duration-300 w-full sm:w-auto"
          >
            <a href="/occupier/create-listing?fresh=true" className="flex items-center justify-center gap-2">
              <span>Post Your Requirement</span>
              <ArrowRight className="w-4 h-4 md:w-5 md:h-5" />
            </a>
          </Button>
          
          <Button 
            asChild 
            variant="outline"
            className="additional-cta__button additional-cta__button--secondary bg-transparent text-white border-2 border-white/30 hover:bg-white/10 hover:border-white/50 px-6 md:px-8 py-3 md:py-4 text-base md:text-lg font-semibold rounded-xl hover:-translate-y-1 transition-all duration-300 w-full sm:w-auto"
          >
            <a href="/search" className="flex items-center justify-center gap-2">
              <span>Browse Requirements</span>
              <ArrowRight className="w-4 h-4 md:w-5 md:h-5" />
            </a>
          </Button>
        </div>

        <div className="additional-cta__features flex flex-col md:flex-row justify-center gap-4 md:gap-8 opacity-90 px-4 md:px-0">
          <div className="additional-cta__feature flex items-center justify-center gap-2 text-xs md:text-sm">
            <Clock className="w-4 h-4 text-orange-400 flex-shrink-0" />
            <span>72hr average response time</span>
          </div>
          <div className="additional-cta__feature flex items-center justify-center gap-2 text-xs md:text-sm">
            <Shield className="w-4 h-4 text-orange-400 flex-shrink-0" />
            <span>Verified users only</span>
          </div>
          <div className="additional-cta__feature flex items-center justify-center gap-2 text-xs md:text-sm">
            <Zap className="w-4 h-4 text-orange-400 flex-shrink-0" />
            <span>No fees or hidden costs</span>
          </div>
        </div>
      </div>

      <style jsx>{`
        @media (max-width: 768px) {
          .additional-cta {
            padding: 48px 0;
          }
          
          .additional-cta__headline {
            font-size: 28px;
          }
          
          .additional-cta__subtitle {
            font-size: 18px;
            margin-bottom: 32px;
          }
          
          .additional-cta__buttons {
            flex-direction: column;
            align-items: center;
          }
          
          .additional-cta__button {
            min-width: 240px;
            justify-content: center;
          }
          
          .additional-cta__features {
            flex-direction: column;
            gap: 16px;
          }
        }
      `}</style>
    </section>
  );
}
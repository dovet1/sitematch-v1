'use client';

import { Building, Search, Globe, TrendingUp, Users, CheckCircle } from 'lucide-react';
import { useIntersectionObserver } from '@/hooks/useIntersectionObserver';

export function ValueProposition() {
  const { ref, isIntersecting } = useIntersectionObserver({ threshold: 0.2 });

  return (
    <section 
      ref={ref}
      className={`py-20 bg-background transition-all duration-1000 ${
        isIntersecting ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
      }`}
    >
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-16">
          <h2 className="heading-2 font-bold text-foreground mb-4">
            Connect Property Requirements with Perfect Opportunities
          </h2>
          <p className="body-large text-muted-foreground max-w-3xl mx-auto">
            SiteMatch bridges the gap between property seekers and requirement listers, 
            creating a transparent marketplace for commercial property needs across the UK.
          </p>
        </div>

        {/* Benefits Grid */}
        <div className="grid md:grid-cols-2 gap-12 lg:gap-16">
          {/* For Property Seekers */}
          <div className="space-y-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-primary-50 rounded-lg flex items-center justify-center">
                <Search className="w-6 h-6 text-primary-600" />
              </div>
              <h3 className="heading-3 font-semibold text-foreground">
                For Property Seekers
              </h3>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-primary-600 mt-1 flex-shrink-0" />
                <div>
                  <h4 className="body-large font-medium text-foreground mb-1">
                    Access Hidden Opportunities
                  </h4>
                  <p className="body-small text-muted-foreground">
                    Discover requirements that aren't publicly advertised, giving you first access to potential deals.
                  </p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-primary-600 mt-1 flex-shrink-0" />
                <div>
                  <h4 className="body-large font-medium text-foreground mb-1">
                    Intelligent Matching
                  </h4>
                  <p className="body-small text-muted-foreground">
                    Advanced filters help you find requirements that match your property portfolio perfectly.
                  </p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-primary-600 mt-1 flex-shrink-0" />
                <div>
                  <h4 className="body-large font-medium text-foreground mb-1">
                    Direct Contact
                  </h4>
                  <p className="body-small text-muted-foreground">
                    Connect directly with decision-makers, cutting through intermediaries and closing deals faster.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* For Requirement Listers */}
          <div className="space-y-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-secondary-50 rounded-lg flex items-center justify-center">
                <Building className="w-6 h-6 text-secondary-600" />
              </div>
              <h3 className="heading-3 font-semibold text-foreground">
                For Requirement Listers
              </h3>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-primary-600 mt-1 flex-shrink-0" />
                <div>
                  <h4 className="body-large font-medium text-foreground mb-1">
                    Wider Market Reach
                  </h4>
                  <p className="body-small text-muted-foreground">
                    Expose your requirements to a network of active property professionals across the UK.
                  </p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-primary-600 mt-1 flex-shrink-0" />
                <div>
                  <h4 className="body-large font-medium text-foreground mb-1">
                    Free to List
                  </h4>
                  <p className="body-small text-muted-foreground">
                    No upfront costs or subscription fees. List your requirements and only pay when you find success.
                  </p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-primary-600 mt-1 flex-shrink-0" />
                <div>
                  <h4 className="body-large font-medium text-foreground mb-1">
                    Quality Leads
                  </h4>
                  <p className="body-small text-muted-foreground">
                    Connect with serious property professionals who have the right opportunities for your needs.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Bar */}
        <div className="mt-16 pt-12 border-t border-border">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <TrendingUp className="w-5 h-5 text-primary-600" />
                <span className="heading-3 font-bold text-primary-600">500+</span>
              </div>
              <p className="body-small text-muted-foreground">Active Requirements</p>
            </div>
            
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Users className="w-5 h-5 text-primary-600" />
                <span className="heading-3 font-bold text-primary-600">200+</span>
              </div>
              <p className="body-small text-muted-foreground">Registered Companies</p>
            </div>
            
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Globe className="w-5 h-5 text-primary-600" />
                <span className="heading-3 font-bold text-primary-600">UK-wide</span>
              </div>
              <p className="body-small text-muted-foreground">Coverage</p>
            </div>
            
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <CheckCircle className="w-5 h-5 text-primary-600" />
                <span className="heading-3 font-bold text-primary-600">Daily</span>
              </div>
              <p className="body-small text-muted-foreground">Updates</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
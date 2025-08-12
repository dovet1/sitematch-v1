'use client';

import { useEffect, useState } from 'react';
import { Building, Users, MapPin, TrendingUp, Shield, Clock } from 'lucide-react';

export function TrustIndicators() {
  const [stats, setStats] = useState({
    activeRequirements: 0,
    companies: 0,
    matchesMade: 0,
    locations: 0,
  });

  // Simulate loading real stats (in future this would be an API call)
  useEffect(() => {
    // Animate numbers counting up
    const timer = setTimeout(() => {
      setStats({
        activeRequirements: 500,
        companies: 200,
        matchesMade: 150,
        locations: 50,
      });
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  const featuredCompanies = [
    { name: 'TechCorp Solutions', logo: null },
    { name: 'Retail Dynamics', logo: null },
    { name: 'Urban Manufacturing', logo: null },
    { name: 'Logistics Plus', logo: null },
    { name: 'Creative Spaces', logo: null },
    { name: 'Healthcare Properties', logo: null },
  ];

  return (
    <section className="py-20 bg-muted/30">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-16">
          <h2 className="heading-2 font-bold text-foreground mb-4">
            Trusted by Leading Companies
          </h2>
          <p className="body-large text-muted-foreground max-w-2xl mx-auto">
            Join hundreds of businesses who trust SiteMatcher to connect them with the right property opportunities.
          </p>
        </div>

        {/* Key Statistics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-16">
          <div className="text-center">
            <div className="w-16 h-16 bg-primary-50 rounded-lg flex items-center justify-center mx-auto mb-4">
              <Building className="w-8 h-8 text-primary-600" />
            </div>
            <div className="text-3xl font-bold text-primary-600 mb-2">
              {stats.activeRequirements.toLocaleString()}+
            </div>
            <p className="text-muted-foreground">Active Requirements</p>
          </div>

          <div className="text-center">
            <div className="w-16 h-16 bg-green-50 rounded-lg flex items-center justify-center mx-auto mb-4">
              <Users className="w-8 h-8 text-green-600" />
            </div>
            <div className="text-3xl font-bold text-green-600 mb-2">
              {stats.companies.toLocaleString()}+
            </div>
            <p className="text-muted-foreground">Registered Companies</p>
          </div>

          <div className="text-center">
            <div className="w-16 h-16 bg-blue-50 rounded-lg flex items-center justify-center mx-auto mb-4">
              <TrendingUp className="w-8 h-8 text-blue-600" />
            </div>
            <div className="text-3xl font-bold text-blue-600 mb-2">
              {stats.matchesMade.toLocaleString()}+
            </div>
            <p className="text-muted-foreground">Successful Matches</p>
          </div>

          <div className="text-center">
            <div className="w-16 h-16 bg-purple-50 rounded-lg flex items-center justify-center mx-auto mb-4">
              <MapPin className="w-8 h-8 text-purple-600" />
            </div>
            <div className="text-3xl font-bold text-purple-600 mb-2">
              {stats.locations.toLocaleString()}+
            </div>
            <p className="text-muted-foreground">UK Locations</p>
          </div>
        </div>

        {/* Trust Badges */}
        <div className="flex flex-wrap justify-center items-center gap-8 mb-16">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock className="w-5 h-5" />
            <span className="text-sm font-medium">Updated Daily</span>
          </div>
          
          <div className="flex items-center gap-2 text-muted-foreground">
            <Shield className="w-5 h-5" />
            <span className="text-sm font-medium">Verified Companies</span>
          </div>
          
          <div className="flex items-center gap-2 text-muted-foreground">
            <Building className="w-5 h-5" />
            <span className="text-sm font-medium">UK Commercial Property</span>
          </div>
        </div>

        {/* Featured Companies */}
        <div className="text-center">
          <h3 className="heading-4 font-semibold text-foreground mb-8">
            Featured Companies
          </h3>
          
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
            {featuredCompanies.map((company, index) => (
              <div
                key={index}
                className="bg-background rounded-lg p-6 border border-border hover:shadow-sm transition-shadow"
              >
                {/* Placeholder for company logo */}
                <div className="w-12 h-12 bg-muted rounded-lg flex items-center justify-center mx-auto mb-3">
                  <Building className="w-6 h-6 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium text-foreground text-center">
                  {company.name}
                </p>
              </div>
            ))}
          </div>
          
          <p className="text-sm text-muted-foreground mt-6">
            And hundreds more companies across retail, manufacturing, logistics, and office sectors.
          </p>
        </div>

        {/* Security Notice */}
        <div className="mt-16 bg-background rounded-lg p-6 border border-border">
          <div className="flex items-start gap-4">
            <Shield className="w-6 h-6 text-primary-600 mt-1 flex-shrink-0" />
            <div>
              <h4 className="font-semibold text-foreground mb-2">
                Security & Privacy
              </h4>
              <p className="text-sm text-muted-foreground">
                All company information is verified and contact details are protected. 
                We maintain strict data privacy standards and only share information with legitimate property inquiries.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
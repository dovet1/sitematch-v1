'use client';

import { ArrowRight, Building, Search, Star, Users } from 'lucide-react';
import Link from 'next/link';

export function HomeCTA() {
  return (
    <section className="py-20 bg-gradient-to-br from-primary-600 to-primary-700">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="heading-2 font-bold text-white mb-4">
            Ready to Find Your Perfect Match?
          </h2>
          <p className="body-large text-primary-100 max-w-2xl mx-auto">
            Join the growing community of property professionals who are making smarter connections through SiteMatch.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-6xl mx-auto">
          {/* For Property Seekers */}
          <div className="bg-white rounded-xl p-8 shadow-lg">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-primary-50 rounded-lg flex items-center justify-center">
                <Search className="w-6 h-6 text-primary-600" />
              </div>
              <h3 className="heading-3 font-bold text-foreground">
                For Property Seekers
              </h3>
            </div>
            
            <div className="space-y-4 mb-8">
              <div className="flex items-center gap-3">
                <Star className="w-5 h-5 text-primary-600" />
                <span className="text-foreground">Access exclusive requirements</span>
              </div>
              <div className="flex items-center gap-3">
                <Star className="w-5 h-5 text-primary-600" />
                <span className="text-foreground">Connect directly with decision-makers</span>
              </div>
              <div className="flex items-center gap-3">
                <Star className="w-5 h-5 text-primary-600" />
                <span className="text-foreground">Advanced search and filtering</span>
              </div>
            </div>

            <div className="space-y-3">
              <Link
                href="#hero-search"
                className="w-full inline-flex items-center justify-center px-6 py-3 bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700 transition-colors group"
              >
                Start Searching Now
                <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
              </Link>
              
              <p className="text-sm text-muted-foreground text-center">
                Popular searches: <span className="font-medium">Retail units, Office space, Warehouses</span>
              </p>
            </div>
          </div>

          {/* For Requirement Listers */}
          <div className="bg-white rounded-xl p-8 shadow-lg">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-secondary-50 rounded-lg flex items-center justify-center">
                <Building className="w-6 h-6 text-secondary-600" />
              </div>
              <h3 className="heading-3 font-bold text-foreground">
                For Requirement Listers
              </h3>
            </div>
            
            <div className="space-y-4 mb-8">
              <div className="flex items-center gap-3">
                <Star className="w-5 h-5 text-primary-600" />
                <span className="text-foreground">Free to list your requirements</span>
              </div>
              <div className="flex items-center gap-3">
                <Star className="w-5 h-5 text-primary-600" />
                <span className="text-foreground">Reach nationwide property network</span>
              </div>
              <div className="flex items-center gap-3">
                <Star className="w-5 h-5 text-primary-600" />
                <span className="text-foreground">Quality leads from serious seekers</span>
              </div>
            </div>

            <div className="space-y-3">
              <Link
                href="/occupier/create-listing?fresh=true"
                className="w-full inline-flex items-center justify-center px-6 py-3 bg-secondary-600 text-white rounded-lg font-semibold hover:bg-secondary-700 transition-colors group"
              >
                Post a Requirement
                <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
              </Link>
              
              <p className="text-sm text-muted-foreground text-center">
                No upfront costs • Quick setup • Instant visibility
              </p>
            </div>
          </div>
        </div>

        {/* Bottom Trust Signal */}
        <div className="mt-16 text-center">
          <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-6 py-3">
            <Users className="w-5 h-5 text-white" />
            <span className="text-white font-medium">
              Join 200+ companies already using SiteMatch
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
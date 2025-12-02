'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { MapPin, Building2, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { TrialSignupModal } from '@/components/TrialSignupModal';
import { useAuth } from '@/contexts/auth-context';
import { ListingModal } from '@/components/listings/ListingModal';

interface Listing {
  id: string;
  company_name: string;
  title: string;
  description?: string;
  site_size_min?: number;
  site_size_max?: number;
  listing_type: string;
  sectors?: Array<{ name: string }>;
  place_name?: string;
  logo_url?: string;
  clearbit_logo?: boolean;
  company_domain?: string;
}

export function FeaturedListings() {
  const { user } = useAuth();
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedListingId, setSelectedListingId] = useState<string | null>(null);

  useEffect(() => {
    const fetchFeaturedListings = async () => {
      try {
        // Fetch listings - API will automatically filter to is_featured_free for non-authenticated users
        const response = await fetch('/api/public/listings?limit=8');
        const data = await response.json();
        setListings(data.results || []);
      } catch (error) {
        console.error('Error fetching featured listings:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchFeaturedListings();
  }, []);

  const formatSizeRange = (min?: number, max?: number) => {
    if (!min && !max) return null;
    if (min && max) return `${min.toLocaleString()} - ${max.toLocaleString()} sq ft`;
    if (min) return `${min.toLocaleString()}+ sq ft`;
    if (max) return `Up to ${max.toLocaleString()} sq ft`;
    return null;
  };

  const getLogoUrl = (listing: Listing) => {
    if (listing.logo_url) {
      return listing.logo_url;
    }
    if (listing.clearbit_logo && listing.company_domain) {
      return `https://logo.clearbit.com/${listing.company_domain}`;
    }
    return null;
  };

  const getCompanyInitials = (companyName: string) => {
    return companyName
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  if (loading) {
    return (
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
              Featured Property Requirements
            </h2>
            <p className="text-xl text-gray-600">
              See what companies are actively looking for
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[...Array(8)].map((_, i) => (
              <div
                key={i}
                className="bg-gray-100 rounded-xl h-64 animate-pulse"
              />
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (listings.length === 0) {
    return null;
  }

  return (
    <section className="relative py-16 md:py-24 bg-gradient-to-br from-blue-50 via-indigo-50 to-violet-50 overflow-hidden">
      {/* Decorative elements */}
      <div className="absolute inset-0">
        <div className="absolute top-20 left-10 w-72 h-72 bg-violet-300/20 rounded-full blur-3xl"></div>
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-blue-300/20 rounded-full blur-3xl"></div>
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6">
        {/* Bold header */}
        <div className="mb-12 md:mb-16 max-w-5xl mx-auto">
          <div className="inline-block mb-4 px-4 py-2 bg-blue-100 rounded-full border-2 border-blue-300 rotate-[1deg]">
            <span className="text-sm font-bold text-blue-700 uppercase tracking-wide">Live Examples</span>
          </div>
          <h2 className="text-3xl md:text-5xl lg:text-6xl font-black text-gray-900 mb-4 leading-tight text-center">
            Wondering what this looks like?{' '}
            <span className="relative inline-block">
              <span className="relative z-10">Here are some live requirements</span>
              <span className="absolute inset-0 bg-violet-200 transform skew-y-1 rotate-1"></span>
            </span>
          </h2>
          <p className="text-xl md:text-2xl text-gray-700 font-medium text-center max-w-3xl mx-auto">
            Browse completely free - no sign-up required
          </p>
        </div>

        {/* Listings Grid - Bold card design */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12 md:mb-16">
          {listings.map((listing, index) => {
            const logoUrl = getLogoUrl(listing);
            const sizeRange = formatSizeRange(listing.site_size_min, listing.site_size_max);
            const primarySector = listing.sectors?.[0]?.name;

            return (
              <button
                key={listing.id}
                onClick={() => setSelectedListingId(listing.id)}
                className={`group relative bg-white rounded-3xl p-6 border-2 border-violet-200 hover:border-violet-400 hover:shadow-2xl hover:-translate-y-2 transition-all duration-500 text-left w-full ${
                  index % 4 === 1 ? 'md:mt-6' : index % 4 === 3 ? 'md:mt-8' : ''
                }`}
              >
                {/* Gradient accent corner */}
                <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-violet-200/40 to-transparent rounded-bl-full opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>

                {/* Logo/Company */}
                <div className="relative flex items-center gap-3 mb-4">
                  {logoUrl ? (
                    <div className="w-14 h-14 rounded-xl overflow-hidden bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center flex-shrink-0 shadow-md group-hover:shadow-lg transition-shadow duration-300">
                      <img
                        src={logoUrl}
                        alt={listing.company_name}
                        className="w-full h-full object-contain p-1"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                          if (target.parentElement) {
                            target.parentElement.innerHTML = `<div class="w-full h-full flex items-center justify-center bg-gradient-to-br from-violet-500 to-purple-600 text-white font-bold text-base">${getCompanyInitials(listing.company_name)}</div>`;
                          }
                        }}
                      />
                    </div>
                  ) : (
                    <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white font-bold text-base flex-shrink-0 shadow-md group-hover:shadow-lg group-hover:scale-110 transition-all duration-300">
                      {getCompanyInitials(listing.company_name)}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-black text-gray-900 text-base truncate">
                      {listing.company_name}
                    </h3>
                    {primarySector && (
                      <p className="text-xs text-violet-600 font-semibold truncate">{primarySector}</p>
                    )}
                  </div>
                </div>

                {/* Title with subtle underline */}
                <h4 className="font-bold text-gray-900 mb-4 line-clamp-2 min-h-[3rem] text-base relative">
                  {listing.title}
                  <span className="absolute bottom-0 left-0 w-12 h-1 bg-violet-200 group-hover:w-full transition-all duration-500"></span>
                </h4>

                {/* Details with bold icons */}
                <div className="space-y-2.5 text-sm text-gray-700 font-medium mb-4">
                  {listing.place_name && (
                    <div className="flex items-start gap-2">
                      <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0 text-violet-500" />
                      <span className="line-clamp-1">{listing.place_name}</span>
                    </div>
                  )}
                  {sizeRange && (
                    <div className="flex items-start gap-2">
                      <Building2 className="w-4 h-4 mt-0.5 flex-shrink-0 text-violet-500" />
                      <span>{sizeRange}</span>
                    </div>
                  )}
                </div>

                {/* Bold hover indicator */}
                <div className="mt-4 pt-4 border-t-2 border-violet-100 group-hover:border-violet-300 transition-colors duration-300">
                  <span className="text-sm text-violet-600 font-bold flex items-center gap-1">
                    View details
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-300" />
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Listing Modal */}
        <ListingModal
          listingId={selectedListingId}
          isOpen={!!selectedListingId}
          onClose={() => setSelectedListingId(null)}
        />

        {/* Bold CTA */}
        <div className="text-center">
          {user ? (
            <Button
              asChild
              size="lg"
              className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white px-10 py-7 text-lg md:text-xl font-black rounded-2xl shadow-2xl hover:shadow-violet-500/50 hover:scale-105 transition-all duration-300"
            >
              <Link href="/search">
                View All {listings.length > 8 ? '8,700+' : ''} Requirements
                <ArrowRight className="ml-2 h-5 w-5 md:h-6 md:w-6" />
              </Link>
            </Button>
          ) : (
            <TrialSignupModal context="search" redirectPath="/search">
              <Button
                size="lg"
                className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white px-10 py-7 text-lg md:text-xl font-black rounded-2xl shadow-2xl hover:shadow-violet-500/50 hover:scale-105 transition-all duration-300"
              >
                View All Requirements - Start Free Trial
                <ArrowRight className="ml-2 h-5 w-5 md:h-6 md:w-6" />
              </Button>
            </TrialSignupModal>
          )}
          <p className="text-base md:text-lg text-gray-600 font-semibold mt-5">
            {user ? 'Access our full directory' : '30-day free trial • Cancel anytime'}
          </p>
        </div>
      </div>
    </section>
  );
}

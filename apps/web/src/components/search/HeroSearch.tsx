'use client';

import { useState, useEffect } from 'react';
import { Globe } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { LocationSearch } from './LocationSearch';
import { SearchFilters } from '@/types/search';

interface HeroSearchProps {
  searchFilters?: SearchFilters;
}

export function HeroSearch({ searchFilters }: HeroSearchProps) {
  const router = useRouter();
  const [localLocation, setLocalLocation] = useState(searchFilters?.location || '');
  
  useEffect(() => {
    setLocalLocation(searchFilters?.location || '');
  }, [searchFilters?.location]);

  const handleLocationChange = (location: string) => {
    setLocalLocation(location);
  };

  const handleLocationSelect = (locationData: { name: string; coordinates: { lat: number; lng: number } }) => {
    // Navigate to search page with location parameters
    const params = new URLSearchParams({
      location: locationData.name,
      lat: locationData.coordinates.lat.toString(),
      lng: locationData.coordinates.lng.toString()
    });
    router.push(`/search?${params.toString()}`);
  };

  const handleNationwideSearch = () => {
    // Navigate to search page with nationwide parameter
    // For the home page, always enable nationwide since we're starting fresh
    router.push('/search?nationwide=true');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (localLocation) {
      // If location text exists but wasn't selected from dropdown, navigate with just location text
      const params = new URLSearchParams({ location: localLocation });
      router.push(`/search?${params.toString()}`);
    }
  };

  return (
    <section className="hero-section relative">
      {/* Background Gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary-50 to-primary-100 opacity-50" />
      
      {/* Content */}
      <div className="relative container mx-auto px-4 py-24 text-center">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Hero Title */}
          <h1 className="hero-title text-4xl md:text-5xl lg:text-6xl font-bold text-primary-700 leading-tight tracking-tight">
            Find the perfect match for your site
          </h1>
          
          {/* Subtitle */}
          <p className="body-large text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Discover property requirements from leading companies looking for their next location
          </p>
          
          {/* Search Form */}
          <form onSubmit={handleSubmit} className="max-w-3xl mx-auto">
            <div className="flex flex-col sm:flex-row gap-4">
              {/* Location Search with Nationwide Button */}
              <div className="flex flex-col sm:flex-row gap-4 p-2 bg-white rounded-2xl shadow-lg border border-border flex-1">
                <div className="flex-1">
                  <LocationSearch
                    value={localLocation}
                    onChange={handleLocationChange}
                    onLocationSelect={handleLocationSelect}
                    placeholder="Enter location"
                    className="search-bar w-full h-14 border-0 bg-transparent text-lg placeholder:text-muted-foreground focus:ring-0"
                  />
                </div>
                
                {/* Divider */}
                <div className="hidden sm:block w-px h-14 bg-border self-center" />
                <div className="sm:hidden h-px w-full bg-border" />
                
                {/* Nationwide Button */}
                <Button
                  type="button"
                  variant="ghost"
                  size="lg"
                  onClick={handleNationwideSearch}
                  className="violet-bloom-touch flex items-center gap-2 h-14 px-6 hover:bg-primary-50 transition-colors"
                >
                  <Globe className="w-5 h-5" />
                  <span>Search Nationwide</span>
                </Button>
              </div>
            </div>
          </form>
          
          {/* Quick Stats */}
          <div className="flex justify-center items-center gap-8 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-primary-500 rounded-full" />
              <span>1,200+ Active Requirements</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-success rounded-full" />
              <span>500+ Companies</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-warning rounded-full" />
              <span>Updated Daily</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
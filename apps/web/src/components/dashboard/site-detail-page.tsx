'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { ListingModal } from '@/components/listings/ListingModal';
import { SiteHeaderSection } from './site-report/SiteHeaderSection';
import { RequirementMatchesSection } from './site-report/RequirementMatchesSection';
import { SiteSketchesSection } from './site-report/SiteSketchesSection';
import { SiteAnalysesSection } from './site-report/SiteAnalysesSection';

interface SiteDetailPageProps {
  siteId: string;
  userId: string;
}

interface SavedSearch {
  id: string;
  name: string;
  listing_type?: string;
  location_address?: string;
  sectors?: string[];
  planning_use_classes?: string[];
}

interface Sketch {
  id: string;
  name: string;
  description?: string;
  thumbnail_url?: string;
  created_at: string;
}

interface Analysis {
  id: string;
  name: string;
  location_name: string;
  measurement_mode: string;
  measurement_value: number;
  created_at: string;
}

interface Site {
  id: string;
  name: string;
  address: string;
  location?: { lat: number; lng: number };
  description?: string;
}

export function SiteDetailPage({ siteId, userId }: SiteDetailPageProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [site, setSite] = useState<Site | null>(null);
  const [searches, setSearches] = useState<SavedSearch[]>([]);
  const [sketches, setSketches] = useState<Sketch[]>([]);
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [selectedListingId, setSelectedListingId] = useState<string | null>(null);

  useEffect(() => {
    fetchSiteDetails();
  }, [siteId]);

  const fetchSiteDetails = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/sites/${siteId}`);
      if (!response.ok) throw new Error('Failed to fetch site details');

      const data = await response.json();
      setSite(data.site);
      setSearches(data.site.searches || []);
      setSketches(data.site.sketches || []);
      setAnalyses(data.site.analyses || []);
    } catch (error) {
      console.error('Error fetching site details:', error);
      toast.error('Failed to load site details');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = () => {
    fetchSiteDetails();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-violet-50 via-purple-50 to-pink-50 flex items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-violet-600" />
      </div>
    );
  }

  if (!site) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-violet-50 via-purple-50 to-pink-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Site not found</p>
          <Button onClick={() => router.push('/new-dashboard')}>
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-violet-50 via-purple-50 to-pink-50">
        {/* Header with back button */}
        <div className="bg-white border-b-3 border-violet-200 sticky top-0 z-10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <Button
              variant="ghost"
              onClick={() => router.push('/new-dashboard')}
              className="text-violet-600 hover:text-violet-700 hover:bg-violet-50 font-bold rounded-xl"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-white rounded-3xl border-3 border-violet-200 shadow-xl p-6 md:p-8 space-y-8 md:space-y-12">
            {/* Site Header Section */}
            <SiteHeaderSection
              siteId={siteId}
              name={site.name}
              address={site.address}
              description={site.description}
              location={site.location}
              onUpdate={handleUpdate}
            />

            {/* Divider */}
            <div className="border-t-3 border-gray-200" />

            {/* Requirement Matches Section */}
            <RequirementMatchesSection
              siteId={siteId}
              searches={searches}
              onUpdate={handleUpdate}
              onListingClick={setSelectedListingId}
            />

            {/* Divider */}
            <div className="border-t-3 border-gray-200" />

            {/* Site Sketches Section */}
            <SiteSketchesSection
              siteId={siteId}
              siteName={site.name}
              siteAddress={site.address}
              siteLocation={site.location}
              sketches={sketches}
              onUpdate={handleUpdate}
            />

            {/* Divider */}
            <div className="border-t-3 border-gray-200" />

            {/* Site Analyses Section */}
            <SiteAnalysesSection
              siteId={siteId}
              siteName={site.name}
              siteAddress={site.address}
              siteLocation={site.location}
              analyses={analyses}
              onUpdate={handleUpdate}
            />
          </div>
        </div>
      </div>

      {/* Listing Modal */}
      {selectedListingId && (
        <ListingModal
          listingId={selectedListingId}
          isOpen={!!selectedListingId}
          onClose={() => setSelectedListingId(null)}
        />
      )}
    </>
  );
}

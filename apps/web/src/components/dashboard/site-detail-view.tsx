'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { SiteHeaderSection } from './site-report/SiteHeaderSection';
import { RequirementMatchesSection } from './site-report/RequirementMatchesSection';
import { SiteSketchesSection } from './site-report/SiteSketchesSection';
import { SiteAnalysesSection } from './site-report/SiteAnalysesSection';

interface SiteDetailViewProps {
  siteId: string;
  siteName: string;
  open: boolean;
  onClose: () => void;
  onUpdate?: () => void;
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

export function SiteDetailView({ siteId, siteName, open, onClose, onUpdate }: SiteDetailViewProps) {
  const [loading, setLoading] = useState(true);
  const [site, setSite] = useState<Site | null>(null);
  const [searches, setSearches] = useState<SavedSearch[]>([]);
  const [sketches, setSketches] = useState<Sketch[]>([]);
  const [analyses, setAnalyses] = useState<Analysis[]>([]);

  useEffect(() => {
    if (open) {
      fetchSiteDetails();
    }
  }, [open, siteId]);

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
    onUpdate?.();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] md:max-w-6xl max-h-[95vh] overflow-y-auto p-0">
        {loading ? (
          <div className="flex items-center justify-center py-32">
            <Loader2 className="h-12 w-12 animate-spin text-violet-600" />
          </div>
        ) : site ? (
          <div className="relative">
            {/* Close Button - Fixed position */}
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="absolute top-4 right-4 z-10 rounded-full bg-white/90 backdrop-blur-sm shadow-lg hover:bg-gray-100 border-2 border-gray-200"
            >
              <X className="h-5 w-5" />
            </Button>

            {/* Content with padding */}
            <div className="p-6 md:p-8 space-y-8 md:space-y-12">
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
        ) : (
          <div className="flex items-center justify-center py-32">
            <p className="text-gray-600">Site not found</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

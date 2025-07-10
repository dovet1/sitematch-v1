'use client';

import { useState, useEffect, useRef } from 'react';
import { X, MapPin, Building2, Users, Phone, Mail, Square, Calendar, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SearchResult } from '@/types/search';
import { cn } from '@/lib/utils';

interface ListingModalProps {
  listingId: string | null;
  isOpen: boolean;
  onClose: () => void;
}

export function ListingModal({ listingId, isOpen, onClose }: ListingModalProps) {
  const [listing, setListing] = useState<SearchResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Focus management
  useEffect(() => {
    if (isOpen) {
      previousFocusRef.current = document.activeElement as HTMLElement;
      setTimeout(() => modalRef.current?.focus(), 100);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
      setTimeout(() => previousFocusRef.current?.focus(), 300);
    }
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  // Fetch listing details
  useEffect(() => {
    if (!listingId || !isOpen) {
      setListing(null);
      return;
    }

    const fetchListing = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/public/listings/${listingId}`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch listing details');
        }

        const data = await response.json();
        setListing(data.listing);
      } catch (err) {
        console.error('Error fetching listing details:', err);
        setError('Failed to load listing details');
        
        // Fallback to mock data for development
        const mockListing: SearchResult = {
          id: listingId,
          company_name: 'Demo Company Ltd',
          title: 'Modern Office Space Required - Central Location',
          description: 'We are seeking a modern, flexible office space in a prime central location. The space should accommodate our growing team of 50+ professionals with room for expansion. Key requirements include open-plan areas, meeting rooms, kitchen facilities, and excellent transport links. We value sustainability, natural light, and modern amenities. The ideal space would be move-in ready with high-speed internet infrastructure and professional reception areas.',
          site_size_min: 5000,
          site_size_max: 10000,
          sectors: [{ id: '1', name: 'Technology' }],
          use_classes: [{ id: '1', name: 'Office', code: 'B1' }],
          sector: 'Technology',
          use_class: 'Office (B1)',
          contact_name: 'Sarah Johnson',
          contact_title: 'Property Manager',
          contact_email: 'sarah.johnson@democompany.co.uk',
          contact_phone: '+44 20 1234 5678',
          is_nationwide: false,
          logo_url: null,
          place_name: 'Central London, UK',
          coordinates: { lat: 51.5074, lng: -0.1278 },
          created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days ago
        };
        setListing(mockListing);
      } finally {
        setIsLoading(false);
      }
    };

    fetchListing();
  }, [listingId, isOpen]);

  const formatSizeRange = (min: number | null, max: number | null) => {
    if (!min && !max) return 'Size flexible';
    if (min && max) return `${min.toLocaleString()} - ${max.toLocaleString()} sq ft`;
    if (min) return `From ${min.toLocaleString()} sq ft`;
    if (max) return `Up to ${max.toLocaleString()} sq ft`;
    return '';
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  if (!isOpen || !listingId) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 bg-black/50 backdrop-blur-sm z-50 transition-opacity duration-200",
          isOpen ? "opacity-100" : "opacity-0"
        )}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        className={cn(
          "fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4",
          "transition-all duration-300 ease-out",
          isOpen ? "translate-y-0 opacity-100" : "translate-y-full opacity-0"
        )}
      >
        <div
          ref={modalRef}
          className="w-full max-w-4xl max-h-[90vh] bg-white rounded-t-2xl sm:rounded-2xl shadow-xl overflow-hidden focus:outline-none"
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
          aria-describedby="modal-description"
          tabIndex={-1}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-border bg-white sticky top-0 z-10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
                <Building2 className="w-5 h-5 text-primary-600" />
              </div>
              <div>
                <h2 id="modal-title" className="heading-4 text-foreground">
                  {listing?.company_name || 'Loading...'}
                </h2>
                <p className="text-sm text-muted-foreground">
                  Property Requirement Details
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="violet-bloom-touch"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>

          {/* Content */}
          <div className="overflow-y-auto max-h-[calc(90vh-80px)]">
            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <div className="flex items-center gap-3">
                  <div className="animate-spin w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full" />
                  <span className="text-muted-foreground">Loading listing details...</span>
                </div>
              </div>
            ) : error && !listing ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Building2 className="w-12 h-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-2">{error}</p>
                <p className="text-sm text-muted-foreground">Please try again later</p>
              </div>
            ) : listing ? (
              <div className="p-6 space-y-8">
                {/* Title & Description */}
                <div className="space-y-4">
                  <div>
                    <h3 id="modal-description" className="heading-3 text-foreground mb-2">
                      {listing.title}
                    </h3>
                    <div className="flex flex-wrap items-center gap-2 mb-4">
                      {listing.sector && (
                        <Badge variant="secondary">
                          {listing.sector}
                        </Badge>
                      )}
                      {listing.use_class && (
                        <Badge variant="outline">
                          {listing.use_class}
                        </Badge>
                      )}
                      {listing.is_nationwide && (
                        <Badge className="bg-primary-500 text-primary-foreground">
                          Nationwide Search
                        </Badge>
                      )}
                      <Badge variant="outline" className="text-xs">
                        <Calendar className="w-3 h-3 mr-1" />
                        Posted {formatDate(listing.created_at)}
                      </Badge>
                    </div>
                  </div>
                  
                  <div className="prose prose-sm max-w-none">
                    <p className="text-muted-foreground leading-relaxed">
                      {listing.description}
                    </p>
                  </div>
                </div>

                {/* Key Requirements Grid */}
                <div className="grid md:grid-cols-2 gap-6">
                  {/* Location Requirements */}
                  <div className="space-y-4">
                    <h4 className="heading-4 text-foreground flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-primary-500" />
                      Location Requirements
                    </h4>
                    <div className="space-y-3 text-sm">
                      {listing.place_name && (
                        <div className="flex items-start gap-3">
                          <div className="w-2 h-2 bg-primary-500 rounded-full mt-2 flex-shrink-0" />
                          <div>
                            <span className="font-medium text-foreground">Preferred Location:</span>
                            <p className="text-muted-foreground">{listing.place_name}</p>
                          </div>
                        </div>
                      )}
                      <div className="flex items-start gap-3">
                        <div className="w-2 h-2 bg-primary-500 rounded-full mt-2 flex-shrink-0" />
                        <div>
                          <span className="font-medium text-foreground">Search Scope:</span>
                          <p className="text-muted-foreground">
                            {listing.is_nationwide ? 'Open to locations nationwide' : 'Specific location preferred'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Space Requirements */}
                  <div className="space-y-4">
                    <h4 className="heading-4 text-foreground flex items-center gap-2">
                      <Square className="w-4 h-4 text-primary-500" />
                      Space Requirements
                    </h4>
                    <div className="space-y-3 text-sm">
                      <div className="flex items-start gap-3">
                        <div className="w-2 h-2 bg-primary-500 rounded-full mt-2 flex-shrink-0" />
                        <div>
                          <span className="font-medium text-foreground">Size Range:</span>
                          <p className="text-muted-foreground">{formatSizeRange(listing.site_size_min, listing.site_size_max)}</p>
                        </div>
                      </div>
                      {listing.use_class && (
                        <div className="flex items-start gap-3">
                          <div className="w-2 h-2 bg-primary-500 rounded-full mt-2 flex-shrink-0" />
                          <div>
                            <span className="font-medium text-foreground">Use Class:</span>
                            <p className="text-muted-foreground">{listing.use_class}</p>
                          </div>
                        </div>
                      )}
                      {listing.sector && (
                        <div className="flex items-start gap-3">
                          <div className="w-2 h-2 bg-primary-500 rounded-full mt-2 flex-shrink-0" />
                          <div>
                            <span className="font-medium text-foreground">Business Sector:</span>
                            <p className="text-muted-foreground">{listing.sector}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Contact Information */}
                <div className="bg-primary-50 rounded-lg p-6 space-y-4">
                  <h4 className="heading-4 text-foreground flex items-center gap-2">
                    <Users className="w-4 h-4 text-primary-500" />
                    Contact Information
                  </h4>
                  
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <div>
                        <p className="font-medium text-foreground">{listing.contact_name}</p>
                        {listing.contact_title && (
                          <p className="text-sm text-muted-foreground">{listing.contact_title}</p>
                        )}
                      </div>
                      
                      <div className="space-y-2">
                        {listing.contact_email && (
                          <a 
                            href={`mailto:${listing.contact_email}`}
                            className="flex items-center gap-2 text-sm text-primary-600 hover:text-primary-700 transition-colors"
                          >
                            <Mail className="w-4 h-4" />
                            {listing.contact_email}
                          </a>
                        )}
                        
                        {listing.contact_phone && (
                          <a 
                            href={`tel:${listing.contact_phone}`}
                            className="flex items-center gap-2 text-sm text-primary-600 hover:text-primary-700 transition-colors"
                          >
                            <Phone className="w-4 h-4" />
                            {listing.contact_phone}
                          </a>
                        )}
                      </div>
                    </div>

                    <div className="flex items-end">
                      <div className="space-y-2 w-full">
                        <Button 
                          className="w-full violet-bloom-button"
                          onClick={() => {
                            if (listing.contact_email) {
                              const subject = encodeURIComponent(`Property Enquiry: ${listing.title}`);
                              const body = encodeURIComponent(`Dear ${listing.contact_name},\n\nI am interested in discussing your property requirement for ${listing.title}.\n\nBest regards`);
                              window.open(`mailto:${listing.contact_email}?subject=${subject}&body=${body}`);
                            }
                          }}
                        >
                          <Mail className="w-4 h-4 mr-2" />
                          Send Enquiry
                        </Button>
                        
                        {listing.contact_phone && (
                          <Button 
                            variant="outline" 
                            className="w-full"
                            onClick={() => window.open(`tel:${listing.contact_phone}`)}
                          >
                            <Phone className="w-4 h-4 mr-2" />
                            Call Now
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Additional Information */}
                <div className="border-t border-border pt-6">
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>Listing ID: {listing.id}</span>
                    <span>Posted on {formatDate(listing.created_at)}</span>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </>
  );
}
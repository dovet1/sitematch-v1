'use client';

import { useState, useEffect, useRef } from 'react';
import { 
  X, MapPin, Building2, Users, Phone, Mail, Square, Calendar, 
  ExternalLink, Download, ChevronDown, ChevronUp, ChevronLeft, ChevronRight,
  FileText, Image as ImageIcon, File, User, Home, Zap, Eye
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EnhancedListingModalContent, ListingModalProps } from '@/types/search';
import { cn } from '@/lib/utils';

export function SimplifiedListingModal({ 
  listingId, 
  isOpen, 
  onClose, 
  searchState,
  scrollPosition 
}: ListingModalProps) {
  const [listing, setListing] = useState<EnhancedListingModalContent | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['contacts', 'locations', 'sectors', 'use_classes', 'property_details', 'fit_outs', 'site_plans']));
  const [isClosing, setIsClosing] = useState(false);
  const [logoError, setLogoError] = useState(false);
  const [expandedFAQs, setExpandedFAQs] = useState<Set<string>>(new Set());
  
  const modalRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sectionId)) {
        newSet.delete(sectionId);
      } else {
        newSet.add(sectionId);
      }
      return newSet;
    });
  };

  const toggleFAQ = (faqId: string) => {
    setExpandedFAQs(prev => {
      const newSet = new Set(prev);
      if (newSet.has(faqId)) {
        newSet.delete(faqId);
      } else {
        newSet.add(faqId);
      }
      return newSet;
    });
  };

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
      setIsClosing(false);
    }, 300);
  };

  // Fetch listing data
  useEffect(() => {
    if (!isOpen || !listingId) return;

    const fetchListing = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        const response = await fetch(`/api/public/listings/${listingId}/detailed`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch listing details');
        }

        const data = await response.json();
        setListing(data);
        setLogoError(false); // Reset logo error when new data is loaded
      } catch (err) {
        console.error('Error fetching listing details:', err);
        setError('Failed to load listing details');
      } finally {
        setIsLoading(false);
      }
    };

    fetchListing();
  }, [isOpen, listingId]);

  if (!isOpen || !listingId) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 bg-black/50 backdrop-blur-sm z-[1060] transition-opacity duration-300",
          isOpen && !isClosing ? "opacity-100" : "opacity-0"
        )}
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Modal Container */}
      <div
        className={cn(
          "fixed inset-0 z-[1060] flex items-end md:items-center justify-center p-0 md:p-4",
          "transition-all duration-300 ease-out",
          isOpen && !isClosing ? "translate-y-0 opacity-100" : "translate-y-full opacity-0"
        )}
      >
        {/* Modal Content */}
        <div
          ref={modalRef}
          className={cn(
            "w-full max-w-4xl max-h-[100vh] md:max-h-[90vh] bg-white overflow-hidden focus:outline-none",
            "rounded-t-2xl md:rounded-2xl shadow-xl",
            "flex flex-col"
          )}
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
          aria-describedby="modal-description"
          tabIndex={-1}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 md:p-6 border-b border-border bg-white sticky top-0 z-10 flex-shrink-0">
            <div className="flex items-center gap-3">
              {listing?.company.logo_url && !logoError ? (
                <div className="w-10 h-10 rounded-lg overflow-hidden bg-white border border-gray-200 flex items-center justify-center">
                  <img
                    src={listing.company.logo_url}
                    alt={`${listing.company.name} logo`}
                    className="w-full h-full object-contain"
                    onError={() => setLogoError(true)}
                  />
                </div>
              ) : (
                <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-primary-600" />
                </div>
              )}
              <div>
                <h2 id="modal-title" className="premium-modal-title">
                  {listing?.company.name || 'Loading...'}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {listing?.listing_type === 'residential' ? 'Residential' : 'Commercial'} Property Requirement
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClose}
              className="flex-shrink-0"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>

          {/* Content */}
          <div className="overflow-y-auto flex-1">
            {isLoading ? (
              <div className="p-4 md:p-6 space-y-8">
                <div className="space-y-4">
                  <div className="h-8 bg-gray-200 rounded-md animate-pulse" />
                  <div className="h-4 bg-gray-200 rounded animate-pulse" />
                  <div className="h-4 bg-gray-200 rounded animate-pulse w-4/5" />
                </div>
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full" />
                </div>
              </div>
            ) : error && !listing ? (
              <div className="flex flex-col items-center justify-center py-16 text-center px-4">
                <Building2 className="w-12 h-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-2">{error}</p>
                <p className="text-sm text-muted-foreground">There was a problem loading this listing</p>
              </div>
            ) : listing ? (
              <div className="p-4 md:p-6 space-y-8">
                {/* Hero Section */}
                <div className="bg-gradient-to-r from-primary-50 to-primary-100 rounded-xl p-6 border border-primary-200">
                  <div className="mb-4">
                    <h3 className="heading-3 text-foreground mb-4">
                      Key Details
                    </h3>
                    <div className="space-y-2 mb-3">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-primary-500" />
                        <span className="text-sm font-medium">Listing Type:</span>
                      </div>
                      <div>
                        <Badge variant="outline" className={`text-xs font-medium ${listing.listing_type === 'residential' ? 'bg-white text-emerald-700 border-emerald-300 shadow-sm' : 'bg-white text-red-700 border-red-300 shadow-sm'}`}>
                          {listing.listing_type === 'residential' ? (
                            <>
                              <Home className="w-3 h-3 mr-1" />
                              Residential
                            </>
                          ) : (
                            <>
                              <Building2 className="w-3 h-3 mr-1" />
                              Commercial
                            </>
                          )}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  
                  {/* Quick info based on listing type */}
                  {listing.listing_type === 'commercial' && (
                    <div className="space-y-3 mb-3">
                      {listing.company.sectors && listing.company.sectors.length > 0 && (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Building2 className="w-4 h-4 text-primary-500" />
                            <span className="text-sm font-medium">Sectors:</span>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {listing.company.sectors.slice(0, 3).map((sector, index) => (
                              <Badge key={index} variant="outline" className="bg-blue-50 text-blue-800 border-blue-200 text-xs">
                                {sector}
                              </Badge>
                            ))}
                            {listing.company.sectors.length > 3 && (
                              <Badge variant="outline" className="bg-gray-50 text-gray-600 border-gray-200 text-xs">
                                +{listing.company.sectors.length - 3} more
                              </Badge>
                            )}
                          </div>
                        </div>
                      )}
                      {listing.company.use_classes && listing.company.use_classes.length > 0 && (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Zap className="w-4 h-4 text-primary-500" />
                            <span className="text-sm font-medium">Use Classes:</span>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {listing.company.use_classes.slice(0, 3).map((useClass, index) => (
                              <Badge key={index} variant="outline" className="bg-green-50 text-green-800 border-green-200 text-xs">
                                {useClass}
                              </Badge>
                            ))}
                            {listing.company.use_classes.length > 3 && (
                              <Badge variant="outline" className="bg-gray-50 text-gray-600 border-gray-200 text-xs">
                                +{listing.company.use_classes.length - 3} more
                              </Badge>
                            )}
                          </div>
                        </div>
                      )}
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-primary-500" />
                          <span className="text-sm font-medium">Locations:</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {!Array.isArray(listing.locations?.all) || (listing.locations?.all as any)?.length === 0 ? (
                            <Badge variant="outline" className="bg-orange-50 text-orange-800 border-orange-200 text-xs">
                              <MapPin className="w-3 h-3 mr-1" />
                              Nationwide
                            </Badge>
                          ) : (
                            <>
                              {Array.isArray(listing.locations?.all) && (listing.locations?.all as any)?.slice(0, 3).map((location: any, index: number) => (
                                <Badge key={index} variant="outline" className="bg-purple-50 text-purple-800 border-purple-200 text-xs">
                                  <MapPin className="w-3 h-3 mr-1" />
                                  {location.place_name.split(',').slice(0, 2).join(',').trim()}
                                </Badge>
                              ))}
                              {Array.isArray(listing.locations?.all) && (listing.locations?.all as any)?.length > 3 && (
                                <Badge variant="outline" className="bg-gray-50 text-gray-600 border-gray-200 text-xs">
                                  +{(listing.locations?.all as any).length - 3} more
                                </Badge>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Square className="w-4 h-4 text-primary-500" />
                        <span className="text-sm font-medium">Size:</span>
                        <span className="text-sm text-muted-foreground">{listing.company.site_size}</span>
                      </div>
                    </div>
                  )}
                  
                  {listing.listing_type === 'residential' && (
                    <div className="space-y-3 mb-3">
                      <div className="flex items-center gap-2">
                        <Home className="w-4 h-4 text-primary-500" />
                        <span className="text-sm font-medium">Dwellings:</span>
                        <span className="text-sm text-muted-foreground">{listing.company.dwelling_count}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Square className="w-4 h-4 text-primary-500" />
                        <span className="text-sm font-medium">Site Acreage:</span>
                        <span className="text-sm text-muted-foreground">{listing.company.site_acreage}</span>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-primary-500" />
                          <span className="text-sm font-medium">Locations:</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {!Array.isArray(listing.locations?.all) || (listing.locations?.all as any)?.length === 0 ? (
                            <Badge variant="outline" className="bg-orange-50 text-orange-800 border-orange-200 text-xs">
                              <MapPin className="w-3 h-3 mr-1" />
                              Nationwide
                            </Badge>
                          ) : (
                            <>
                              {Array.isArray(listing.locations?.all) && (listing.locations?.all as any)?.slice(0, 3).map((location: any, index: number) => (
                                <Badge key={index} variant="outline" className="bg-purple-50 text-purple-800 border-purple-200 text-xs">
                                  <MapPin className="w-3 h-3 mr-1" />
                                  {location.place_name.split(',').slice(0, 2).join(',').trim()}
                                </Badge>
                              ))}
                              {Array.isArray(listing.locations?.all) && (listing.locations?.all as any)?.length > 3 && (
                                <Badge variant="outline" className="bg-gray-50 text-gray-600 border-gray-200 text-xs">
                                  +{(listing.locations?.all as any).length - 3} more
                                </Badge>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className="text-xs">
                      <Calendar className="w-3 h-3 mr-1" />
                      Posted {new Date(listing.created_at).toLocaleDateString()}
                    </Badge>
                  </div>
                </div>

                {/* Collapsible Contacts Section */}
                <div className="space-y-4">
                  <button
                    onClick={() => toggleSection('contacts')}
                    className="w-full flex items-center justify-between p-0 text-left hover:text-primary-600 transition-colors"
                  >
                    <h4 className="heading-4 text-foreground flex items-center gap-2 premium-border-accent">
                      <Users className="w-4 h-4 text-primary-500" />
                      Contact Information
                    </h4>
                    {expandedSections.has('contacts') ? (
                      <ChevronUp className="w-5 h-5 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-muted-foreground" />
                    )}
                  </button>
                  
                  {expandedSections.has('contacts') && (
                    <div className="bg-white border border-border rounded-lg p-4 space-y-6">
                      {/* Primary Contact */}
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden">
                          {listing.contacts.primary.headshot_url ? (
                            <img
                              src={listing.contacts.primary.headshot_url}
                              alt={`${listing.contacts.primary.name} headshot`}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.style.display = 'none';
                                target.nextElementSibling?.classList.remove('hidden');
                              }}
                            />
                          ) : null}
                          <div className={`w-full h-full bg-primary-100 rounded-full flex items-center justify-center ${listing.contacts.primary.headshot_url ? 'hidden' : ''}`}>
                            <User className="w-6 h-6 text-primary-600" />
                          </div>
                        </div>
                        <div className="flex-1">
                          <h5 className="font-medium text-foreground">{listing.contacts.primary.name}</h5>
                          {listing.contacts.primary.title && (
                            <p className="text-sm text-muted-foreground mb-1">{listing.contacts.primary.title}</p>
                          )}
                          {listing.contacts.primary.contact_area && (
                            <p className="text-sm text-muted-foreground mb-2">
                              <span className="font-medium">Area:</span> {listing.contacts.primary.contact_area}
                            </p>
                          )}
                          <div className="flex flex-col gap-2">
                            {listing.contacts.primary.email && (
                              <a 
                                href={`mailto:${listing.contacts.primary.email}`}
                                className="flex items-center gap-2 text-sm text-primary-600 hover:text-primary-700 transition-colors"
                              >
                                <Mail className="w-4 h-4" />
                                <span>{listing.contacts.primary.email}</span>
                              </a>
                            )}
                            {listing.contacts.primary.phone && (
                              <a 
                                href={`tel:${listing.contacts.primary.phone}`}
                                className="flex items-center gap-2 text-sm text-primary-600 hover:text-primary-700 transition-colors"
                              >
                                <Phone className="w-4 h-4" />
                                <span>{listing.contacts.primary.phone}</span>
                              </a>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Additional Contacts */}
                      {listing.contacts.additional && listing.contacts.additional.length > 0 && (
                        <>
                          <div className="border-t border-gray-200 pt-4">
                            <h6 className="text-sm font-medium text-muted-foreground mb-4">Additional Contacts</h6>
                            <div className="space-y-4">
                              {listing.contacts.additional.map((contact, index) => (
                                <div key={index} className="flex items-start gap-4">
                                  <div className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden">
                                    {contact.headshot_url ? (
                                      <img
                                        src={contact.headshot_url}
                                        alt={`${contact.name} headshot`}
                                        className="w-full h-full object-cover"
                                        onError={(e) => {
                                          const target = e.target as HTMLImageElement;
                                          target.style.display = 'none';
                                          target.nextElementSibling?.classList.remove('hidden');
                                        }}
                                      />
                                    ) : null}
                                    <div className={`w-full h-full bg-gray-100 rounded-full flex items-center justify-center ${contact.headshot_url ? 'hidden' : ''}`}>
                                      <User className="w-6 h-6 text-gray-600" />
                                    </div>
                                  </div>
                                  <div className="flex-1">
                                    <h5 className="font-medium text-foreground">{contact.name}</h5>
                                    {contact.title && (
                                      <p className="text-sm text-muted-foreground mb-1">{contact.title}</p>
                                    )}
                                    {contact.contact_area && (
                                      <p className="text-sm text-muted-foreground mb-2">
                                        <span className="font-medium">Area:</span> {contact.contact_area}
                                      </p>
                                    )}
                                    <div className="flex flex-col gap-2">
                                      {contact.email && (
                                        <a 
                                          href={`mailto:${contact.email}`}
                                          className="flex items-center gap-2 text-sm text-primary-600 hover:text-primary-700 transition-colors"
                                        >
                                          <Mail className="w-4 h-4" />
                                          <span>{contact.email}</span>
                                        </a>
                                      )}
                                      {contact.phone && (
                                        <a 
                                          href={`tel:${contact.phone}`}
                                          className="flex items-center gap-2 text-sm text-primary-600 hover:text-primary-700 transition-colors"
                                        >
                                          <Phone className="w-4 h-4" />
                                          <span>{contact.phone}</span>
                                        </a>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* Collapsible Locations Section */}
                <div className="space-y-4">
                  <button
                    onClick={() => toggleSection('locations')}
                    className="w-full flex items-center justify-between p-0 text-left hover:text-primary-600 transition-colors"
                  >
                    <h4 className="heading-4 text-foreground flex items-center gap-2 premium-border-accent">
                      <MapPin className="w-4 h-4 text-primary-500" />
                      Location Requirements
                    </h4>
                    {expandedSections.has('locations') ? (
                      <ChevronUp className="w-5 h-5 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-muted-foreground" />
                    )}
                  </button>
                  
                  {expandedSections.has('locations') && (
                    <div className="bg-gray-50 rounded-lg p-4">
                      {!Array.isArray(listing.locations?.all) || (listing.locations?.all as any)?.length === 0 ? (
                        <Badge variant="outline" className="bg-orange-50 text-orange-800 border-orange-200">
                          <MapPin className="w-3 h-3 mr-1" />
                          Nationwide
                        </Badge>
                      ) : (
                        <div className="space-y-2">
                          <h5 className="font-medium text-foreground">Preferred Locations</h5>
                          <div className="flex flex-wrap gap-2">
                            {(listing.locations?.all as any).map((location: any, index: number) => (
                              <Badge key={index} variant="outline" className="bg-primary-50 text-primary-800 border-primary-200">
                                <MapPin className="w-3 h-3 mr-1" />
                                {location.place_name.split(',').slice(0, 2).join(',').trim()}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Collapsible Sectors Section - Commercial only */}
                {listing.listing_type === 'commercial' && listing.company.sectors && listing.company.sectors.length > 0 && (
                  <div className="space-y-4">
                    <button
                      onClick={() => toggleSection('sectors')}
                      className="w-full flex items-center justify-between p-0 text-left hover:text-primary-600 transition-colors"
                    >
                      <h4 className="heading-4 text-foreground flex items-center gap-2 premium-border-accent">
                        <Building2 className="w-4 h-4 text-primary-500" />
                        Sectors of Interest
                      </h4>
                      {expandedSections.has('sectors') ? (
                        <ChevronUp className="w-5 h-5 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-muted-foreground" />
                      )}
                    </button>
                    
                    {expandedSections.has('sectors') && (
                      <div className="bg-gray-50 rounded-lg p-4">
                        <div className="flex flex-wrap gap-2">
                          {listing.company.sectors.map((sector, index) => (
                            <Badge key={index} variant="outline" className="bg-blue-50 text-blue-800 border-blue-200">
                              <Building2 className="w-3 h-3 mr-1" />
                              {sector}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Collapsible Use Classes Section - Commercial only */}
                {listing.listing_type === 'commercial' && listing.company.use_classes && listing.company.use_classes.length > 0 && (
                  <div className="space-y-4">
                    <button
                      onClick={() => toggleSection('use_classes')}
                      className="w-full flex items-center justify-between p-0 text-left hover:text-primary-600 transition-colors"
                    >
                      <h4 className="heading-4 text-foreground flex items-center gap-2 premium-border-accent">
                        <Zap className="w-4 h-4 text-primary-500" />
                        Use Classes
                      </h4>
                      {expandedSections.has('use_classes') ? (
                        <ChevronUp className="w-5 h-5 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-muted-foreground" />
                      )}
                    </button>
                    
                    {expandedSections.has('use_classes') && (
                      <div className="bg-gray-50 rounded-lg p-4">
                        <div className="flex flex-wrap gap-2">
                          {listing.company.use_classes.map((useClass, index) => (
                            <Badge key={index} variant="outline" className="bg-green-50 text-green-800 border-green-200">
                              <Zap className="w-3 h-3 mr-1" />
                              {useClass}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Collapsible Size/Property Details Section */}
                <div className="space-y-4">
                  <button
                    onClick={() => toggleSection('property_details')}
                    className="w-full flex items-center justify-between p-0 text-left hover:text-primary-600 transition-colors"
                  >
                    <h4 className="heading-4 text-foreground flex items-center gap-2 premium-border-accent">
                      <Square className="w-4 h-4 text-primary-500" />
                      {listing.listing_type === 'commercial' ? 'Size Requirements' : 'Property Details'}
                    </h4>
                    {expandedSections.has('property_details') ? (
                      <ChevronUp className="w-5 h-5 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-muted-foreground" />
                    )}
                  </button>
                  
                  {expandedSections.has('property_details') && (
                    <div className="bg-gray-50 rounded-lg p-4">
                      {listing.listing_type === 'commercial' ? (
                        <div className="space-y-3">
                          <div className="flex items-center gap-2">
                            <Square className="w-4 h-4 text-primary-500" />
                            <span className="text-sm font-medium text-foreground">Size:</span>
                            <span className="text-sm text-muted-foreground">{listing.company.site_size}</span>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div className="flex items-center gap-2">
                            <Home className="w-4 h-4 text-primary-500" />
                            <span className="text-sm font-medium text-foreground">Dwellings:</span>
                            <span className="text-sm text-muted-foreground">{listing.company.dwelling_count}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Square className="w-4 h-4 text-primary-500" />
                            <span className="text-sm font-medium text-foreground">Site Acreage:</span>
                            <span className="text-sm text-muted-foreground">{listing.company.site_acreage}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Collapsible FAQs Section */}
                {listing.faqs.length > 0 && (
                  <div className="space-y-4">
                    <button
                      onClick={() => toggleSection('faqs')}
                      className="w-full flex items-center justify-between p-0 text-left hover:text-primary-600 transition-colors"
                    >
                      <h4 className="heading-4 text-foreground premium-border-accent">
                        Frequently Asked Questions
                      </h4>
                      {expandedSections.has('faqs') ? (
                        <ChevronUp className="w-5 h-5 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-muted-foreground" />
                      )}
                    </button>
                    
                    {expandedSections.has('faqs') && (
                      <div className="space-y-2">
                        {listing.faqs.map((faq) => (
                          <div key={faq.id} className="border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow">
                            <button
                              onClick={() => toggleFAQ(faq.id)}
                              className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 transition-colors"
                              aria-expanded={expandedFAQs.has(faq.id)}
                              aria-controls={`faq-${faq.id}`}
                            >
                              <span className="font-medium text-foreground pr-4">
                                {faq.question}
                              </span>
                              <ChevronDown 
                                className={`w-4 h-4 text-muted-foreground transition-transform duration-200 flex-shrink-0 ${
                                  expandedFAQs.has(faq.id) ? 'rotate-180' : ''
                                }`}
                              />
                            </button>
                            
                            <div
                              id={`faq-${faq.id}`}
                              className={`overflow-hidden transition-all duration-300 ease-out ${
                                expandedFAQs.has(faq.id) ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
                              }`}
                            >
                              <div className="px-4 pb-4 pt-0">
                                <p className="text-sm text-muted-foreground leading-relaxed">
                                  {faq.answer}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Collapsible Fit-Out Examples Section */}
                {listing.files?.fit_outs && listing.files.fit_outs.length > 0 && (
                  <div className="space-y-4">
                    <button
                      onClick={() => toggleSection('fit_outs')}
                      className="w-full flex items-center justify-between p-0 text-left hover:text-primary-600 transition-colors"
                    >
                      <h4 className="heading-4 text-foreground flex items-center gap-2 premium-border-accent">
                        <ImageIcon className="w-4 h-4 text-primary-500" />
                        Fit-Out Examples
                      </h4>
                      {expandedSections.has('fit_outs') ? (
                        <ChevronUp className="w-5 h-5 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-muted-foreground" />
                      )}
                    </button>
                    
                    {expandedSections.has('fit_outs') && (
                      <div className="bg-gray-50 rounded-lg p-4">
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                          {listing.files.fit_outs.map((file, index) => (
                            <div key={file.id} className="group">
                              <div className="aspect-square bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow cursor-pointer">
                                {file.url ? (
                                  <img
                                    src={file.url}
                                    alt={file.name || `Fit-out example ${index + 1}`}
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                                    onClick={() => window.open(file.url, '_blank')}
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center">
                                    <ImageIcon className="w-8 h-8 text-gray-400" />
                                  </div>
                                )}
                              </div>
                              {(file as any).caption && (
                                <p className="text-xs text-muted-foreground mt-2 text-center">
                                  {(file as any).caption}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Collapsible Site Plan Examples Section */}
                {listing.files?.site_plans && listing.files.site_plans.length > 0 && (
                  <div className="space-y-4">
                    <button
                      onClick={() => toggleSection('site_plans')}
                      className="w-full flex items-center justify-between p-0 text-left hover:text-primary-600 transition-colors"
                    >
                      <h4 className="heading-4 text-foreground flex items-center gap-2 premium-border-accent">
                        <File className="w-4 h-4 text-primary-500" />
                        Site Plan Examples
                      </h4>
                      {expandedSections.has('site_plans') ? (
                        <ChevronUp className="w-5 h-5 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-muted-foreground" />
                      )}
                    </button>
                    
                    {expandedSections.has('site_plans') && (
                      <div className="bg-gray-50 rounded-lg p-4">
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                          {listing.files.site_plans.map((file, index) => (
                            <div key={file.id} className="group">
                              <div className="aspect-square bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow cursor-pointer">
                                {file.url ? (
                                  <img
                                    src={file.url}
                                    alt={file.name || `Site plan example ${index + 1}`}
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                                    onClick={() => window.open(file.url, '_blank')}
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center">
                                    <File className="w-8 h-8 text-gray-400" />
                                  </div>
                                )}
                              </div>
                              {(file as any).caption && (
                                <p className="text-xs text-muted-foreground mt-2 text-center">
                                  {(file as any).caption}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Requirements Brochure Section - Graceful degradation */}
                {listing.files?.brochures && listing.files.brochures.length > 0 && (
                  <div className="premium-section">
                    <h4 className="heading-4 text-foreground flex items-center gap-2 premium-border-accent mb-4">
                      <FileText className="w-4 h-4 text-primary-500" />
                      Requirements Brochure
                    </h4>
                    <div className="space-y-3">
                      {listing.files.brochures.map((file) => (
                        <div key={file.id} className="premium-file-download">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-primary-100 rounded-lg flex items-center justify-center">
                              <FileText className="w-4 h-4 text-primary-500" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-foreground truncate">
                                {file.name}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {(file.size / 1024 / 1024).toFixed(1)}MB • PDF
                              </p>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              className="premium-button-elevation"
                              onClick={() => window.open(file.url, '_blank')}
                            >
                              <Download className="w-4 h-4 mr-1" />
                              Download
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Property Page Link Section - Graceful degradation */}
                {listing.property_page_link && (
                  <div className="premium-section">
                    <h4 className="heading-4 text-foreground premium-border-accent mb-4">
                      Property Information
                    </h4>
                    <Button 
                      variant="outline" 
                      className="premium-button-elevation premium-touch-target"
                      onClick={() => window.open(listing.property_page_link, '_blank', 'noopener,noreferrer')}
                    >
                      <ExternalLink className="w-4 h-4 mr-2" />
                      View Property Details
                    </Button>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </>
  );
}
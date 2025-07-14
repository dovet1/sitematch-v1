'use client';

import { useState, useEffect, useRef } from 'react';
import { 
  X, MapPin, Building2, Users, Phone, Mail, Square, Calendar, 
  ExternalLink, Download, ChevronDown, ChevronUp, FileText, 
  Image as ImageIcon, File, User
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EnhancedListingModalContent, ListingModalProps } from '@/types/search';
import { cn } from '@/lib/utils';

export function EnhancedListingModal({ 
  listingId, 
  isOpen, 
  onClose, 
  searchState,
  scrollPosition 
}: ListingModalProps) {
  const [listing, setListing] = useState<EnhancedListingModalContent | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedFAQs, setExpandedFAQs] = useState<Set<string>>(new Set());
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['overview', 'contact']));
  const [activeTab, setActiveTab] = useState<'overview' | 'contact' | 'requirements' | 'files'>('overview');
  const [isClosing, setIsClosing] = useState(false);
  
  const modalRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const startY = useRef<number>(0);
  const currentY = useRef<number>(0);

  // Focus management and modal lifecycle
  useEffect(() => {
    if (isOpen) {
      previousFocusRef.current = document.activeElement as HTMLElement;
      setTimeout(() => modalRef.current?.focus(), 100);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
      // Restore focus and scroll position after animation
      setTimeout(() => {
        previousFocusRef.current?.focus();
        if (scrollPosition !== undefined) {
          window.scrollTo({ top: scrollPosition, behavior: 'instant' });
        }
      }, 350);
    }
  }, [isOpen, scrollPosition]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  // Touch handlers for mobile swipe-down gesture
  const handleTouchStart = (e: React.TouchEvent) => {
    startY.current = e.touches[0].clientY;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    currentY.current = e.touches[0].clientY;
    const diff = currentY.current - startY.current;
    
    // Only allow swipe down from the top of the modal
    if (diff > 0 && modalRef.current?.scrollTop === 0) {
      e.preventDefault();
      const modalElement = modalRef.current?.parentElement;
      if (modalElement) {
        modalElement.style.transform = `translateY(${Math.max(0, diff * 0.5)}px)`;
      }
    }
  };

  const handleTouchEnd = () => {
    const diff = currentY.current - startY.current;
    const modalElement = modalRef.current?.parentElement;
    
    if (diff > 100 && modalRef.current?.scrollTop === 0) {
      // Swipe down threshold met - close modal
      handleClose();
    } else if (modalElement) {
      // Reset position
      modalElement.style.transform = 'translateY(0)';
    }
  };

  // Enhanced close handler with animation
  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      onClose();
    }, 300);
  };

  // Fetch enhanced listing details
  useEffect(() => {
    if (!listingId || !isOpen) {
      setListing(null);
      return;
    }

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
      } catch (err) {
        console.error('Error fetching listing details:', err);
        setError('Failed to load listing details');
        
        // Fallback to mock data for development
        const mockListing: EnhancedListingModalContent = {
          company: {
            name: 'Demo Company Ltd',
            logo_url: undefined,
            sector: 'Technology',
            use_class: 'Office (B1)',
            site_size: '5,000 - 10,000 sq ft'
          },
          contacts: {
            primary: {
              name: 'Sarah Johnson',
              title: 'Property Manager',
              email: 'sarah.johnson@democompany.co.uk',
              phone: '+44 20 1234 5678',
              headshot_url: undefined
            },
            additional: [
              {
                name: 'Mark Thompson',
                title: 'Senior Associate',
                email: 'mark.thompson@democompany.co.uk',
                phone: '+44 20 1234 5679',
                headshot_url: undefined
              }
            ]
          },
          locations: {
            preferred: [
              { place_name: 'Central London, UK', coordinates: { lat: 51.5074, lng: -0.1278 } }
            ],
            acceptable: [
              { place_name: 'Canary Wharf, London', coordinates: { lat: 51.5045, lng: -0.0199 } }
            ],
            is_nationwide: false
          },
          faqs: [
            {
              id: '1',
              question: 'What are your specific requirements for office space?',
              answer: 'We need a modern, flexible office space with open-plan areas, meeting rooms, and excellent transport links. The space should accommodate 50+ professionals with room for expansion.'
            },
            {
              id: '2',
              question: 'Are you flexible on location?',
              answer: 'We prefer Central London locations but are open to considering Canary Wharf or other well-connected areas with good transport links.'
            },
            {
              id: '3',
              question: 'What is your preferred move-in timeline?',
              answer: 'We are looking to move within the next 6-12 months, with flexibility for the right opportunity.'
            }
          ],
          files: {
            brochures: [
              {
                id: '1',
                type: 'brochure',
                name: 'Company Requirements Brochure.pdf',
                size: 2457600,
                url: '/mock/brochure.pdf'
              }
            ],
            fit_outs: [
              {
                id: '2',
                type: 'fit_out',
                name: 'Preferred Office Layout.jpg',
                size: 1024000,
                url: '/mock/layout.jpg',
                thumbnail_url: '/mock/layout-thumb.jpg'
              }
            ],
            site_plans: [
              {
                id: '3',
                type: 'site_plan',
                name: 'Ideal Floor Plan.pdf',
                size: 1536000,
                url: '/mock/floor-plan.pdf'
              }
            ]
          },
          id: listingId,
          title: 'Modern Office Space Required - Central Location',
          description: 'We are seeking a modern, flexible office space in a prime central location. The space should accommodate our growing team of 50+ professionals with room for expansion.',
          created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
        };
        setListing(mockListing);
      } finally {
        setIsLoading(false);
      }
    };

    fetchListing();
  }, [listingId, isOpen]);

  // FAQ toggle handler
  const toggleFAQ = (faqId: string) => {
    setExpandedFAQs(prev => {
      const newExpanded = new Set(prev);
      if (newExpanded.has(faqId)) {
        newExpanded.delete(faqId);
      } else {
        newExpanded.add(faqId);
      }
      return newExpanded;
    });
  };

  // Section toggle handler
  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev => {
      const newExpanded = new Set(prev);
      if (newExpanded.has(sectionId)) {
        newExpanded.delete(sectionId);
      } else {
        newExpanded.add(sectionId);
      }
      return newExpanded;
    });
  };

  // File size formatter
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  // Date formatter
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  // File type icon with enhanced styling
  const getFileIcon = (type: string) => {
    switch (type) {
      case 'brochure':
        return <FileText className="w-5 h-5" />;
      case 'fit_out':
        return <ImageIcon className="w-5 h-5" />;
      case 'site_plan':
        return <File className="w-5 h-5" />;
      default:
        return <File className="w-5 h-5" />;
    }
  };

  // File type color
  const getFileTypeColor = (type: string) => {
    switch (type) {
      case 'brochure':
        return 'bg-blue-100 text-blue-600';
      case 'fit_out':
        return 'bg-green-100 text-green-600';
      case 'site_plan':
        return 'bg-purple-100 text-purple-600';
      default:
        return 'bg-gray-100 text-gray-600';
    }
  };

  // File type label
  const getFileTypeLabel = (type: string) => {
    switch (type) {
      case 'brochure':
        return 'Brochure';
      case 'fit_out':
        return 'Fit-out';
      case 'site_plan':
        return 'Site Plan';
      default:
        return 'Document';
    }
  };

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
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
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
          {/* Sticky Header */}
          <div className="flex items-center justify-between p-4 md:p-6 border-b border-border bg-white sticky top-0 z-10 flex-shrink-0">
            <div className="flex items-center gap-3">
              {listing?.company.logo_url ? (
                <div className="w-10 h-10 rounded-lg overflow-hidden bg-white border border-gray-200 flex items-center justify-center">
                  <img
                    src={listing.company.logo_url}
                    alt={`${listing.company.name} logo`}
                    className="w-full h-full object-contain"
                    onLoad={() => {
                      console.log(`Logo loaded successfully for ${listing.company.name}:`, listing.company.logo_url);
                    }}
                    onError={(e) => {
                      console.warn(`Logo failed to load for ${listing.company.name}:`, listing.company.logo_url);
                      // Hide broken image and show fallback
                      const target = e.target as HTMLImageElement;
                      const container = target.parentElement;
                      if (container) {
                        container.innerHTML = `
                          <div class="w-full h-full bg-primary-100 rounded-lg flex items-center justify-center">
                            <svg class="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path>
                            </svg>
                          </div>
                        `;
                      }
                    }}
                  />
                </div>
              ) : (
                <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-primary-600" />
                </div>
              )}
              <div>
                <h2 id="modal-title" className="heading-4 text-foreground">
                  {listing?.company.name || 'Loading...'}
                </h2>
                <p className="text-sm text-muted-foreground">
                  Property Requirement Details
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClose}
              className="violet-bloom-touch flex-shrink-0"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>

          {/* Mobile swipe indicator */}
          <div className="md:hidden w-12 h-1 bg-gray-300 rounded-full mx-auto mt-2 mb-4" />

          {/* Tab Navigation */}
          {listing && !isLoading && (
            <div className="border-b border-border bg-white sticky top-[73px] md:top-[85px] z-10">
              <div className="flex overflow-x-auto">
                <button
                  onClick={() => setActiveTab('overview')}
                  className={cn(
                    "flex-1 min-w-0 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
                    activeTab === 'overview'
                      ? "border-primary-500 text-primary-600 bg-primary-50"
                      : "border-transparent text-muted-foreground hover:text-foreground hover:border-gray-300"
                  )}
                >
                  <div className="flex items-center justify-center gap-2">
                    <Building2 className="w-4 h-4" />
                    Overview
                  </div>
                </button>
                <button
                  onClick={() => setActiveTab('contact')}
                  className={cn(
                    "flex-1 min-w-0 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
                    activeTab === 'contact'
                      ? "border-primary-500 text-primary-600 bg-primary-50"
                      : "border-transparent text-muted-foreground hover:text-foreground hover:border-gray-300"
                  )}
                >
                  <div className="flex items-center justify-center gap-2">
                    <Users className="w-4 h-4" />
                    Contact
                  </div>
                </button>
                <button
                  onClick={() => setActiveTab('requirements')}
                  className={cn(
                    "flex-1 min-w-0 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
                    activeTab === 'requirements'
                      ? "border-primary-500 text-primary-600 bg-primary-50"
                      : "border-transparent text-muted-foreground hover:text-foreground hover:border-gray-300"
                  )}
                >
                  <div className="flex items-center justify-center gap-2">
                    <MapPin className="w-4 h-4" />
                    Requirements
                  </div>
                </button>
                {(listing?.files.fit_outs.length > 0 || listing?.files.site_plans.length > 0) && (
                  <button
                    onClick={() => setActiveTab('files')}
                    className={cn(
                      "flex-1 min-w-0 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
                      activeTab === 'files'
                        ? "border-primary-500 text-primary-600 bg-primary-50"
                        : "border-transparent text-muted-foreground hover:text-foreground hover:border-gray-300"
                    )}
                  >
                    <div className="flex items-center justify-center gap-2">
                      <FileText className="w-4 h-4" />
                      Files
                    </div>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Scrollable Content */}
          <div className="overflow-y-auto flex-1">
            {isLoading ? (
              <div className="p-4 md:p-6 space-y-8">
                {/* Skeleton for title & description */}
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="h-8 bg-gray-200 rounded-md animate-pulse" />
                    <div className="flex gap-2">
                      <div className="h-6 w-20 bg-gray-200 rounded-full animate-pulse" />
                      <div className="h-6 w-24 bg-gray-200 rounded-full animate-pulse" />
                      <div className="h-6 w-16 bg-gray-200 rounded-full animate-pulse" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="h-4 bg-gray-200 rounded animate-pulse" />
                    <div className="h-4 bg-gray-200 rounded animate-pulse w-4/5" />
                    <div className="h-4 bg-gray-200 rounded animate-pulse w-3/5" />
                  </div>
                </div>

                {/* Skeleton for company overview */}
                <div className="bg-gray-100 rounded-lg p-4 md:p-6 animate-pulse">
                  <div className="h-6 bg-gray-200 rounded mb-4" />
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <div className="h-4 bg-gray-200 rounded w-1/3" />
                      <div className="h-4 bg-gray-200 rounded w-2/3" />
                    </div>
                    <div className="space-y-2">
                      <div className="h-4 bg-gray-200 rounded w-1/3" />
                      <div className="h-4 bg-gray-200 rounded w-2/3" />
                    </div>
                  </div>
                </div>

                {/* Skeleton for contact */}
                <div className="space-y-4">
                  <div className="h-6 bg-gray-200 rounded w-1/4 animate-pulse" />
                  <div className="bg-white border border-gray-200 rounded-lg p-4">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 bg-gray-200 rounded-full animate-pulse" />
                      <div className="flex-1 space-y-2">
                        <div className="h-5 bg-gray-200 rounded w-1/3 animate-pulse" />
                        <div className="h-4 bg-gray-200 rounded w-1/4 animate-pulse" />
                        <div className="flex gap-3">
                          <div className="h-4 bg-gray-200 rounded w-32 animate-pulse" />
                          <div className="h-4 bg-gray-200 rounded w-24 animate-pulse" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Skeleton for locations */}
                <div className="space-y-4">
                  <div className="h-6 bg-gray-200 rounded w-1/4 animate-pulse" />
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <div className="h-5 bg-gray-200 rounded w-1/2 animate-pulse" />
                      <div className="space-y-1">
                        <div className="h-4 bg-gray-200 rounded w-3/4 animate-pulse" />
                        <div className="h-4 bg-gray-200 rounded w-2/3 animate-pulse" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Loading indicator */}
                <div className="flex items-center justify-center py-8">
                  <div className="flex items-center gap-3">
                    <div className="animate-spin w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full" />
                    <span className="text-muted-foreground">Loading listing details...</span>
                  </div>
                </div>
              </div>
            ) : error && !listing ? (
              <div className="flex flex-col items-center justify-center py-16 text-center px-4">
                <Building2 className="w-12 h-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-2">{error}</p>
                <p className="text-sm text-muted-foreground mb-4">There was a problem loading this listing</p>
                <Button
                  variant="outline"
                  onClick={() => {
                    setError(null);
                    // Trigger refetch by resetting the effect dependency
                    if (listingId) {
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
                        } catch (err) {
                          console.error('Error fetching listing details:', err);
                          setError('Failed to load listing details');
                        } finally {
                          setIsLoading(false);
                        }
                      };

                      fetchListing();
                    }
                  }}
                >
                  Try Again
                </Button>
              </div>
            ) : listing ? (
              <div className="p-4 md:p-6">
                {/* Summary Card - Always Visible */}
                <div className="bg-gradient-to-r from-primary-50 to-primary-100 rounded-xl p-6 mb-8 border border-primary-200">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0">
                      {listing.company.logo_url ? (
                        <div className="w-16 h-16 rounded-xl overflow-hidden bg-white border border-gray-200 flex items-center justify-center">
                          <img
                            src={listing.company.logo_url}
                            alt={`${listing.company.name} logo`}
                            className="w-full h-full object-contain"
                          />
                        </div>
                      ) : (
                        <div className="w-16 h-16 bg-primary-500 rounded-xl flex items-center justify-center">
                          <Building2 className="w-8 h-8 text-white" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="heading-3 text-foreground mb-2 truncate">
                        {listing.company.name}
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 bg-primary-500 rounded-full flex items-center justify-center flex-shrink-0">
                            <Building2 className="w-3 h-3 text-white" />
                          </div>
                          <span className="text-foreground font-medium">{listing.company.sector}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 bg-primary-500 rounded-full flex items-center justify-center flex-shrink-0">
                            <Square className="w-3 h-3 text-white" />
                          </div>
                          <span className="text-foreground font-medium">{listing.company.site_size}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 bg-primary-500 rounded-full flex items-center justify-center flex-shrink-0">
                            <MapPin className="w-3 h-3 text-white" />
                          </div>
                          <span className="text-foreground font-medium">
                            {listing.locations.is_nationwide ? 'Nationwide' : 
                             listing.locations.preferred.length > 0 ? listing.locations.preferred[0].place_name : 
                             'Location flexible'}
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 mt-3">
                        <Badge variant="secondary" className="text-xs">
                          {listing.company.use_class}
                        </Badge>
                        {listing.locations.is_nationwide && (
                          <Badge className="bg-primary-500 text-primary-foreground text-xs">
                            Nationwide Search
                          </Badge>
                        )}
                        <Badge variant="outline" className="text-xs">
                          <Calendar className="w-3 h-3 mr-1" />
                          Posted {formatDate(listing.created_at)}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Overview Tab */}
                {activeTab === 'overview' && (
                  <div className="space-y-8">
                    {/* Quick Actions - High Priority */}
                    <div className="bg-white border border-primary-200 rounded-lg p-4">
                      <h4 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                        <span className="w-2 h-2 bg-primary-500 rounded-full"></span>
                        Quick Actions
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {listing.contacts.primary.email && (
                          <Button
                            onClick={() => {
                              const subject = encodeURIComponent(`Property Enquiry: ${listing.title}`);
                              const body = encodeURIComponent(`Dear ${listing.contacts.primary.name},\n\nI am interested in discussing your property requirement for ${listing.title}.\n\nBest regards`);
                              window.open(`mailto:${listing.contacts.primary.email}?subject=${subject}&body=${body}`);
                            }}
                            className="violet-bloom-button justify-start"
                          >
                            <Mail className="w-4 h-4 mr-2" />
                            Send Enquiry to {listing.contacts.primary.name}
                          </Button>
                        )}
                        {listing.files.brochures.length > 0 && (
                          <Button
                            onClick={() => window.open(listing.files.brochures[0].url, '_blank')}
                            variant="outline"
                            className="justify-start"
                          >
                            <FileText className="w-4 h-4 mr-2" />
                            View Company Brochure ({formatFileSize(listing.files.brochures[0].size)})
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Property Requirement Details */}
                    <div className="space-y-6">
                      <div>
                        <h3 id="modal-description" className="heading-3 text-foreground mb-2">
                          {listing.title}
                        </h3>
                        <div className="flex flex-wrap items-center gap-2 mb-4">
                          <Badge variant="secondary">
                            {listing.company.sector}
                          </Badge>
                          <Badge variant="outline">
                            {listing.company.use_class}
                          </Badge>
                          {listing.locations.is_nationwide && (
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

                    {/* Key Requirements - Highlighted */}
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-6">
                      <h4 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                        <span className="w-6 h-6 bg-amber-500 rounded-full flex items-center justify-center">
                          <span className="text-white text-xs font-bold">!</span>
                        </span>
                        Key Requirements at a Glance
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-amber-500 rounded-lg flex items-center justify-center">
                            <Square className="w-4 h-4 text-white" />
                          </div>
                          <div>
                            <p className="font-medium text-foreground">Space Requirement</p>
                            <p className="text-sm text-muted-foreground">{listing.company.site_size}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-amber-500 rounded-lg flex items-center justify-center">
                            <MapPin className="w-4 h-4 text-white" />
                          </div>
                          <div>
                            <p className="font-medium text-foreground">Location Preference</p>
                            <p className="text-sm text-muted-foreground">
                              {listing.locations.is_nationwide ? 'Nationwide UK' : 
                               listing.locations.preferred.length > 0 ? listing.locations.preferred[0].place_name : 
                               'Flexible on location'}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-amber-500 rounded-lg flex items-center justify-center">
                            <Building2 className="w-4 h-4 text-white" />
                          </div>
                          <div>
                            <p className="font-medium text-foreground">Business Sector</p>
                            <p className="text-sm text-muted-foreground">{listing.company.sector}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-amber-500 rounded-lg flex items-center justify-center">
                            <Users className="w-4 h-4 text-white" />
                          </div>
                          <div>
                            <p className="font-medium text-foreground">Use Class</p>
                            <p className="text-sm text-muted-foreground">{listing.company.use_class}</p>
                          </div>
                        </div>
                      </div>
                    </div>

                {/* Company Overview */}
                <div className="bg-primary-50 rounded-lg p-6 md:p-8 border border-primary-100">
                  <h4 className="heading-4 text-foreground mb-4 flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-primary-500" />
                    Company Overview
                  </h4>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <span className="font-medium text-foreground">Business Sector:</span>
                      <p className="text-muted-foreground">{listing.company.sector}</p>
                    </div>
                    <div>
                      <span className="font-medium text-foreground">Use Class:</span>
                      <p className="text-muted-foreground">{listing.company.use_class}</p>
                    </div>
                    <div className="md:col-span-2">
                      <span className="font-medium text-foreground">Space Requirements:</span>
                      <p className="text-muted-foreground">{listing.company.site_size}</p>
                    </div>
                  </div>
                </div>
                  </div>
                )}

                {/* Contact Tab */}
                {activeTab === 'contact' && (
                  <div className="space-y-8">
                    {/* Priority Contact - Always Visible */}
                    <div className="bg-green-50 border border-green-200 rounded-lg p-6">
                      <h4 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                        <span className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                          <Users className="w-3 h-3 text-white" />
                        </span>
                        Primary Contact - Ready to Connect
                      </h4>
                      <div className="bg-white rounded-lg p-4 border border-green-100">
                        <div className="flex items-start gap-4">
                          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                            {listing.contacts.primary.headshot_url ? (
                              <img
                                src={listing.contacts.primary.headshot_url}
                                alt={listing.contacts.primary.name}
                                className="w-16 h-16 rounded-full object-cover"
                              />
                            ) : (
                              <User className="w-8 h-8 text-green-600" />
                            )}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h5 className="font-semibold text-foreground text-lg">{listing.contacts.primary.name}</h5>
                              <Badge className="bg-green-500 text-white text-xs">Primary Contact</Badge>
                            </div>
                            {listing.contacts.primary.title && (
                              <p className="text-muted-foreground mb-3">{listing.contacts.primary.title}</p>
                            )}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              {listing.contacts.primary.email && (
                                <a 
                                  href={`mailto:${listing.contacts.primary.email}`}
                                  className="flex items-center gap-3 text-sm text-green-600 hover:text-green-700 transition-colors p-3 rounded-lg hover:bg-green-50 border border-green-200"
                                >
                                  <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                                    <Mail className="w-4 h-4 text-green-600" />
                                  </div>
                                  <span className="font-medium">{listing.contacts.primary.email}</span>
                                </a>
                              )}
                              {listing.contacts.primary.phone && (
                                <a 
                                  href={`tel:${listing.contacts.primary.phone}`}
                                  className="flex items-center gap-3 text-sm text-green-600 hover:text-green-700 transition-colors p-3 rounded-lg hover:bg-green-50 border border-green-200"
                                >
                                  <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                                    <Phone className="w-4 h-4 text-green-600" />
                                  </div>
                                  <span className="font-medium">{listing.contacts.primary.phone}</span>
                                </a>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* All Contact Information */}
                    <div className="space-y-6">
                      <h4 className="heading-4 text-foreground flex items-center gap-2">
                        <Users className="w-4 h-4 text-primary-500" />
                        All Contacts
                      </h4>
                  
                  {/* Primary Contact */}
                  <div className="bg-white border border-border rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0">
                        {listing.contacts.primary.headshot_url ? (
                          <img
                            src={listing.contacts.primary.headshot_url}
                            alt={listing.contacts.primary.name}
                            className="w-12 h-12 rounded-full object-cover"
                          />
                        ) : (
                          <User className="w-6 h-6 text-primary-600" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h5 className="font-medium text-foreground">{listing.contacts.primary.name}</h5>
                          <Badge variant="outline" className="text-xs">Primary</Badge>
                        </div>
                        {listing.contacts.primary.title && (
                          <p className="text-sm text-muted-foreground mb-2">{listing.contacts.primary.title}</p>
                        )}
                        <div className="flex flex-col gap-3">
                          {listing.contacts.primary.email && (
                            <a 
                              href={`mailto:${listing.contacts.primary.email}`}
                              className="flex items-center gap-3 text-sm text-primary-600 hover:text-primary-700 transition-colors p-2 rounded-lg hover:bg-primary-50 min-h-[44px]"
                            >
                              <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0">
                                <Mail className="w-4 h-4 text-primary-600" />
                              </div>
                              <span className="font-medium">{listing.contacts.primary.email}</span>
                            </a>
                          )}
                          {listing.contacts.primary.phone && (
                            <a 
                              href={`tel:${listing.contacts.primary.phone}`}
                              className="flex items-center gap-3 text-sm text-primary-600 hover:text-primary-700 transition-colors p-2 rounded-lg hover:bg-primary-50 min-h-[44px]"
                            >
                              <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0">
                                <Phone className="w-4 h-4 text-primary-600" />
                              </div>
                              <span className="font-medium">{listing.contacts.primary.phone}</span>
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Additional Contacts */}
                  {listing.contacts.additional.length > 0 && (
                    <div className="space-y-3">
                      <h5 className="font-medium text-foreground">Additional Contacts</h5>
                      {listing.contacts.additional.map((contact, index) => (
                        <div key={index} className="bg-white border border-border rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow">
                          <div className="flex items-start gap-4">
                            <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0">
                              {contact.headshot_url ? (
                                <img
                                  src={contact.headshot_url}
                                  alt={contact.name}
                                  className="w-10 h-10 rounded-full object-cover"
                                />
                              ) : (
                                <User className="w-5 h-5 text-gray-500" />
                              )}
                            </div>
                            <div className="flex-1">
                              <h6 className="font-medium text-foreground">{contact.name}</h6>
                              {contact.title && (
                                <p className="text-sm text-muted-foreground mb-2">{contact.title}</p>
                              )}
                              <div className="flex flex-col gap-3">
                                {contact.email && (
                                  <a 
                                    href={`mailto:${contact.email}`}
                                    className="flex items-center gap-3 text-sm text-primary-600 hover:text-primary-700 transition-colors p-2 rounded-lg hover:bg-primary-50 min-h-[44px]"
                                  >
                                    <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0">
                                      <Mail className="w-4 h-4 text-primary-600" />
                                    </div>
                                    <span className="font-medium">{contact.email}</span>
                                  </a>
                                )}
                                {contact.phone && (
                                  <a 
                                    href={`tel:${contact.phone}`}
                                    className="flex items-center gap-3 text-sm text-primary-600 hover:text-primary-700 transition-colors p-2 rounded-lg hover:bg-primary-50 min-h-[44px]"
                                  >
                                    <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0">
                                      <Phone className="w-4 h-4 text-primary-600" />
                                    </div>
                                    <span className="font-medium">{contact.phone}</span>
                                  </a>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                  </div>
                )}

                {/* Requirements Tab */}
                {activeTab === 'requirements' && (
                  <div className="space-y-8">
                    {/* Location Requirements */}
                <div className="space-y-6">
                  <button
                    onClick={() => toggleSection('locations')}
                    className="w-full flex items-center justify-between p-0 text-left hover:text-primary-600 transition-colors"
                  >
                    <h4 className="heading-4 text-foreground flex items-center gap-2">
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
                    <div className="space-y-4">
                      {/* Check if no specific locations and assume nationwide */}
                      {listing.locations.preferred.length === 0 && listing.locations.acceptable.length === 0 ? (
                    <div className="bg-primary-50 rounded-lg p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-primary-500 rounded-full flex items-center justify-center">
                          <MapPin className="w-4 h-4 text-white" />
                        </div>
                        <div>
                          <p className="font-medium text-primary-700">Nationwide Search</p>
                          <p className="text-sm text-primary-600">This company is open to opportunities across the UK</p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="grid md:grid-cols-2 gap-4">
                      {listing.locations.preferred.length > 0 && (
                        <div className="space-y-2">
                          <h5 className="font-medium text-foreground">Preferred Locations</h5>
                          {listing.locations.preferred.map((location, index) => (
                            <div key={index} className="flex items-center gap-2">
                              <div className="w-2 h-2 bg-primary-500 rounded-full" />
                              <span className="text-sm text-muted-foreground">{location.place_name}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      
                      {listing.locations.acceptable.length > 0 && (
                        <div className="space-y-2">
                          <h5 className="font-medium text-foreground">Acceptable Locations</h5>
                          {listing.locations.acceptable.map((location, index) => (
                            <div key={index} className="flex items-center gap-2">
                              <div className="w-2 h-2 bg-gray-400 rounded-full" />
                              <span className="text-sm text-muted-foreground">{location.place_name}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  
                      {/* Additional nationwide indicator if flag is set */}
                      {listing.locations.is_nationwide && (listing.locations.preferred.length > 0 || listing.locations.acceptable.length > 0) && (
                        <div className="bg-primary-50 rounded-lg p-3">
                          <p className="text-sm text-primary-700 font-medium">
                            Also open to nationwide opportunities beyond the locations listed above
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                    {/* FAQs */}
                    {listing.faqs.length > 0 && (
                  <div className="space-y-6">
                    <h4 className="heading-4 text-foreground">
                      Frequently Asked Questions
                    </h4>
                    <div className="space-y-3">
                      {listing.faqs.map((faq) => (
                        <div key={faq.id} className="border border-border rounded-lg">
                          <button
                            onClick={() => toggleFAQ(faq.id)}
                            className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 transition-colors"
                          >
                            <span className="font-medium text-foreground">{faq.question}</span>
                            {expandedFAQs.has(faq.id) ? (
                              <ChevronUp className="w-4 h-4 text-muted-foreground" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-muted-foreground" />
                            )}
                          </button>
                          {expandedFAQs.has(faq.id) && (
                            <div className="px-4 pb-4">
                              <p className="text-muted-foreground">{faq.answer}</p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                  </div>
                )}

                {/* Files Tab */}
                {activeTab === 'files' && (
                  <div className="space-y-8">
                    {/* Files & Documents */}
                {(listing.files.fit_outs.length > 0 || listing.files.site_plans.length > 0) && (
                  <div className="space-y-6">
                    <button
                      onClick={() => toggleSection('files')}
                      className="w-full flex items-center justify-between p-0 text-left hover:text-primary-600 transition-colors"
                    >
                      <h4 className="heading-4 text-foreground flex items-center gap-2">
                        <FileText className="w-4 h-4 text-primary-500" />
                        Files & Documents
                      </h4>
                      {expandedSections.has('files') ? (
                        <ChevronUp className="w-5 h-5 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-muted-foreground" />
                      )}
                    </button>
                    
                    {expandedSections.has('files') && (
                      <div className="grid md:grid-cols-2 gap-4">
                      {/* Fit-outs */}
                      {listing.files.fit_outs.length > 0 && (
                        <div className="space-y-2">
                          <h5 className="font-medium text-foreground">Fit-out Examples</h5>
                          {listing.files.fit_outs.map((file) => (
                            <div key={file.id} className="group bg-white border border-border rounded-xl overflow-hidden hover:shadow-lg transition-all duration-200 hover:border-primary-300">
                              {/* File Preview/Thumbnail */}
                              <div className="aspect-video relative bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
                                {file.thumbnail_url ? (
                                  <img
                                    src={file.thumbnail_url}
                                    alt={file.name}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <div className={cn("w-16 h-16 rounded-lg flex items-center justify-center", getFileTypeColor(file.type))}>
                                    {getFileIcon(file.type)}
                                  </div>
                                )}
                                {/* File Type Badge */}
                                <div className="absolute top-2 left-2">
                                  <Badge variant="secondary" className="text-xs bg-white/90 backdrop-blur-sm">
                                    {getFileTypeLabel(file.type)}
                                  </Badge>
                                </div>
                                {/* Download Overlay */}
                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                                  <Button
                                    size="sm"
                                    onClick={() => window.open(file.url, '_blank')}
                                    className="opacity-0 group-hover:opacity-100 transition-opacity bg-white text-gray-900 hover:bg-gray-100"
                                  >
                                    <Download className="w-4 h-4 mr-2" />
                                    Download
                                  </Button>
                                </div>
                              </div>
                              {/* File Info */}
                              <div className="p-4">
                                <p className="text-sm font-medium text-foreground truncate mb-1">{file.name}</p>
                                <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Site Plans */}
                      {listing.files.site_plans.length > 0 && (
                        <div className="space-y-2">
                          <h5 className="font-medium text-foreground">Site Plans</h5>
                          {listing.files.site_plans.map((file) => (
                            <div key={file.id} className="group bg-white border border-border rounded-xl overflow-hidden hover:shadow-lg transition-all duration-200 hover:border-primary-300">
                              {/* File Preview */}
                              <div className="aspect-video relative bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
                                <div className={cn("w-16 h-16 rounded-lg flex items-center justify-center", getFileTypeColor(file.type))}>
                                  {getFileIcon(file.type)}
                                </div>
                                {/* File Type Badge */}
                                <div className="absolute top-2 left-2">
                                  <Badge variant="secondary" className="text-xs bg-white/90 backdrop-blur-sm">
                                    {getFileTypeLabel(file.type)}
                                  </Badge>
                                </div>
                                {/* Download Overlay */}
                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                                  <Button
                                    size="sm"
                                    onClick={() => window.open(file.url, '_blank')}
                                    className="opacity-0 group-hover:opacity-100 transition-opacity bg-white text-gray-900 hover:bg-gray-100"
                                  >
                                    <Download className="w-4 h-4 mr-2" />
                                    Download
                                  </Button>
                                </div>
                              </div>
                              {/* File Info */}
                              <div className="p-4">
                                <p className="text-sm font-medium text-foreground truncate mb-1">{file.name}</p>
                                <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      </div>
                    )}
                  </div>
                )}
                  </div>
                )}

                {/* Desktop Action Buttons */}
                <div className="hidden md:block border-t border-border pt-8 mt-12">
                  <div className="flex flex-col sm:flex-row gap-3">
                    <Button 
                      className="flex-1 violet-bloom-button"
                      onClick={() => {
                        if (listing.contacts.primary.email) {
                          const subject = encodeURIComponent(`Property Enquiry: ${listing.title}`);
                          const body = encodeURIComponent(`Dear ${listing.contacts.primary.name},\n\nI am interested in discussing your property requirement for ${listing.title}.\n\nBest regards`);
                          window.open(`mailto:${listing.contacts.primary.email}?subject=${subject}&body=${body}`);
                        }
                      }}
                    >
                      <Mail className="w-4 h-4 mr-2" />
                      Send Enquiry
                    </Button>
                    
                    {listing.contacts.primary.phone && (
                      <Button 
                        variant="outline" 
                        className="flex-1"
                        onClick={() => window.open(`tel:${listing.contacts.primary.phone}`)}
                      >
                        <Phone className="w-4 h-4 mr-2" />
                        Call Now
                      </Button>
                    )}
                  </div>
                </div>

                {/* Footer */}
                <div className="border-t border-border pt-4 pb-20 md:pb-4">
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>Listing ID: {listing.id}</span>
                    <span>Posted on {formatDate(listing.created_at)}</span>
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          {/* Sticky Action Bar - Mobile */}
          {listing && (
            <div className="md:hidden sticky bottom-0 left-0 right-0 bg-white border-t border-border p-4 z-10 rounded-b-2xl">
              <div className="flex flex-col gap-3">
                <Button 
                  className="w-full violet-bloom-button h-12"
                  onClick={() => {
                    if (listing.contacts.primary.email) {
                      const subject = encodeURIComponent(`Property Enquiry: ${listing.title}`);
                      const body = encodeURIComponent(`Dear ${listing.contacts.primary.name},\n\nI am interested in discussing your property requirement for ${listing.title}.\n\nBest regards`);
                      window.open(`mailto:${listing.contacts.primary.email}?subject=${subject}&body=${body}`);
                    }
                  }}
                >
                  <Mail className="w-4 h-4 mr-2" />
                  Send Enquiry
                </Button>
                
                {listing.contacts.primary.phone && (
                  <Button 
                    variant="outline" 
                    className="w-full h-12"
                    onClick={() => window.open(`tel:${listing.contacts.primary.phone}`)}
                  >
                    <Phone className="w-4 h-4 mr-2" />
                    Call Now
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
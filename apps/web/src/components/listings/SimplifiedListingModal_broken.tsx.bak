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
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['contacts', 'locations', 'faqs']));
  
  // State for lightbox functionality
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [lightboxImages, setLightboxImages] = useState<Array<{url: string, name: string, type: string}>>([]);
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
      } finally {
        setIsLoading(false);
      }
    };

    fetchListing();
  }, [listingId, isOpen]);

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

  // Location name cleaning function
  const cleanLocationName = (placeName: string) => {
    if (!placeName) return '';
    
    return placeName
      .replace(/, England, United Kingdom$/, '')
      .replace(/, Scotland, United Kingdom$/, '')
      .replace(/, Wales, United Kingdom$/, '')
      .replace(/, United Kingdom$/, '')
      .replace(/, UK$/, '')
      // Special handling for major cities that don't need county
      .replace(/^London, Greater London$/, 'London')
      .replace(/^Manchester, Greater Manchester$/, 'Manchester')
      .replace(/^Birmingham, West Midlands$/, 'Birmingham')
      .replace(/^Leeds, West Yorkshire$/, 'Leeds')
      .replace(/^Liverpool, Merseyside$/, 'Liverpool')
      .replace(/^Newcastle upon Tyne, Tyne and Wear$/, 'Newcastle')
      .replace(/^Sheffield, South Yorkshire$/, 'Sheffield')
      .replace(/^Bristol, City of Bristol$/, 'Bristol')
      .replace(/^Edinburgh, City of Edinburgh$/, 'Edinburgh')
      .replace(/^Glasgow, City of Glasgow$/, 'Glasgow')
      .replace(/^Cardiff, City of Cardiff$/, 'Cardiff');
  };

  // Smart truncation component for arrays
  const SmartList = ({ 
    items, 
    maxShow = 3, 
    type = 'locations',
    renderItem 
  }: {
    items: string[];
    maxShow?: number;
    type?: string;
    renderItem: (item: string, index: number) => React.ReactNode;
  }) => {
    const [expanded, setExpanded] = useState(false);
    const visibleItems = expanded ? items : items.slice(0, maxShow);
    const hasMore = items.length > maxShow;
    
    return (
      <div className="flex flex-wrap gap-2">
        {visibleItems.map((item, index) => renderItem(item, index))}
        {hasMore && (
          <Badge 
            variant="outline" 
            className="cursor-pointer hover:bg-gray-100 transition-colors"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? 'Show less' : `+ ${items.length - maxShow} more`}
          </Badge>
        )}
      </div>
    );
  };

  // Location summary component
  const LocationSummary = ({ 
    locations, 
    isNationwide 
  }: {
    locations: Array<{ place_name: string }>;
    isNationwide: boolean;
  }) => {
    const [showAll, setShowAll] = useState(false);
    const cleanedLocations = locations.map(loc => cleanLocationName(loc.place_name));
    const primaryLocation = cleanedLocations[0];
    const additionalCount = cleanedLocations.length - 1;
    
    if (isNationwide) {
      return (
        <div className="flex items-center gap-2">
          <Badge className="bg-orange-100 text-orange-700 border-orange-200">
            <MapPin className="w-3 h-3 mr-1" />
            Nationwide
          </Badge>
        </div>
      );
    }
    
    return (
      <div className="flex items-center gap-2 relative">
        <span className="text-sm text-muted-foreground">
          {primaryLocation || 'Location flexible'}
        </span>
        {additionalCount > 0 && (
          <>
            <Badge 
              variant="outline" 
              className="cursor-pointer hover:bg-gray-100 transition-colors"
              onClick={() => setShowAll(!showAll)}
            >
              +{additionalCount} more
            </Badge>
            {showAll && (
              <div className="absolute top-full left-0 z-50 bg-white border border-gray-200 rounded-lg shadow-lg p-3 min-w-[200px] mt-1">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium text-sm">All Locations</h4>
                  <button 
                    onClick={() => setShowAll(false)} 
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="space-y-1">
                  {cleanedLocations.map((location, index) => (
                    <div key={index} className="flex items-center gap-2 text-sm">
                      <div className="w-2 h-2 bg-primary-500 rounded-full" />
                      <span className="text-muted-foreground">{location}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  // FAQ Accordion components
  const FAQAccordion = ({ faqs }: { faqs: Array<{ id: string; question: string; answer: string }> }) => {
    const [openItems, setOpenItems] = useState<Set<string>>(new Set());
    
    const toggleItem = (id: string) => {
      setOpenItems(prev => {
        const newSet = new Set(prev);
        if (newSet.has(id)) {
          newSet.delete(id);
        } else {
          newSet.add(id);
        }
        return newSet;
      });
    };
    
    return (
      <div className="space-y-2">
        {faqs.map((faq) => (
          <AccordionItem 
            key={faq.id}
            faq={faq}
            isOpen={openItems.has(faq.id)}
            onToggle={() => toggleItem(faq.id)}
          />
        ))}
      </div>
    );
  };

  const AccordionItem = ({ 
    faq, 
    isOpen, 
    onToggle 
  }: {
    faq: { id: string; question: string; answer: string };
    isOpen: boolean;
    onToggle: () => void;
  }) => {
    return (
      <div className="border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow">
        <button
          onClick={onToggle}
          className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 transition-colors"
          aria-expanded={isOpen}
          aria-controls={`faq-${faq.id}`}
        >
          <span className="font-medium text-foreground pr-4">
            {faq.question}
          </span>
          <ChevronDown 
            className={`w-4 h-4 text-muted-foreground transition-transform duration-200 flex-shrink-0 ${
              isOpen ? 'rotate-180' : ''
            }`}
          />
        </button>
        
        <div
          id={`faq-${faq.id}`}
          className={`overflow-hidden transition-all duration-300 ease-out ${
            isOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
          }`}
        >
          <div className="px-4 pb-4 pt-0">
            <p className="text-muted-foreground leading-relaxed">
              {faq.answer}
            </p>
          </div>
        </div>
      </div>
    );
  };

  // Sector and use class summary components
  const SectorSummary = ({ sectors }: { sectors: string[] }) => {
    if (sectors.length === 0) return <span className="text-sm text-muted-foreground">Not specified</span>;
    
    if (sectors.length === 1) {
      return <span className="text-sm text-muted-foreground">{sectors[0]}</span>;
    }
    
    if (sectors.length <= 3) {
      return <span className="text-sm text-muted-foreground">{sectors.join(', ')}</span>;
    }
    
    return (
      <span className="text-sm text-muted-foreground">
        {sectors.slice(0, 2).join(', ')} + {sectors.length - 2} more
      </span>
    );
  };

  const UseClassSummary = ({ useClasses }: { useClasses: string[] }) => {
    if (useClasses.length === 0) return <span className="text-sm text-muted-foreground">Not specified</span>;
    
    if (useClasses.length === 1) {
      return <span className="text-sm text-muted-foreground">{useClasses[0]}</span>;
    }
    
    return (
      <span className="text-sm text-muted-foreground">
        {useClasses[0]} + {useClasses.length - 1} more
      </span>
    );
  };

  // File type icon
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

  // Check if file is image
  const isImageFile = (filename: string) => {
    const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg'];
    const extension = filename.split('.').pop()?.toLowerCase();
    return imageExtensions.includes(extension || '');
  };

  // Open lightbox with images
  const openLightbox = (files: Array<{url: string, name: string, type: string}>, index: number) => {
    const imageFiles = files.filter(file => isImageFile(file.name));
    if (imageFiles.length > 0) {
      setLightboxImages(imageFiles);
      setLightboxIndex(index);
      setLightboxOpen(true);
    }
  };

  // Lightbox component
  const Lightbox = () => {
    if (!lightboxOpen || lightboxImages.length === 0) return null;

    const currentImage = lightboxImages[lightboxIndex];
    const canGoNext = lightboxIndex < lightboxImages.length - 1;
    const canGoPrev = lightboxIndex > 0;

    const nextImage = () => {
      if (canGoNext) {
        setLightboxIndex(lightboxIndex + 1);
      }
    };

    const prevImage = () => {
      if (canGoPrev) {
        setLightboxIndex(lightboxIndex - 1);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setLightboxOpen(false);
      } else if (e.key === 'ArrowRight') {
        nextImage();
      } else if (e.key === 'ArrowLeft') {
        prevImage();
      }
    };

    useEffect(() => {
      if (lightboxOpen) {
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
      }
    }, [lightboxOpen, lightboxIndex]);

    return (
      <div className="fixed inset-0 bg-black/90 z-[2000] flex items-center justify-center p-4">
        <div className="relative max-w-7xl max-h-full w-full h-full flex items-center justify-center">
          {/* Close button */}
          <button
            onClick={() => setLightboxOpen(false)}
            className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Navigation buttons */}
          {canGoPrev && (
            <button
              onClick={prevImage}
              className="absolute left-4 top-1/2 -translate-y-1/2 z-10 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
          )}
          
          {canGoNext && (
            <button
              onClick={nextImage}
              className="absolute right-4 top-1/2 -translate-y-1/2 z-10 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          )}

          {/* Image */}
          <img
            src={currentImage.url}
            alt={currentImage.name}
            className="max-w-full max-h-full object-contain"
          />

          {/* Image info */}
          <div className="absolute bottom-4 left-4 right-4 text-white text-center">
            <p className="font-medium">{currentImage.name}</p>
            <p className="text-sm text-white/70">
              {lightboxIndex + 1} of {lightboxImages.length}
            </p>
          </div>
        </div>
      </div>
    );
  };

  // Performance optimized image thumbnail component
  const ImageThumbnail = ({ file, index, onClick }: { file: {id: string, name: string, url: string, size: number, type: string}, index: number, onClick: () => void }) => {
    const [imageLoaded, setImageLoaded] = useState(false);
    const [imageError, setImageError] = useState(false);
    const [isInView, setIsInView] = useState(false);
    const imgRef = useRef<HTMLImageElement>(null);

    useEffect(() => {
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            setIsInView(true);
            observer.disconnect();
          }
        },
        { threshold: 0.1 }
      );

      if (imgRef.current) {
        observer.observe(imgRef.current);
      }

      return () => observer.disconnect();
    }, []);

    return (
      <div
        ref={imgRef}
        className="group relative aspect-square bg-gray-100 rounded-lg overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
        onClick={onClick}
      >
        {isInView && !imageError && (
          <img
            src={file.url}
            alt={file.name}
            className={cn(
              "w-full h-full object-cover group-hover:scale-105 transition-all duration-200",
              imageLoaded ? "opacity-100" : "opacity-0"
            )}
            onLoad={() => setImageLoaded(true)}
            onError={() => setImageError(true)}
            loading="lazy"
          />
        )}
        
        {/* Loading state */}
        {isInView && !imageLoaded && !imageError && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        
        {/* Error state */}
        {imageError && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
            <div className="text-center">
              <ImageIcon className="w-8 h-8 text-gray-400 mx-auto mb-2" />
              <p className="text-xs text-gray-500">Failed to load</p>
            </div>
          </div>
        )}
        
        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
          <div className="opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="w-8 h-8 rounded-full bg-white/90 flex items-center justify-center">
              <Eye className="w-4 h-4 text-gray-700" />
            </div>
          </div>
        </div>
        
        {/* File name overlay */}
        <div className="absolute bottom-2 left-2 right-2">
          <p className="text-xs text-white bg-black/50 px-2 py-1 rounded truncate">
            {file.name}
          </p>
        </div>
      </div>
    );
  };

  // File gallery component
  const FileGallery = ({ files, title, type }: { files: Array<{id: string, name: string, url: string, size: number, type: string}>, title: string, type: string }) => {
    const imageFiles = files.filter(file => isImageFile(file.name));
    const documentFiles = files.filter(file => !isImageFile(file.name));

    return (
      <div className="space-y-4">
        <h5 className="font-medium text-foreground">{title}</h5>
        
        {/* Image Gallery */}
        {imageFiles.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Images</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {imageFiles.map((file, index) => (
                <ImageThumbnail
                  key={file.id}
                  file={file}
                  index={index}
                  onClick={() => openLightbox(imageFiles, index)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Document Files */}
        {documentFiles.length > 0 && (
          <div className="space-y-2">
            {imageFiles.length > 0 && <p className="text-sm text-muted-foreground">Documents</p>}
            <div className="space-y-2">
              {documentFiles.map((file) => (
                <div key={file.id} className="group bg-white border border-border rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-3">
                    <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", getFileTypeColor(file.type))}>
                      {getFileIcon(file.type)}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground truncate">{file.name}</p>
                      <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => window.open(file.url, '_blank')}
                      variant="outline"
                    >
                      <Download className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  if (!isOpen || !listingId) return null;

  return (
    <>
      {/* Lightbox */}
      <Lightbox />
      
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
                  {listing?.listing_type === 'residential' ? 'Residential' : 'Commercial'} Property Requirement
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

          {/* Scrollable Content */}
          <div className="overflow-y-auto flex-1">
            {isLoading ? (
              <div className="p-4 md:p-6 space-y-8">
                {/* Loading skeleton */}
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
                          {listing.listing_type === 'residential' ? (
                            <Home className="w-8 h-8 text-white" />
                          ) : (
                            <Building2 className="w-8 h-8 text-white" />
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="heading-3 text-foreground mb-2">
                        {listing.company.name}
                      </h3>
                      <p className="text-sm text-muted-foreground mb-3">
                        {listing.description}
                      </p>
                      
                      {/* Quick Info Summary - Conditional based on listing type */}
                      <div className="space-y-3">
                        {/* Commercial specific fields */}
                        {listing.listing_type === 'commercial' && (
                          <>
                            {/* Sectors Summary */}
                            {listing.company.sectors && listing.company.sectors.length > 0 && (
                              <div className="flex items-center gap-2">
                                <Building2 className="w-4 h-4 text-primary-500" />
                                <span className="text-sm font-medium text-foreground">Sectors:</span>
                                <SectorSummary sectors={listing.company.sectors} />
                              </div>
                            )}
                            
                            {/* Use Classes Summary */}
                            {listing.company.use_classes && listing.company.use_classes.length > 0 && (
                              <div className="flex items-center gap-2">
                                <Zap className="w-4 h-4 text-primary-500" />
                                <span className="text-sm font-medium text-foreground">Use Classes:</span>
                                <UseClassSummary useClasses={listing.company.use_classes} />
                              </div>
                            )}
                            
                            {/* Site Size */}
                            <div className="flex items-center gap-2">
                              <Square className="w-4 h-4 text-primary-500" />
                              <span className="text-sm font-medium text-foreground">Size:</span>
                              <span className="text-sm text-muted-foreground">{listing.company.site_size}</span>
                            </div>
                          </>
                        )}
                        
                        {/* Residential specific fields */}
                        {listing.listing_type === 'residential' && (
                          <>
                            <div className="flex items-center gap-2">
                              <Home className="w-4 h-4 text-primary-500" />
                              <span className="text-sm font-medium text-foreground">Dwellings:</span>
                              <span className="text-sm text-muted-foreground">{listing.company.dwelling_count}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Square className="w-4 h-4 text-primary-500" />
                              <span className="text-sm font-medium text-foreground">Site:</span>
                              <span className="text-sm text-muted-foreground">{listing.company.site_acreage}</span>
                            </div>
                          </>
                        )}
                        
                        {/* Location Summary */}
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-primary-500" />
                          <span className="text-sm font-medium text-foreground">Location:</span>
                          <LocationSummary 
                            locations={listing.locations?.all || []}
                            isNationwide={listing.locations?.is_nationwide || false}
                          />
                        </div>
                      </div>
                      
                      {/* Badges */}
                      <div className="flex flex-wrap gap-2 mt-4">
                        <Badge variant="outline" className="text-xs">
                          <Calendar className="w-3 h-3 mr-1" />
                          Posted {formatDate(listing.created_at)}
                        </Badge>
                        {listing.listing_type === 'commercial' && (
                          <Badge variant="secondary" className="text-xs">
                            Commercial
                          </Badge>
                        )}
                        {listing.listing_type === 'residential' && (
                          <Badge variant="secondary" className="text-xs">
                            Residential
                          </Badge>
                        )}
                        {listing.locations?.is_nationwide && (
                          <Badge className="bg-primary-500 text-primary-foreground text-xs">
                            Nationwide Search
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </div>


                {/* All Contacts - Equal Hierarchy */}
                <div className="space-y-4">
                  <button
                    onClick={() => toggleSection('contacts')}
                    className="w-full flex items-center justify-between p-0 text-left hover:text-primary-600 transition-colors"
                  >
                    <h4 className="heading-4 text-foreground flex items-center gap-2">
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
                    <>
                      {/* Primary Contact */}
                      <div className="bg-white border border-border rounded-lg p-4 hover:shadow-md transition-shadow">
                        <div className="flex items-start gap-4">
                          <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0">
                            <User className="w-6 h-6 text-primary-600" />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h5 className="font-medium text-foreground">{listing.contacts.primary.name}</h5>
                            </div>
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
                      </div>

                      {/* Additional Contacts */}
                      {listing.contacts.additional.length > 0 && (
                        <div className="space-y-3">
                          {listing.contacts.additional.map((contact, index) => (
                            <div key={index} className="bg-white border border-border rounded-lg p-4 hover:shadow-md transition-shadow">
                              <div className="flex items-start gap-4">
                                <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0">
                                  <User className="w-6 h-6 text-gray-500" />
                                </div>
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <h5 className="font-medium text-foreground">{contact.name}</h5>
                                  </div>
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
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* Sectors Section - Commercial only */}
                {listing.listing_type === 'commercial' && listing.company.sectors && listing.company.sectors.length > 0 && (
                  <div className="space-y-4">
                    <button
                      onClick={() => toggleSection('sectors')}
                      className="w-full flex items-center justify-between p-0 text-left hover:text-primary-600 transition-colors"
                    >
                      <h4 className="heading-4 text-foreground flex items-center gap-2">
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
                        <SmartList
                          items={listing.company.sectors}
                          maxShow={6}
                          type="sectors"
                          renderItem={(sector, index) => (
                            <Badge key={index} variant="outline" className="bg-blue-50 text-blue-800 border-blue-200">
                              <Building2 className="w-3 h-3 mr-1" />
                              {sector}
                            </Badge>
                          )}
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Use Classes Section - Commercial only */}
                {listing.listing_type === 'commercial' && listing.company.use_classes && listing.company.use_classes.length > 0 && (
                  <div className="space-y-4">
                    <button
                      onClick={() => toggleSection('use_classes')}
                      className="w-full flex items-center justify-between p-0 text-left hover:text-primary-600 transition-colors"
                    >
                      <h4 className="heading-4 text-foreground flex items-center gap-2">
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
                        <SmartList
                          items={listing.company.use_classes}
                          maxShow={6}
                          type="use classes"
                          renderItem={(useClass, index) => (
                            <Badge key={index} variant="outline" className="bg-green-50 text-green-800 border-green-200">
                              <Zap className="w-3 h-3 mr-1" />
                              {useClass}
                            </Badge>
                          )}
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Location Requirements */}
                <div className="space-y-4">
                  <button
                    onClick={() => toggleSection('locations')}
                    className="w-full flex items-center justify-between p-0 text-left hover:text-primary-600 transition-colors"
                  >
                    <h4 className="heading-4 text-foreground flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-primary-500" />
                      Location Requirements
                    </h4>
                    <div className="flex items-center gap-2">
                      {/* Nationwide badge if applicable */}
                      {listing.locations?.is_nationwide && (
                        <Badge className="bg-orange-100 text-orange-700 border-orange-200">
                          <MapPin className="w-3 h-3 mr-1" />
                          Nationwide
                        </Badge>
                      )}
                      {expandedSections.has('locations') ? (
                        <ChevronUp className="w-5 h-5 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-muted-foreground" />
                      )}
                    </div>
                  </button>
                  
                  {expandedSections.has('locations') && (
                    <div>
                      {/* Always show location info, with special treatment for nationwide */}
                      <div className="bg-gray-50 rounded-lg p-4">
                        {listing.locations?.is_nationwide ? (
                          <div className="space-y-4">
                            {/* Prominent nationwide callout */}
                            <div className="bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-lg p-4">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-orange-500 rounded-full flex items-center justify-center">
                                  <MapPin className="w-5 h-5 text-white" />
                                </div>
                                <div>
                                  <p className="font-semibold text-orange-800">Nationwide Search</p>
                                  <p className="text-sm text-orange-700">This company is open to opportunities across the entire UK</p>
                                </div>
                              </div>
                            </div>
                            
                            {/* Show specific locations if they exist alongside nationwide */}
                            {listing.locations?.all?.length > 0 && (
                              <div className="space-y-2">
                                <h5 className="font-medium text-foreground">Preferred Areas (but not limited to):</h5>
                                <SmartList
                                  items={listing.locations.all.map(loc => cleanLocationName(loc.place_name))}
                                  maxShow={4}
                                  type="locations"
                                  renderItem={(location, index) => (
                                    <Badge key={index} variant="outline" className="bg-orange-50 text-orange-800 border-orange-200">
                                      <MapPin className="w-3 h-3 mr-1" />
                                      {location}
                                    </Badge>
                                  )}
                                />
                                <p className="text-xs text-muted-foreground mt-2">
                                  * While these are preferred areas, the company will consider opportunities anywhere in the UK
                                </p>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <h5 className="font-medium text-foreground">Preferred Locations</h5>
                            {listing.locations?.all?.length > 0 ? (
                              <SmartList
                                items={listing.locations.all.map(loc => cleanLocationName(loc.place_name))}
                                maxShow={4}
                                type="locations"
                                renderItem={(location, index) => (
                                  <Badge key={index} variant="outline" className="bg-primary-50 text-primary-800 border-primary-200">
                                    <MapPin className="w-3 h-3 mr-1" />
                                    {location}
                                  </Badge>
                                )}
                              />
                            ) : (
                              <p className="text-sm text-muted-foreground italic">No specific location preferences specified</p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                {/* FAQs */}
                {listing.faqs.length > 0 && (
                  <div className="space-y-4">
                    <button
                      onClick={() => toggleSection('faqs')}
                      className="w-full flex items-center justify-between p-0 text-left hover:text-primary-600 transition-colors"
                    >
                      <h4 className="heading-4 text-foreground">
                        Frequently Asked Questions
                      </h4>
                      {expandedSections.has('faqs') ? (
                        <ChevronUp className="w-5 h-5 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-muted-foreground" />
                      )}
                    </button>
                    
                    {expandedSections.has('faqs') && (
                      <FAQAccordion faqs={listing.faqs} />
                    )}
                  </div>
                )}

                {/* Files & Documents - Conditional based on listing type */}
                {((listing.listing_type === 'commercial' && (listing.files.fit_outs.length > 0 || listing.files.site_plans.length > 0)) || 
                  listing.files.brochures.length > 0) && (
                  <div className="space-y-4">
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
                      <div className="grid md:grid-cols-2 gap-6">
                        {/* Brochures - Always show */}
                        {listing.files.brochures.length > 0 && (
                          <FileGallery
                            files={listing.files.brochures}
                            title="Company Brochures"
                            type="brochure"
                          />
                        )}

                        {/* Commercial-only files */}
                        {listing.listing_type === 'commercial' && (
                          <>
                            {/* Fit-outs */}
                            {listing.files.fit_outs.length > 0 && (
                              <FileGallery
                                files={listing.files.fit_outs}
                                title="Fit-out Examples"
                                type="fit_out"
                              />
                            )}

                            {/* Site Plans */}
                            {listing.files.site_plans.length > 0 && (
                              <FileGallery
                                files={listing.files.site_plans}
                                title="Site Plans"
                                type="site_plan"
                              />
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : null}
          </div>

          {/* Sticky Action Bar - Mobile */}
          {listing && (
            <div className="md:hidden sticky bottom-0 left-0 right-0 bg-white border-t border-border p-4 z-10 rounded-b-2xl">
              <div className="flex gap-3">
                <Button 
                  className="flex-1 violet-bloom-button h-12"
                  onClick={() => {
                    const email = listing.contacts.primary.email || listing.contacts.additional[0]?.email;
                    if (email) {
                      const subject = encodeURIComponent(`Property Enquiry: ${listing.title}`);
                      const body = encodeURIComponent(`Dear Team,\n\nI am interested in discussing your property requirement for ${listing.title}.\n\nBest regards`);
                      window.open(`mailto:${email}?subject=${subject}&body=${body}`);
                    }
                  }}
                >
                  <Mail className="w-4 h-4 mr-2" />
                  Send Enquiry
                </Button>
                
                {(listing.contacts.primary.phone || listing.contacts.additional[0]?.phone) && (
                  <Button 
                    variant="outline" 
                    className="flex-1 h-12"
                    onClick={() => {
                      const phone = listing.contacts.primary.phone || listing.contacts.additional[0]?.phone;
                      if (phone) {
                        window.open(`tel:${phone}`);
                      }
                    }}
                  >
                    <Phone className="w-4 h-4 mr-2" />
                    Call
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
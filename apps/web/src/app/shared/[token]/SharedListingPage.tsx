'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { 
  ArrowLeft, 
  Share2, 
  ExternalLink, 
  AlertTriangle,
  Loader2,
  Building2,
  Globe
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EnhancedListingModalContent } from '@/types/search';
import { toast, Toaster } from 'sonner';
import { cn } from '@/lib/utils';

// Import the same components used in the modal
import { VisualHeroSection } from '@/components/listings/ImmersiveListingModal/components/VisualHeroSection';
import { useMobileBreakpoint } from '@/components/listings/ImmersiveListingModal/hooks/useMobileBreakpoint';
import { MobileVisualHero } from '@/components/listings/ImmersiveListingModal/MobileVisualHero';
import { MobileTabNavigation } from '@/components/listings/ImmersiveListingModal/MobileTabNavigation';
import { SimpleMobileBottomSheet } from '@/components/listings/ImmersiveListingModal/SimpleMobileBottomSheet';

interface SharedListingPageProps {
  token: string;
}

export function SharedListingPage({ token }: SharedListingPageProps) {
  const [listing, setListing] = useState<EnhancedListingModalContent | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [showToast, setShowToast] = useState(false);
  const { isMobile } = useMobileBreakpoint();
  const router = useRouter();

  // Memoize tabs array to prevent unnecessary re-renders, conditionally include FAQs
  const tabs = useMemo(() => {
    const baseTabs = [
      { id: 'overview', label: 'overview' },
      { id: 'requirements', label: 'requirements' },
      { id: 'locations', label: 'locations' },
      { id: 'contact', label: 'contact' }
    ];

    // Only add FAQs tab if there are FAQs
    if (listing?.faqs && listing.faqs.length > 0) {
      baseTabs.push({ id: 'faqs', label: 'faqs' });
    }

    return baseTabs;
  }, [listing?.faqs]);

  const handleTabChange = useCallback((tabId: string) => {
    setActiveTab(tabId);
  }, []);

  useEffect(() => {
    fetchSharedListing();
  }, [token]);

  const fetchSharedListing = async () => {
    try {
      const response = await fetch(`/api/public/shared/${token}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to load shared listing');
        return;
      }

      const data = await response.json();
      setListing(data);
    } catch (err) {
      setError('Failed to load shared listing');
      console.error('Error fetching shared listing:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const copyShareLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      
      // Show desktop toast or mobile button feedback
      if (window.innerWidth >= 768) {
        // Desktop: use sonner toast
        toast.success('Link Copied!');
      } else {
        // Mobile: use button feedback
        setShowToast(true);
        setTimeout(() => setShowToast(false), 2000);
      }
    } catch (err) {
      console.error('Failed to copy link:', err);
      if (window.innerWidth >= 768) {
        toast.error('Failed to copy link');
      }
    }
  };


  // Render tab content (same as modal)
  const renderTabContent = () => {
    if (isLoading) {
      return (
        <div className="p-6 space-y-4">
          <div className="h-8 bg-gray-200 rounded animate-pulse" />
          <div className="h-4 bg-gray-200 rounded animate-pulse" />
          <div className="h-4 bg-gray-200 rounded animate-pulse w-3/4" />
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex items-center justify-center h-full p-6">
          <p className="text-gray-500">{error}</p>
        </div>
      );
    }

    if (!listing) return null;

    return (
      <div className="p-6">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold">Requirements In {listing?.company?.name || 'Company'}'s Own Words</h3>

            {/* Requirements Brochures */}
            {listing.files?.brochures && listing.files.brochures.length > 0 && (
              <div className="p-4 rounded-lg bg-blue-50 border border-blue-200">
                <div className="space-y-2">
                  {listing.files.brochures.map((file: any, index: number) => (
                    <a
                      key={index}
                      href={file.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 p-3 bg-white rounded-lg border hover:border-blue-300 transition-colors"
                    >
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                        <span className="text-blue-600 font-medium text-sm">PDF</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate">{file.name}</p>
                        <p className="text-sm text-gray-500">
                          {file.size && `${Math.round(file.size / 1024)} KB`}
                        </p>
                      </div>
                      <ExternalLink className="w-4 h-4 text-gray-400" />
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Company Website Link */}
            {listing.company.property_page_link && (
              <div className="p-4 rounded-lg bg-gray-50 border">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium text-gray-900 mb-1">Learn More</h4>
                    <p className="text-sm text-gray-600">Visit the company website for more information</p>
                  </div>
                  <Button asChild>
                    <a 
                      href={listing.company.property_page_link} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex items-center gap-2"
                    >
                      <Globe className="h-4 w-4" />
                      Visit Website
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'requirements' && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold">Requirements</h3>
            
            {/* Site Size Requirements */}
            {listing.listing_type === 'commercial' && listing.company?.site_size && (
              <div className="p-4 rounded-lg bg-gray-50 border border-gray-200">
                <h4 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
                  <span className="text-violet-500">📐</span>
                  Site Size
                </h4>
                <p className="text-gray-700">{listing.company?.site_size}</p>
              </div>
            )}

            {/* Dwelling Count (for residential) */}
            {listing.listing_type === 'residential' && listing.company?.dwelling_count && (
              <div className="p-4 rounded-lg bg-gray-50 border border-gray-200">
                <h4 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
                  <span className="text-violet-500">🏠</span>
                  Dwelling Count
                </h4>
                <p className="text-gray-700">{listing.company?.dwelling_count}</p>
              </div>
            )}

            {/* Site Acreage (for residential) */}
            {listing.listing_type === 'residential' && listing.company?.site_acreage && (
              <div className="p-4 rounded-lg bg-gray-50 border border-gray-200">
                <h4 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
                  <span className="text-violet-500">🌾</span>
                  Site size (acres)
                </h4>
                <p className="text-gray-700">{listing.company?.site_acreage}</p>
              </div>
            )}

            {/* Sectors */}
            {listing.listing_type === 'commercial' && listing.company?.sectors && listing.company.sectors.length > 0 && (
              <div className="p-4 rounded-lg bg-blue-50 border border-blue-200">
                <div className="flex flex-wrap gap-2">
                  {listing.company?.sectors?.map((sector, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800 border border-blue-200"
                    >
                      {sector}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Use Classes */}
            {listing.listing_type === 'commercial' && listing.company?.use_classes && listing.company.use_classes.length > 0 && (
              <div className="p-4 rounded-lg bg-green-50 border border-green-200">
                <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                  <span className="text-green-500">🏗️</span>
                  Use Classes
                </h4>
                <div className="flex flex-wrap gap-2">
                  {listing.company?.use_classes?.map((useClass, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800 border border-green-200"
                    >
                      {useClass}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Empty state */}
            {((listing.listing_type === 'commercial' && 
               !listing.company?.site_size && 
               (!listing.company?.sectors || listing.company.sectors?.length === 0) && 
               (!listing.company?.use_classes || listing.company.use_classes?.length === 0)) ||
              (listing.listing_type === 'residential' && 
               !listing.company?.dwelling_count && 
               !listing.company?.site_acreage)) && (
              <div className="p-8 rounded-lg bg-gray-50 text-center border border-gray-200">
                <div className="w-16 h-16 bg-violet-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-violet-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm3 1h6v4H7V5zm8 8v2a1 1 0 01-1 1H6a1 1 0 01-1-1v-2h8z" clipRule="evenodd"/>
                  </svg>
                </div>
                <h4 className="font-semibold text-gray-900 mb-2">Requirements Not Specified</h4>
                <p className="text-gray-600 text-sm max-w-sm mx-auto">
                  This listing hasn't specified detailed requirements yet. 
                  <br />Please contact the team directly for more information.
                </p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'locations' && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Locations</h3>
            
            {listing.locations?.all && listing.locations.all.length > 0 ? (
              <div className="space-y-3">
                {listing.locations.all.map((location: any, index: number) => (
                  <div 
                    key={index} 
                    className="p-4 rounded-lg bg-white border border-gray-200 shadow-sm hover:shadow-md hover:border-violet-200 transition-all duration-200"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-violet-600 flex items-center justify-center flex-shrink-0 shadow-sm">
                        <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-gray-900 leading-snug">
                          {location.place_name || 'Unknown location'}
                        </h4>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-6 rounded-lg bg-gradient-to-br from-violet-50 via-white to-blue-50/30 border border-violet-100 shadow-sm">
                <div className="text-center">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-violet-500 to-violet-600 flex items-center justify-center mx-auto mb-3 shadow-sm">
                    <span className="text-2xl">🌍</span>
                  </div>
                  <h4 className="font-semibold text-gray-900 mb-1">All locations considered</h4>
                  <p className="text-sm text-gray-600 mb-3">
                    No specific target locations have been specified.
                  </p>
                  <div className="inline-flex items-center gap-2 px-3 py-1 bg-violet-100 rounded-full">
                    <div className="w-2 h-2 bg-violet-500 rounded-full animate-pulse"></div>
                    <span className="text-xs font-medium text-violet-700">National Reach</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'contact' && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Contact</h3>
            
            {listing.contacts?.primary ? (
              <div className="space-y-4">
                <div className="p-4 rounded-lg bg-white border border-gray-200 shadow-sm hover:shadow-md hover:border-violet-200 transition-all duration-200">
                  <div className="flex items-start gap-4">
                    {listing.contacts.primary.headshot_url ? (
                      <img
                        src={listing.contacts.primary.headshot_url}
                        alt={listing.contacts.primary.name}
                        className="w-12 h-12 rounded-full object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-violet-100 flex items-center justify-center flex-shrink-0">
                        <span className="text-violet-600 text-lg font-medium">
                          {listing.contacts.primary.name ? listing.contacts.primary.name.charAt(0).toUpperCase() : 'C'}
                        </span>
                      </div>
                    )}
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900">{listing.contacts.primary.name}</h4>
                      <p className="text-sm text-gray-600 mt-1">{listing.contacts.primary.title}</p>
                      {listing.contacts.primary.contact_area && (
                        <span className="inline-block px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded-full mt-1">
                          {listing.contacts.primary.contact_area}
                        </span>
                      )}
                      <div className="mt-3 space-y-2">
                        <div className="flex items-center gap-2 text-sm">
                          <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z"/>
                            <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z"/>
                          </svg>
                          <a 
                            href={`mailto:${listing.contacts.primary.email}`} 
                            className="text-violet-600 hover:text-violet-700 transition-colors duration-200 font-medium"
                          >
                            {listing.contacts.primary.email}
                          </a>
                        </div>
                        {listing.contacts.primary.phone && (
                          <div className="flex items-center gap-2 text-sm">
                            <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z"/>
                            </svg>
                            <a 
                              href={`tel:${listing.contacts.primary.phone}`} 
                              className="text-violet-600 hover:text-violet-700 transition-colors duration-200 font-medium"
                            >
                              {listing.contacts.primary.phone}
                            </a>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {listing.contacts.additional?.map((contact: any, index: number) => (
                  <div key={contact.id || index} className="p-4 rounded-lg bg-white border border-gray-200 shadow-sm hover:shadow-md hover:border-violet-200 transition-all duration-200">
                    <div className="flex items-start gap-4">
                      {contact.headshot_url ? (
                        <img
                          src={contact.headshot_url}
                          alt={contact.name}
                          className="w-12 h-12 rounded-full object-cover flex-shrink-0"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-violet-100 flex items-center justify-center flex-shrink-0">
                          <span className="text-violet-600 text-lg font-medium">
                            {contact.name ? contact.name.charAt(0).toUpperCase() : 'C'}
                          </span>
                        </div>
                      )}
                      <div className="flex-1">
                        <h4 className="font-semibold text-gray-900">{contact.name}</h4>
                        <p className="text-sm text-gray-600 mt-1">{contact.title}</p>
                        {contact.contact_area && (
                          <span className="inline-block px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded-full mt-1">
                            {contact.contact_area}
                          </span>
                        )}
                        <div className="mt-3 space-y-2">
                          <div className="flex items-center gap-2 text-sm">
                            <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z"/>
                              <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z"/>
                            </svg>
                            <a 
                              href={`mailto:${contact.email}`} 
                              className="text-violet-600 hover:text-violet-700 transition-colors duration-200 font-medium"
                            >
                              {contact.email}
                            </a>
                          </div>
                          {contact.phone && (
                            <div className="flex items-center gap-2 text-sm">
                              <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z"/>
                              </svg>
                              <a 
                                href={`tel:${contact.phone}`} 
                                className="text-violet-600 hover:text-violet-700 transition-colors duration-200 font-medium"
                              >
                                {contact.phone}
                              </a>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 rounded-lg bg-gray-50 text-center border border-gray-200">
                <div className="w-16 h-16 bg-violet-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-violet-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm3 1h6v4H7V5zm8 8v2a1 1 0 01-1 1H6a1 1 0 01-1-1v-2h8z" clipRule="evenodd"/>
                  </svg>
                </div>
                <h4 className="font-semibold text-gray-900 mb-2">Contact Team</h4>
                <p className="text-gray-600 text-sm max-w-sm mx-auto">
                  Our property specialists are preparing their contact information. 
                  <br />Please check back shortly or reach out via our general inquiry system.
                </p>
              </div>
            )}

            {/* Appointed Agents Section - Only show if there are agents */}
            {(listing.listing_agents?.length || 0) > 0 && (
              <div className="mt-8 pt-8 border-t border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">{listing.listing_agents?.length === 1 ? 'Appointed Agent' : 'Appointed Agents'}</h3>

                <div className="space-y-4">
                  {listing.listing_agents?.map((agent: any) => (
                    <div key={agent.id} className="bg-gradient-to-br from-white via-violet-50/30 to-white rounded-2xl border border-violet-200/50 shadow-lg hover:shadow-xl transition-all duration-300 p-6 sm:p-8 ring-1 ring-violet-100/50 hover:ring-violet-200/70">
                      {/* Mobile-optimized layout */}
                      <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
                        {/* Agency Logo */}
                        <div className="flex-shrink-0">
                          {agent.agency.logo_url ? (
                            <div className="relative group">
                              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-white border-2 border-violet-100 p-3 flex items-center justify-center shadow-lg ring-2 ring-violet-50 group-hover:ring-violet-100 transition-all duration-300">
                                <img
                                  src={agent.agency.logo_url}
                                  alt={`${agent.agency.name} logo`}
                                  className="w-full h-full object-contain"
                                />
                              </div>
                              {/* Enhanced glow effect */}
                              <div className="absolute inset-0 w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-gradient-to-br from-violet-500/20 to-purple-500/20 -z-10 blur-sm group-hover:from-violet-500/30 group-hover:to-purple-500/30 transition-all duration-300"></div>
                            </div>
                          ) : (
                            <div className="relative group">
                              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-gradient-to-br from-violet-50 to-purple-100 border-2 border-violet-200/50 flex items-center justify-center shadow-lg ring-2 ring-violet-100/50">
                                <svg className="w-10 h-10 sm:w-12 sm:h-12 text-violet-600" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm3 5a2 2 0 114 0v1h-4V9zM8 5a1 1 0 100 2h4a1 1 0 100-2H8z" clipRule="evenodd" />
                                </svg>
                              </div>
                              <div className="absolute inset-0 w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-gradient-to-br from-violet-500/20 to-purple-500/20 -z-10 blur-sm"></div>
                            </div>
                          )}
                        </div>

                        {/* Agency Info */}
                        <div className="flex-1 min-w-0 text-center sm:text-left">
                          <div className="mb-6">
                            <h4 className="text-2xl font-bold text-gray-900 mb-2 tracking-tight">
                              {agent.agency.name}
                            </h4>
                            <p className="text-violet-600 font-medium text-base">
                              Appointed Property Agent
                            </p>
                            {agent.agency.geographic_patch && (
                              <p className="text-gray-600 text-sm mt-1">
                                {agent.agency.geographic_patch}
                              </p>
                            )}
                            {agent.agency.classification && (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-violet-100 text-violet-800 mt-2">
                                {agent.agency.classification === 'Both' ? 'Commercial and Residential' : agent.agency.classification}
                              </span>
                            )}
                          </div>

                          {/* Enhanced CTA Button */}
                          <div className="flex justify-center sm:justify-start">
                            <button
                              className="group relative overflow-hidden bg-gradient-to-r from-violet-600 via-purple-600 to-violet-700 text-white px-8 py-4 rounded-xl font-semibold hover:from-violet-700 hover:via-purple-700 hover:to-violet-800 transition-all duration-300 shadow-lg hover:shadow-2xl hover:shadow-violet-500/25 transform hover:-translate-y-1 active:translate-y-0 flex items-center justify-center gap-3 min-w-[200px]"
                            >
                              <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
                              <svg className="w-5 h-5 transition-transform group-hover:scale-110" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd"/>
                              </svg>
                              <span className="relative z-10">View Agency Profile</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'faqs' && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold">Frequently Asked Questions</h3>
            
            <div className="space-y-3">
              {(listing.faqs || []).map((faq) => (
                <div
                  key={faq.id}
                  className="p-4 rounded-lg bg-white border border-gray-200 shadow-sm hover:border-violet-200 transition-colors"
                >
                  <h4 className="font-semibold text-gray-900 mb-2 flex items-start gap-2">
                    <span className="text-violet-500 font-bold text-lg">Q:</span>
                    {faq.question}
                  </h4>
                  <p className="text-gray-600 text-sm leading-relaxed pl-6">
                    <span className="text-violet-500 font-bold mr-1">A:</span>
                    {faq.answer}
                  </p>
                </div>
              ))}
            </div>

            {(!listing.faqs || listing.faqs.length === 0) && (
              <div className="p-8 rounded-lg bg-gray-50 text-center border border-gray-200">
                <div className="w-16 h-16 bg-violet-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-violet-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                  </svg>
                </div>
                <h4 className="font-semibold text-gray-900 mb-2">No FAQs Available</h4>
                <p className="text-gray-600 text-sm max-w-sm mx-auto">
                  No frequently asked questions have been added for this listing yet. 
                  <br />Please contact our team directly for any specific questions.
                </p>
              </div>
            )}

            <div className="mt-6 p-4 rounded-lg bg-violet-50 border border-violet-200">
              <h4 className="font-semibold text-violet-900 mb-2 flex items-center gap-2">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                </svg>
                Still have questions?
              </h4>
              <button
                onClick={() => setActiveTab('contact')}
                className="text-violet-700 text-sm hover:text-violet-800 underline transition-colors"
              >
                Contact {listing.company?.name || 'the team'} to find out more
              </button>
            </div>
          </div>
        )}

      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white">
        {/* Header Bar - Same as modal */}
        <div className="flex items-center justify-between px-6 py-4 bg-white/95 backdrop-blur-md border-b border-gray-200">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => router.back()}
            className="flex items-center justify-center"
            style={{ minWidth: '44px', minHeight: '44px' }}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </div>

        {/* Loading content */}
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="text-center">
            <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-violet-500" />
            <p className="text-lg font-medium text-gray-900">Loading shared listing...</p>
            <p className="text-gray-600">Please wait while we fetch the details</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !listing) {
    return (
      <div className="min-h-screen bg-white">
        {/* Header Bar - Same as modal */}
        <div className="flex items-center justify-between px-6 py-4 bg-white/95 backdrop-blur-md border-b border-gray-200">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => router.back()}
            className="flex items-center justify-center"
            style={{ minWidth: '44px', minHeight: '44px' }}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </div>

        {/* Error content */}
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="max-w-md mx-auto text-center p-6">
            <AlertTriangle className="h-16 w-16 text-red-500 mx-auto mb-4" />
            <h1 className="text-2xl font-semibold mb-2 text-gray-900">Listing Not Available</h1>
            <p className="text-gray-600 mb-6">
              {error || 'The shared listing could not be found or is no longer available.'}
            </p>
            <Button onClick={() => router.push('/')}>
              Go to Homepage
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Mobile Layout (similar to modal mobile layout)
  if (isMobile) {
    return (
      <div className="min-h-screen bg-white">
        {/* Mobile Header - Same as modal */}
        <div className="flex items-center justify-between px-4 py-3 bg-white/95 backdrop-blur-md border-b border-gray-200 sticky top-0 z-50">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => router.back()}
            className="flex items-center justify-center"
            style={{ minWidth: '44px', minHeight: '44px' }}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Share2 className="h-4 w-4" />
            Shared listing
          </div>
          
          {/* Share actions */}
          <div className="flex items-center gap-1">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={copyShareLink}
              style={{ backgroundColor: showToast ? '#10b981' : 'transparent', color: showToast ? 'white' : 'inherit' }}
            >
              <Share2 className="h-4 w-4" />
              {showToast && <span className="ml-1 text-xs">✓</span>}
            </Button>
          </div>
        </div>

        {/* Mobile Visual Hero - Match modal sizing */}
        <div className="relative bg-gradient-to-br from-violet-900 to-violet-700" style={{ height: 'calc(100vh - 64px - 88px)' }}>
          <MobileVisualHero 
            listing={listing}
            isLoading={isLoading}
          />
        </div>

        {/* Mobile Bottom Sheet */}
        <SimpleMobileBottomSheet
          peekContent={
            <div className="p-4">
              <div className="flex items-center gap-3 mb-4">
                {listing.company?.logo_url && !listing.company?.use_clearbit_fallback ? (
                  <img
                    src={listing.company.logo_url}
                    alt={`${listing.company.name} logo`}
                    className="w-12 h-12 object-contain"
                    onError={(e) => {
                      if (listing?.company?.use_clearbit_fallback) {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                        const fallback = target.nextElementSibling as HTMLElement;
                        if (fallback) fallback.style.display = 'flex';
                      }
                    }}
                  />
                ) : null}
                {(!listing.company?.logo_url || listing?.company?.use_clearbit_fallback) && (
                  <div className="w-12 h-12 bg-gradient-to-br from-violet-500 to-violet-600 rounded-lg flex items-center justify-center" style={{ display: listing?.company.logo_url ? 'none' : 'flex' }}>
                    <span className="text-white font-semibold text-lg">
                      {listing.company?.name?.charAt(0).toUpperCase() || 'C'}
                    </span>
                  </div>
                )}
                <div>
                  <h2 className="text-xl font-bold text-gray-900">
                    {listing.company?.name || 'Unnamed Company'}
                  </h2>
                  <div className="flex items-center gap-4 text-sm text-gray-600">
                    <span>{listing.listing_type === 'residential' ? 'Residential' : 'Commercial'}</span>
                    <span>📍 {listing.locations?.all && listing.locations.all.length > 0 ? `${listing.locations.all.length} Locations` : 'Nationwide'}</span>
                  </div>
                </div>
              </div>
            </div>
          }
          fullContent={
            <div className="flex flex-col h-full">
              {/* Mobile Tab Navigation */}
              <MobileTabNavigation
                tabs={tabs}
                activeTab={activeTab}
                onTabChange={handleTabChange}
                companyName={listing.company?.name || 'Company'}
              />

              {/* Tab Content */}
              <div className="flex-1 overflow-y-auto">
                {renderTabContent()}
              </div>
            </div>
          }
        />
      </div>
    );
  }

  // Desktop Layout (identical to modal desktop layout)
  return (
    <>
      {/* Toast for desktop */}
      <Toaster 
        position="top-right"
        toastOptions={{
          duration: 4000,
        }}
      />
      
      <div className="h-screen bg-white flex flex-col overflow-hidden">
      {/* Header Bar - Same as modal */}
      <div className="flex items-center justify-between px-6 py-4 bg-white/95 backdrop-blur-md border-b border-gray-200 flex-shrink-0">
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => router.back()}
          className="flex items-center justify-center"
          style={{ minWidth: '44px', minHeight: '44px' }}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Share2 className="h-4 w-4" />
          Shared listing
        </div>
        
        {/* Share actions */}
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={copyShareLink}>
            <Share2 className="h-4 w-4 mr-2" />
            Copy Link
          </Button>
        </div>
      </div>

      {/* Split Layout Container - Takes remaining height after header */}
      <div className="flex flex-1 min-h-0">
        {/* Visual Hero Section - 40% width, fills available height, never scrolls */}
        <div className="w-2/5 h-full overflow-hidden bg-gradient-to-br from-violet-900 to-violet-700">
          <VisualHeroSection
            listing={listing}
            isLoading={isLoading}
          />
        </div>

        {/* Information Panel - 60% width, scrollable content */}
        <div className="w-3/5 h-full overflow-y-auto bg-white">
          <div className="flex flex-col">
            {/* Company Hero Card - Same as modal */}
            <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-violet-50 to-violet-100">
              <div className="flex items-center gap-4">
                {listing.company?.logo_url && !listing.company?.use_clearbit_fallback ? (
                  <img
                    src={listing.company.logo_url}
                    alt={`${listing.company.name} logo`}
                    className="w-12 h-12 object-contain"
                    onError={(e) => {
                      if (listing?.company?.use_clearbit_fallback) {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                        const fallback = target.nextElementSibling as HTMLElement;
                        if (fallback) fallback.style.display = 'flex';
                      }
                    }}
                  />
                ) : null}
                {(!listing.company?.logo_url || listing?.company?.use_clearbit_fallback) && (
                  <div className="w-12 h-12 bg-gradient-to-br from-violet-500 to-violet-600 rounded-lg flex items-center justify-center" style={{ display: listing?.company.logo_url ? 'none' : 'flex' }}>
                    <span className="text-white font-semibold">
                      {listing.company?.name?.charAt(0).toUpperCase() || 'C'}
                    </span>
                  </div>
                )}
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">
                    {listing.company?.name || 'Unnamed Company'}
                  </h2>
                  <div className="flex items-center gap-4 mt-1 text-sm text-gray-600">
                    <span>{listing.listing_type === 'residential' ? 'Residential' : 'Commercial'}</span>
                    <span>📍 {listing.locations?.all && listing.locations.all.length > 0 ? `${listing.locations.all.length} Locations` : 'Nationwide'}</span>
                    {listing.listing_type === 'commercial' && listing.company?.site_size && (
                      <span>📐 {listing.company?.site_size}</span>
                    )}
                    {listing.listing_type === 'residential' && listing.company?.site_acreage && (
                      <span>🌾 {listing.company?.site_acreage}</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Tab Navigation - Same as modal */}
            <div className="flex border-b border-gray-200 overflow-x-auto md:overflow-visible">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "px-6 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
                    "hover:text-violet-600 hover:border-violet-300",
                    activeTab === tab.id
                      ? "text-violet-600 border-violet-500"
                      : "text-gray-500 border-transparent"
                  )}
                >
                  {tab.id === 'overview' ? `From ${listing?.company?.name || 'Company'}` :
                   tab.id === 'faqs' ? 'FAQs' :
                   tab.id.charAt(0).toUpperCase() + tab.id.slice(1)}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="flex-1">
              {renderTabContent()}
            </div>
          </div>
        </div>
      </div>
    </div>
    </>
  );
}
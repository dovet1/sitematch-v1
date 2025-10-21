'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Building2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { AgencyModal } from '@/components/agencies/AgencyModal';
import { EnhancedListingModalContent, ListingModalProps } from '@/types/search';
import { VisualHeroSection } from './components/VisualHeroSection';
import { useMobileBreakpoint } from './hooks/useMobileBreakpoint';
import { SimpleMobileBottomSheet } from './SimpleMobileBottomSheet';
import { MobileVisualHero } from './MobileVisualHero';
import { MobileTabNavigation } from './MobileTabNavigation';
import styles from './ImmersiveListingModal.module.css';

interface ImmersiveListingModalProps {
  listingId: string | null;
  isOpen: boolean;
  onClose: () => void;
  searchState?: any;
  scrollPosition?: number;
  apiEndpoint?: string; // Allow custom API endpoint for owner preview
}

export function ImmersiveListingModal({
  listingId,
  isOpen,
  onClose,
  searchState,
  scrollPosition,
  apiEndpoint
}: ImmersiveListingModalProps) {
  const [listing, setListing] = useState<EnhancedListingModalContent | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [listingAgents, setListingAgents] = useState<any[]>([]);
  const [agencyLoading, setAgencyLoading] = useState(false);
  const { isMobile } = useMobileBreakpoint();
  const router = useRouter();
  const [selectedAgencyId, setSelectedAgencyId] = useState<string | null>(null);
  
  // Stable callbacks to prevent gesture hook recreation
  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);
  
  const handleTabChange = useCallback((tabId: string) => {
    setActiveTab(tabId);
  }, []);
  
  // Memoize tabs array to prevent unnecessary re-renders
  // Filter out FAQs tab if there are no FAQs
  const tabs = useMemo(() => {
    const allTabs = [
      { id: 'overview', label: 'overview' },
      { id: 'requirements', label: 'requirements' },
      { id: 'locations', label: 'target locations' },
      { id: 'contact', label: 'contact' },
      { id: 'faqs', label: 'faqs' },
      { id: 'agent', label: 'agent' }
    ];

    // Hide FAQs tab if there are no FAQs
    if (!listing?.faqs || listing.faqs.length === 0) {
      return allTabs.filter(tab => tab.id !== 'faqs');
    }

    return allTabs;
  }, [listing?.faqs]);


  // Prevent body scroll and pull-to-refresh when modal is open on mobile
  useEffect(() => {
    if (isOpen && isMobile) {
      // Save current scroll position
      const scrollY = window.scrollY;
      
      // Prevent body scroll and pull-to-refresh
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';
      document.body.style.overscrollBehavior = 'none'; // Prevent pull-to-refresh
      
      // Also prevent overscroll on the document
      document.documentElement.style.overscrollBehavior = 'none';
      
      return () => {
        // Restore body scroll and overscroll behavior
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.width = '';
        document.body.style.overscrollBehavior = '';
        document.documentElement.style.overscrollBehavior = '';
        // Restore scroll position
        window.scrollTo(0, scrollY);
      };
    }
  }, [isOpen, isMobile]);
  
  // Animation variants
  const backdropVariants = {
    hidden: { opacity: 0 },
    visible: { 
      opacity: 1,
      transition: { duration: 0.3, ease: 'easeOut' }
    }
  };

  const modalVariants = {
    hidden: { 
      scale: 0.95,
      opacity: 0,
      y: 20
    },
    visible: {
      scale: 1,
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.4,
        ease: [0.4, 0, 0.2, 1],
        staggerChildren: 0.1
      }
    }
  };

  // Fetch listing data
  useEffect(() => {
    if (!isOpen || !listingId) return;

    const fetchListing = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        const endpoint = apiEndpoint || `/api/public/listings/${listingId}/detailed`;
        const timestamp = new Date().getTime();
        const urlWithTimestamp = `${endpoint}?t=${timestamp}`;
        const response = await fetch(urlWithTimestamp, {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache'
          }
        });

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
  }, [isOpen, listingId, apiEndpoint]);

  // Set listing agents from the listing data
  useEffect(() => {
    if (listing?.listing_agents) {
      setListingAgents(listing.listing_agents);
    } else {
      setListingAgents([]);
    }
    setAgencyLoading(false);
  }, [listing?.listing_agents]);

  if (!isOpen) return null;

  // Render tab content (shared between desktop and mobile)
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
                <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                  <span className="text-blue-500">📋</span>
                  Requirements Brochure
                </h4>
                <button
                  onClick={() => window.open(listing.files.brochures[0].url, '_blank')}
                  className="flex items-center gap-3 p-3 rounded-lg bg-white border border-blue-200 hover:border-blue-300 hover:bg-blue-50 transition-all duration-200 group w-full"
                >
                  <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0 group-hover:bg-blue-200 transition-colors">
                    <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 2v8h8V6H6z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-sm font-medium text-gray-900">
                      {listing?.company?.name || 'Company'}'s Requirement Brochure
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-blue-600 group-hover:text-blue-700">
                    <span className="text-xs font-medium">Download</span>
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </div>
                </button>
              </div>
            )}

            {/* Property Page Link */}
            {listing.company?.property_page_link && (
              <div className="p-4 rounded-lg bg-violet-50 border border-violet-200">
                <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                  <span className="text-violet-500">🔗</span>
                  Property Page
                </h4>
                <a
                  href={listing.company?.property_page_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-3 rounded-lg bg-white border border-violet-200 hover:border-violet-300 hover:bg-violet-50 transition-all duration-200 group"
                >
                  <div className="w-10 h-10 rounded-lg bg-violet-100 flex items-center justify-center flex-shrink-0 group-hover:bg-violet-200 transition-colors">
                    <svg className="w-5 h-5 text-violet-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M12.586 4.586a2 2 0 112.828 2.828l-3 3a2 2 0 01-2.828 0 1 1 0 00-1.414 1.414 4 4 0 005.656 0l3-3a4 4 0 00-5.656-5.656l-1.5 1.5a1 1 0 101.414 1.414l1.5-1.5a2 2 0 012.828 0z" clipRule="evenodd" />
                      <path fillRule="evenodd" d="M7.414 15.414a2 2 0 01-2.828-2.828l3-3a2 2 0 012.828 0 1 1 0 001.414-1.414 4 4 0 00-5.656 0l-3 3a4 4 0 005.656 5.656l1.5-1.5a1 1 0 00-1.414-1.414l-1.5 1.5z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">
                      View Requirement Details
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      {listing.company?.property_page_link}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-violet-600 group-hover:text-violet-700">
                    <span className="text-xs font-medium">Visit</span>
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </div>
                </a>
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
                <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                  <span className="text-blue-500">🏢</span>
                  Sectors
                </h4>
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
            <h3 className="text-lg font-semibold">Target Locations</h3>
            
            {listing.locations?.all && listing.locations.all.length > 0 ? (
              <div className="space-y-3">
                {listing.locations.all.map((location, index) => (
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
                  <h4 className="font-semibold text-gray-900 mb-1">Nationwide Coverage</h4>
                  <p className="text-sm text-gray-600 mb-3">
                    Open to opportunities across the UK & Ireland
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
            
            {(listing.contacts?.primary || listing.contacts?.additional?.length > 0) ? (
              <div className="space-y-4">
                {/* Display primary contact first, then additional contacts */}
                {[
                  ...(listing.contacts.primary ? [listing.contacts.primary] : []),
                  ...(listing.contacts.additional || [])
                ].map((contact, index) => (
                  <div 
                    key={contact.id || index} 
                    className="p-4 rounded-lg bg-white border border-gray-200 shadow-sm hover:shadow-md hover:border-violet-200 transition-all duration-200"
                  >
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
                          <div className="flex items-start gap-2 text-sm">
                            <svg className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z"/>
                              <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z"/>
                            </svg>
                            <a
                              href={`mailto:${contact.email}`}
                              className="text-violet-600 hover:text-violet-700 transition-colors duration-200 font-medium break-all"
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
          </div>
        )}
        {activeTab === 'faqs' && (
          <div className="space-y-4">
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
        {activeTab === 'agent' && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-900">{listingAgents.length === 1 ? 'Appointed Agent' : 'Appointed Agents'}</h3>
            
            {agencyLoading ? (
              <div className="p-6 space-y-4">
                <div className="h-8 bg-gray-200 rounded animate-pulse" />
                <div className="h-4 bg-gray-200 rounded animate-pulse" />
                <div className="h-4 bg-gray-200 rounded animate-pulse w-3/4" />
              </div>
            ) : listingAgents.length > 0 ? (
              <div className="space-y-4">
                {listingAgents.map((agent) => (
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
                            onClick={() => setSelectedAgencyId(agent.agency.id)}
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
            ) : (
              <div className="bg-gradient-to-br from-gray-50 to-white rounded-2xl border-2 border-dashed border-gray-200 p-8 text-center shadow-sm">
                <div className="relative inline-block mb-6">
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center shadow-sm ring-1 ring-gray-300/20">
                    <Building2 className="w-10 h-10 text-gray-400" />
                  </div>
                </div>
                
                <h4 className="text-xl font-bold text-gray-900 mb-3">No Agents Appointed</h4>
                <p className="text-gray-600 max-w-md mx-auto mb-6 leading-relaxed">
                  This property requirement is being handled directly by the company. 
                </p>
                
                <button
                  onClick={() => setActiveTab('contact')}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400 transition-colors font-medium"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z"/>
                    <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z"/>
                  </svg>
                  Contact Company Directly
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };


  // Mobile Layout
  if (isMobile) {
    return (
      <AnimatePresence>
        {isOpen && (
          <React.Fragment key={`listing-modal-mobile-${listingId}`}>
            {/* Mobile Backdrop */}
            <motion.div
              className={styles.backdrop}
              variants={backdropVariants}
              initial="hidden"
              animate="visible"
              exit="hidden"
              onClick={onClose}
            />

            {/* Mobile Container */}
            <div 
              className="fixed inset-0 z-[10003] flex flex-col bg-gradient-to-br from-violet-900 to-violet-700"
              style={{ 
                overscrollBehavior: 'none',
                touchAction: 'pan-y' 
              }}
              onTouchMove={(e) => {
                // Only prevent default for touches outside the bottom sheet
                const target = e.target as HTMLElement;
                if (!target.closest('[data-bottom-sheet]')) {
                  e.preventDefault();
                }
              }}
            >
              {/* Mobile Header */}
              <div className="fixed top-0 left-0 right-0 z-[10004] bg-white/95 backdrop-blur-md border-b border-gray-200">
                <div className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {listing?.company.logo_url ? (
                      <img
                        src={listing.company?.logo_url}
                        alt={`${listing.company?.name || 'Company'} logo`}
                        className="w-8 h-8 object-contain flex-shrink-0"
                        onError={(e) => {
                          // If clearbit logo fails and we should use fallback, show initials
                          if (listing?.company?.use_clearbit_fallback) {
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                            const fallback = target.nextElementSibling as HTMLElement;
                            if (fallback) fallback.style.display = 'flex';
                          }
                        }}
                      />
                    ) : null}
                    {(!listing?.company.logo_url || listing?.company?.use_clearbit_fallback) && (
                      <div className="w-8 h-8 bg-gradient-to-br from-violet-500 to-violet-600 rounded-lg flex items-center justify-center flex-shrink-0" style={{ display: listing?.company.logo_url ? 'none' : 'flex' }}>
                        <span className="text-white text-xs font-semibold">
                          {listing?.company.name?.charAt(0).toUpperCase() || 'C'}
                        </span>
                      </div>
                    )}
                    <h2 className="text-lg font-semibold text-gray-900 truncate">
                      {listing?.company.name || 'Loading...'}
                    </h2>
                  </div>
                  <button 
                    onClick={onClose} 
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
                    aria-label="Close"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Mobile Visual Hero */}
              <div className="absolute top-[64px] left-0 right-0 bottom-0 z-[10001]">
                <MobileVisualHero 
                  listing={listing} 
                  isLoading={isLoading}
                />
              </div>

              {/* Mobile Bottom Sheet */}
              <SimpleMobileBottomSheet
                onDismiss={handleClose}
                peekContent={null}
                fullContent={
                  listing && (
                    <>
                      {/* Mobile Tab Navigation */}
                      <MobileTabNavigation
                        tabs={tabs}
                        activeTab={activeTab}
                        onTabChange={handleTabChange}
                        companyName={listing.company?.name}
                      />

                      {/* Tab Content */}
                      <div className="flex-1">
                        {renderTabContent()}
                      </div>
                    </>
                  )
                }
              />
            </div>
          </React.Fragment>
        )}
      </AnimatePresence>
    );
  }

  // Desktop Layout (existing code)
  return (
    <AnimatePresence>
      {isOpen && (
        <React.Fragment key={`listing-modal-desktop-${listingId}`}>
          {/* Premium Backdrop */}
          <motion.div
            className={styles.backdrop}
            variants={backdropVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            onClick={onClose}
          />

          {/* Full-screen Modal */}
          <motion.div
            className={styles.modalContainer}
            variants={modalVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
          >
            {/* Header Bar */}
            <div className={styles.headerBar}>
              <button onClick={onClose} className={styles.closeButton}>
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Split Layout Container */}
            <div className={styles.splitLayout}>
              {/* Visual Hero Section - 40% width on desktop */}
              <div className={styles.visualHero}>
                <VisualHeroSection 
                  listing={listing}
                  isLoading={isLoading}
                />
              </div>

              {/* Information Panel - 60% width on desktop */}
              <div className={styles.informationPanel}>
                {isLoading ? (
                  <div className="p-6 space-y-4">
                    <div className="h-8 bg-gray-200 rounded animate-pulse" />
                    <div className="h-4 bg-gray-200 rounded animate-pulse" />
                    <div className="h-4 bg-gray-200 rounded animate-pulse w-3/4" />
                  </div>
                ) : error ? (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-gray-500">{error}</p>
                  </div>
                ) : listing ? (
                  <div className="h-full flex flex-col">
                    {/* Company Hero Card */}
                    <div className={styles.companyHero}>
                      <div className="flex items-center gap-4">
                        {listing.company?.logo_url ? (
                          <img
                            src={listing.company?.logo_url}
                            alt={`${listing.company?.name || 'Company'} logo`}
                            className="w-12 h-12 object-contain"
                            onError={(e) => {
                              // Hide broken image and show fallback
                              const target = e.target as HTMLImageElement;
                              target.style.display = 'none';
                              const fallback = target.nextElementSibling as HTMLElement;
                              if (fallback) fallback.style.display = 'flex';
                            }}
                          />
                        ) : null}
                        <div className="w-12 h-12 bg-gradient-to-br from-violet-500 to-violet-600 rounded-lg flex items-center justify-center" style={{ display: listing.company?.logo_url ? 'none' : 'flex' }}>
                          <span className="text-white font-semibold">
                            {listing.company?.name?.charAt(0).toUpperCase() || 'C'}
                          </span>
                        </div>
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

                    {/* Tab Navigation */}
                    <div className={styles.tabNavigation}>
                      {tabs.map((tab) => (
                        <button
                          key={tab.id}
                          onClick={() => setActiveTab(tab.id)}
                          className={cn(
                            styles.tabButton,
                            activeTab === tab.id && styles.tabButtonActive
                          )}
                        >
                          {tab.id === 'overview' ? `From ${listing?.company?.name || 'Company'}` :
                           tab.id === 'faqs' ? 'FAQs' :
                           tab.id === 'agent' ? 'Agents' :
                           tab.label.charAt(0).toUpperCase() + tab.label.slice(1)}
                        </button>
                      ))}
                    </div>

                    {/* Tab Content */}
                    <div className={styles.tabContent}>
                      {renderTabContent()}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </motion.div>
        </React.Fragment>
      )}
      
      {/* Agency Modal */}
      {selectedAgencyId && (
        <AgencyModal 
          key={`listing-agency-modal-${selectedAgencyId}`}
          agencyId={selectedAgencyId}
          isOpen={!!selectedAgencyId}
          onClose={() => setSelectedAgencyId(null)}
        />
      )}
    </AnimatePresence>
  );
}

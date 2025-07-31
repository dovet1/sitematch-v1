'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { EnhancedListingModalContent, ListingModalProps } from '@/types/search';
import { VisualHeroSection } from './components/VisualHeroSection';
import styles from './ImmersiveListingModal.module.css';

interface ImmersiveListingModalProps {
  listingId: string | null;
  isOpen: boolean;
  onClose: () => void;
  searchState?: any;
  scrollPosition?: number;
}

export function ImmersiveListingModal({
  listingId,
  isOpen,
  onClose,
  searchState,
  scrollPosition
}: ImmersiveListingModalProps) {
  const [listing, setListing] = useState<EnhancedListingModalContent | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('overview');
  
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
  }, [isOpen, listingId]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
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
                        {listing.company.logo_url ? (
                          <img
                            src={listing.company.logo_url}
                            alt={`${listing.company.name} logo`}
                            className="w-12 h-12 object-contain"
                          />
                        ) : (
                          <div className="w-12 h-12 bg-gradient-to-br from-violet-500 to-violet-600 rounded-lg flex items-center justify-center">
                            <span className="text-white font-semibold">
                              {listing.company.name?.charAt(0).toUpperCase() || 'C'}
                            </span>
                          </div>
                        )}
                        <div>
                          <h2 className="text-2xl font-bold text-gray-900">
                            {listing.company.name}
                          </h2>
                          <div className="flex items-center gap-4 mt-1 text-sm text-gray-600">
                            <span>{listing.listing_type === 'residential' ? 'Residential' : 'Commercial'}</span>
                            <span>📍 {listing.locations?.all && listing.locations.all.length > 0 ? `${listing.locations.all.length} Locations` : 'Nationwide'}</span>
                            {listing.company.site_size && (
                              <span>📐 {listing.company.site_size}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Tab Navigation */}
                    <div className={styles.tabNavigation}>
                      {['overview', 'requirements', 'locations', 'contact', 'faqs'].map((tab) => (
                        <button
                          key={tab}
                          onClick={() => setActiveTab(tab)}
                          className={cn(
                            styles.tabButton,
                            activeTab === tab && styles.tabButtonActive
                          )}
                        >
                          {tab === 'faqs' ? 'FAQs' : tab.charAt(0).toUpperCase() + tab.slice(1)}
                        </button>
                      ))}
                    </div>

                    {/* Tab Content */}
                    <div className={styles.tabContent}>
                      <div className="p-6">
                        {activeTab === 'overview' && (
                          <div className="space-y-4">
                            <h3 className="text-lg font-semibold">Overview</h3>
                            <p className="text-gray-600">
                              Company overview and key details will be displayed here.
                            </p>
                          </div>
                        )}
                        {activeTab === 'requirements' && (
                          <div className="space-y-4">
                            <h3 className="text-lg font-semibold">Requirements</h3>
                            <p className="text-gray-600">
                              Property requirements and specifications.
                            </p>
                          </div>
                        )}
                        {activeTab === 'locations' && (
                          <div className="space-y-4">
                            <h3 className="text-lg font-semibold">Locations</h3>
                            
                            {listing.locations?.all && listing.locations.all.length > 0 ? (
                              <div className="space-y-2">
                                {listing.locations.all.map((location, index) => (
                                  <div 
                                    key={index} 
                                    className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
                                  >
                                    <div className="w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center flex-shrink-0">
                                      <svg className="w-4 h-4 text-violet-600" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                                      </svg>
                                    </div>
                                    <span className="text-gray-700">
                                      {location.place_name || location.name || 'Unknown location'}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="p-4 rounded-lg bg-gradient-to-r from-violet-50 to-purple-50 border border-violet-100">
                                <p className="font-medium text-gray-800 flex items-center gap-2">
                                  <span className="text-xl">🌍</span> Nationwide Coverage
                                </p>
                                <p className="mt-2 text-gray-600 text-sm">
                                  This listing is open to opportunities across the UK & Ireland
                                </p>
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
                          </div>
                        )}
                        {activeTab === 'faqs' && (
                          <div className="space-y-4">
                            <h3 className="text-lg font-semibold">Frequently Asked Questions</h3>
                            
                            <div className="space-y-3">
                              {(listing.faqs || []).map((faq, index) => (
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
                                Contact {listing.company.name}'s team to find out more
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
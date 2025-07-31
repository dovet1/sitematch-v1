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
                            {listing.locations?.all && (
                              <span>📍 {listing.locations.all.length} Locations</span>
                            )}
                            {listing.company.site_size && (
                              <span>📐 {listing.company.site_size}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Tab Navigation */}
                    <div className={styles.tabNavigation}>
                      {['overview', 'requirements', 'locations', 'documents', 'contact'].map((tab) => (
                        <button
                          key={tab}
                          onClick={() => setActiveTab(tab)}
                          className={cn(
                            styles.tabButton,
                            activeTab === tab && styles.tabButtonActive
                          )}
                        >
                          {tab.charAt(0).toUpperCase() + tab.slice(1)}
                        </button>
                      ))}
                    </div>

                    {/* Tab Content */}
                    <div className={styles.tabContent}>
                      <motion.div
                        key={activeTab}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.2 }}
                        className="p-6"
                      >
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
                            <h3 className="text-lg font-semibold">
                              {listing.locations?.all?.length > 0 ? 'Locations' : 'Coverage'}
                            </h3>
                            <p className="text-gray-600">
                              Location preferences and coverage area.
                            </p>
                          </div>
                        )}
                        {activeTab === 'documents' && (
                          <div className="space-y-4">
                            <h3 className="text-lg font-semibold">Documents</h3>
                            <p className="text-gray-600">
                              Brochures, site plans, and other documents.
                            </p>
                          </div>
                        )}
                        {activeTab === 'contact' && (
                          <div className="space-y-4">
                            <h3 className="text-lg font-semibold">Contact</h3>
                            <p className="text-gray-600">
                              Contact information and details.
                            </p>
                          </div>
                        )}
                      </motion.div>
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
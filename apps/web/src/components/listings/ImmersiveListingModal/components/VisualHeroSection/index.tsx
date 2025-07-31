import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Image as ImageIcon, FileText, Globe } from 'lucide-react';
import { EnhancedListingModalContent } from '@/types/search';
import { useHeroContent } from '../../hooks/useHeroContent';
import { InteractiveMapView } from './InteractiveMapView';
import { NationwideHeroVisual } from './NationwideHeroVisual';
import { ImageGallery } from './ImageGallery';
import styles from './VisualHeroSection.module.css';

interface VisualHeroSectionProps {
  listing: EnhancedListingModalContent | null;
  isLoading: boolean;
}

export function VisualHeroSection({ listing, isLoading }: VisualHeroSectionProps) {
  const heroContent = useHeroContent(listing);
  const [activeContent, setActiveContent] = useState<string>('primary');
  const [isMapboxActive, setIsMapboxActive] = useState(false);

  // Check if current active content is map type for enhanced button styling
  const isMapActive = () => {
    const content = activeContent === 'primary' ? heroContent?.primary : 
                   heroContent?.alternatives.find(alt => alt.type === activeContent) || heroContent?.primary;
    return content?.type === 'map';
  };

  // Handle map state changes from InteractiveMapView
  const handleMapStateChange = (mapboxActive: boolean) => {
    setIsMapboxActive(mapboxActive);
  };

  if (isLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.loadingSkeleton}>
          <motion.div
            className="w-32 h-32 rounded-full bg-violet-300/30"
            animate={{
              scale: [1, 1.1, 1],
              opacity: [0.3, 0.6, 0.3]
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: 'easeInOut'
            }}
          />
          <p className="text-violet-200 mt-4">Loading visual content...</p>
        </div>
      </div>
    );
  }

  if (!heroContent || !listing) {
    return (
      <div className={styles.container}>
        <div className={styles.errorState}>
          <Globe className="w-16 h-16 text-violet-300" />
          <p className="text-violet-200 mt-4">Unable to load content</p>
        </div>
      </div>
    );
  }

  const renderContent = () => {
    const content = activeContent === 'primary' ? heroContent.primary : 
                   heroContent.alternatives.find(alt => alt.type === activeContent) || heroContent.primary;

    switch (content.type) {
      case 'map':
        return <InteractiveMapView key="map-view" locations={content.data} onMapStateChange={handleMapStateChange} />;
      case 'gallery':
        return <ImageGallery key="gallery-view" images={content.data} type="fit-outs" />;
      case 'plans':
        return <ImageGallery key="plans-view" images={content.data} type="site-plans" />;
      case 'nationwide':
      default:
        return <NationwideHeroVisual key="nationwide-view" company={content.data} />;
    }
  };

  const getIndicatorIcon = (type: string) => {
    switch (type) {
      case 'map':
        return <MapPin className="w-4 h-4" />;
      case 'gallery':
        return <ImageIcon className="w-4 h-4" />;
      case 'plans':
        return <FileText className="w-4 h-4" />;
      case 'nationwide':
      default:
        return <Globe className="w-4 h-4" />;
    }
  };

  const getIndicatorLabel = (type: string) => {
    switch (type) {
      case 'map':
        return 'Map';
      case 'gallery':
        return 'Fit-Outs';
      case 'plans':
        return 'Site-Plans';
      case 'nationwide':
      default:
        return 'Coverage';
    }
  };

  // Get enhanced styling for buttons when map is active
  const getEnhancedButtonStyles = (isActive: boolean) => {
    const mapActive = isMapActive();
    
    if (mapActive) {
      // Enhanced violet bloom styling when map is active
      return isActive ? styles.indicatorMapActive : styles.indicatorMapInactive;
    }
    
    // Default styling for non-map content
    return '';
  };

  return (
    <motion.div 
      className={styles.container}
      initial={{ opacity: 0, x: -50 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.2 }}
    >
      {/* Content Display */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeContent}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.3 }}
          className={styles.contentArea}
        >
          {renderContent()}
        </motion.div>
      </AnimatePresence>
      
      {/* Content Type Indicators */}
      {heroContent.hasMultiple && (
        <div className={styles.indicators}>
          <button
            onClick={() => setActiveContent('primary')}
            className={`${styles.indicator} ${activeContent === 'primary' ? styles.indicatorActive : ''} ${getEnhancedButtonStyles(activeContent === 'primary')}`}
            title={`${getIndicatorLabel(heroContent.primary.type)} - Primary`}
          >
            {getIndicatorIcon(heroContent.primary.type)}
            <span className={styles.indicatorLabel}>
              {getIndicatorLabel(heroContent.primary.type)}
            </span>
          </button>
          
          {heroContent.alternatives.map((alt, index) => (
            <button
              key={alt.type}
              onClick={() => setActiveContent(alt.type)}
              className={`${styles.indicator} ${activeContent === alt.type ? styles.indicatorActive : ''} ${getEnhancedButtonStyles(activeContent === alt.type)}`}
              title={getIndicatorLabel(alt.type)}
            >
              {getIndicatorIcon(alt.type)}
              <span className={styles.indicatorLabel}>
                {getIndicatorLabel(alt.type)}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Location Count Badge - Only show when map is active, with original badge styling */}
      {isMapActive() && (
        <motion.div 
          className={`absolute top-6 left-6 px-3 py-2 rounded-full text-sm font-medium z-20 transition-all duration-300 ${
            isMapboxActive 
              ? 'bg-violet-600/90 backdrop-blur-md text-white shadow-lg border border-violet-400/30' 
              : 'bg-white/20 backdrop-blur-md text-white'
          }`}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.1, type: 'spring', duration: 0.4 }}
        >
          {listing.locations?.all?.length || 0} {(listing.locations?.all?.length || 0) === 1 ? 'Location' : 'Locations'}
        </motion.div>
      )}
    </motion.div>
  );
}
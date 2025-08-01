'use client';

import React, { useRef, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import styles from './MobileTabNavigation.module.css';

interface Tab {
  id: string;
  label: string;
  icon?: React.ReactNode;
}

interface MobileTabNavigationProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  className?: string;
  companyName?: string;
}

export function MobileTabNavigation({ 
  tabs, 
  activeTab, 
  onTabChange, 
  className,
  companyName = 'Company'
}: MobileTabNavigationProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showLeftGradient, setShowLeftGradient] = useState(false);
  const [showRightGradient, setShowRightGradient] = useState(false);

  // Check scroll position for gradient indicators
  const checkScroll = () => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const { scrollLeft, scrollWidth, clientWidth } = container;
    setShowLeftGradient(scrollLeft > 0);
    setShowRightGradient(scrollLeft < scrollWidth - clientWidth - 1);
  };

  useEffect(() => {
    checkScroll();
    const container = scrollContainerRef.current;
    if (!container) return;

    container.addEventListener('scroll', checkScroll);
    window.addEventListener('resize', checkScroll);

    return () => {
      container.removeEventListener('scroll', checkScroll);
      window.removeEventListener('resize', checkScroll);
    };
  }, []);

  // Scroll active tab into view
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const activeButton = container.querySelector(`[data-tab-id="${activeTab}"]`) as HTMLElement;
    if (!activeButton) return;

    const containerRect = container.getBoundingClientRect();
    const buttonRect = activeButton.getBoundingClientRect();

    if (buttonRect.left < containerRect.left) {
      container.scrollLeft -= containerRect.left - buttonRect.left + 16;
    } else if (buttonRect.right > containerRect.right) {
      container.scrollLeft += buttonRect.right - containerRect.right + 16;
    }
  }, [activeTab]);

  // Format tab label
  const formatTabLabel = (tab: Tab) => {
    if (tab.id === 'overview') {
      return `From ${companyName}`;
    }
    if (tab.id === 'faqs') {
      return 'FAQs';
    }
    return tab.label.charAt(0).toUpperCase() + tab.label.slice(1);
  };

  return (
    <div className={cn(styles.container, className)}>
      {/* Left Gradient */}
      <div 
        className={cn(
          styles.gradientLeft,
          showLeftGradient && styles.gradientVisible
        )}
        aria-hidden="true"
      />

      {/* Scrollable Tab Container */}
      <div 
        ref={scrollContainerRef}
        className={styles.scrollContainer}
        role="tablist"
        aria-label="Content sections"
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            data-tab-id={tab.id}
            onClick={(e) => {
              e.stopPropagation();
              onTabChange(tab.id);
            }}
            className={cn(
              styles.tab,
              activeTab === tab.id && styles.tabActive
            )}
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-controls={`tabpanel-${tab.id}`}
            tabIndex={activeTab === tab.id ? 0 : -1}
          >
            {tab.icon && (
              <span className={styles.tabIcon}>{tab.icon}</span>
            )}
            <span className={styles.tabLabel}>
              {formatTabLabel(tab)}
            </span>
            {activeTab === tab.id && (
              <motion.div
                className={styles.activeIndicator}
                layoutId="active-tab-indicator"
                transition={{
                  type: "spring",
                  stiffness: 500,
                  damping: 30
                }}
              />
            )}
          </button>
        ))}
      </div>

      {/* Right Gradient */}
      <div 
        className={cn(
          styles.gradientRight,
          showRightGradient && styles.gradientVisible
        )}
        aria-hidden="true"
      />
    </div>
  );
}
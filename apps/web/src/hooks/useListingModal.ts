import { useState, useCallback, useRef } from 'react';
import { SearchFilters, ModalState } from '@/types/search';

export interface UseListingModalOptions {
  onOpen?: () => void;
  onClose?: () => void;
}

export function useListingModal(options: UseListingModalOptions = {}) {
  const [modalState, setModalState] = useState<ModalState>({
    isOpen: false,
    listingId: null,
    previousScrollPosition: 0,
    searchState: {
      location: '',
      coordinates: null,
      companyName: '',
      sector: [],
      useClass: [],
      sizeMin: null,
      sizeMax: null,
      acreageMin: null,
      acreageMax: null,
      dwellingMin: null,
      dwellingMax: null,
      isNationwide: false,
      listingType: []
    }
  });

  const searchStateRef = useRef<SearchFilters | null>(null);

  // Store current search state
  const updateSearchState = useCallback((searchState: SearchFilters) => {
    searchStateRef.current = searchState;
  }, []);

  // Open modal with state preservation
  const openModal = useCallback((listingId: string) => {
    const currentScrollPosition = window.scrollY;
    const currentSearchState = searchStateRef.current || modalState.searchState;

    setModalState({
      isOpen: true,
      listingId,
      previousScrollPosition: currentScrollPosition,
      searchState: currentSearchState
    });

    // Prevent body scroll
    document.body.style.overflow = 'hidden';
    
    options.onOpen?.();
  }, [modalState.searchState, options]);

  // Close modal and restore state
  const closeModal = useCallback(() => {
    // Restore body scroll immediately
    document.body.style.overflow = 'unset';

    // Restore scroll position after modal animation
    setTimeout(() => {
      window.scrollTo({
        top: modalState.previousScrollPosition,
        behavior: 'instant'
      });
    }, 50);

    setModalState(prev => ({
      ...prev,
      isOpen: false,
      listingId: null
    }));

    options.onClose?.();
  }, [modalState.previousScrollPosition, options]);

  // Check if modal is open for a specific listing
  const isModalOpen = useCallback((listingId?: string) => {
    if (!listingId) return modalState.isOpen;
    return modalState.isOpen && modalState.listingId === listingId;
  }, [modalState.isOpen, modalState.listingId]);

  return {
    modalState,
    openModal,
    closeModal,
    isModalOpen,
    updateSearchState,
    currentListingId: modalState.listingId,
    isOpen: modalState.isOpen
  };
}
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { useRouter } from 'next/navigation';
import { ListingDetailPage } from '../listing-detail-page';
import { useMobileBreakpoint } from '../ImmersiveListingModal/hooks/useMobileBreakpoint';

// Mock dependencies
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

jest.mock('../ImmersiveListingModal/hooks/useMobileBreakpoint', () => ({
  useMobileBreakpoint: jest.fn(),
}));

jest.mock('@/lib/supabase', () => ({
  createClientClient: () => ({
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: null,
            error: { message: 'Listing not found' }
          })
        })
      })
    })
  })
}));

jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

const mockRouter = {
  push: jest.fn(),
  back: jest.fn(),
  refresh: jest.fn(),
};

const mockUseMobileBreakpoint = useMobileBreakpoint as jest.MockedFunction<typeof useMobileBreakpoint>;
const mockUseRouter = useRouter as jest.MockedFunction<typeof useRouter>;

describe('ListingDetailPage Mobile Optimization', () => {
  beforeEach(() => {
    mockUseRouter.mockReturnValue(mockRouter);
    jest.clearAllMocks();
  });

  it('renders desktop layout when not mobile', async () => {
    mockUseMobileBreakpoint.mockReturnValue({
      isMobile: false,
      isTablet: false,
      isDesktop: true,
      currentBreakpoint: 'desktop',
      isMobileUI: false,
    });

    render(<ListingDetailPage listingId="test-id" userId="test-user" />);

    await waitFor(() => {
      // Desktop layout should have the fixed container structure
      expect(document.querySelector('.fixed.top-16.left-0.right-0.bottom-0.flex')).toBeInTheDocument();
    });
  });

  it('renders mobile layout when on mobile', async () => {
    mockUseMobileBreakpoint.mockReturnValue({
      isMobile: true,
      isTablet: false,
      isDesktop: false,
      currentBreakpoint: 'mobile',
      isMobileUI: true,
    });

    render(<ListingDetailPage listingId="test-id" userId="test-user" />);

    await waitFor(() => {
      // Mobile layout should have the min-h-screen container
      expect(document.querySelector('.min-h-screen.bg-background')).toBeInTheDocument();
    });
  });

  it('shows mobile visual hero on mobile', async () => {
    mockUseMobileBreakpoint.mockReturnValue({
      isMobile: true,
      isTablet: false,
      isDesktop: false,
      currentBreakpoint: 'mobile',
      isMobileUI: true,
    });

    render(<ListingDetailPage listingId="test-id" userId="test-user" />);

    await waitFor(() => {
      // Mobile visual hero should be present
      expect(document.querySelector('.h-\\[60vh\\].relative.overflow-hidden')).toBeInTheDocument();
    });
  });

  it('shows bottom sheet navigation on mobile', async () => {
    mockUseMobileBreakpoint.mockReturnValue({
      isMobile: true,
      isTablet: false,
      isDesktop: false,
      currentBreakpoint: 'mobile',
      isMobileUI: true,
    });

    render(<ListingDetailPage listingId="test-id" userId="test-user" />);

    await waitFor(() => {
      // Should show the dashboard back button
      expect(screen.getByText('← Dashboard')).toBeInTheDocument();
    });
  });

  it('has proper touch targets on mobile', async () => {
    mockUseMobileBreakpoint.mockReturnValue({
      isMobile: true,
      isTablet: false,
      isDesktop: false,
      currentBreakpoint: 'mobile',
      isMobileUI: true,
    });

    render(<ListingDetailPage listingId="test-id" userId="test-user" />);

    await waitFor(() => {
      // Check for buttons with proper minimum touch target sizes
      const buttons = document.querySelectorAll('button[class*="h-11"], button[class*="h-12"]');
      expect(buttons.length).toBeGreaterThan(0);
    });
  });

  it('maintains responsive breakpoint detection', () => {
    // Test that the hook is being called
    mockUseMobileBreakpoint.mockReturnValue({
      isMobile: false,
      isTablet: true,
      isDesktop: false,
      currentBreakpoint: 'tablet',
      isMobileUI: true,
    });

    render(<ListingDetailPage listingId="test-id" userId="test-user" />);

    expect(mockUseMobileBreakpoint).toHaveBeenCalled();
  });
});
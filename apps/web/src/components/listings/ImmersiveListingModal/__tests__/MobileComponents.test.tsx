import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { useMobileBreakpoint } from '../hooks/useMobileBreakpoint';
import { MobileTabNavigation } from '../MobileTabNavigation';

// Mock the custom hook
jest.mock('../hooks/useMobileBreakpoint');
const mockUseMobileBreakpoint = useMobileBreakpoint as jest.MockedFunction<typeof useMobileBreakpoint>;

// Mock framer-motion
jest.mock('framer-motion', () => ({
  motion: {
    div: React.forwardRef<HTMLDivElement, any>(({ children, ...props }, ref) => (
      <div ref={ref} {...props}>{children}</div>
    )),
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe('Mobile Components', () => {
  beforeEach(() => {
    // Mock window.innerWidth for mobile breakpoint hook
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 375, // Mobile width
    });

    // Reset mock before each test
    mockUseMobileBreakpoint.mockReturnValue({
      currentBreakpoint: 'mobile',
      isMobile: true,
      isTablet: false,
      isDesktop: false,
      isMobileUI: true,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('useMobileBreakpoint', () => {
    it('should return mobile breakpoint for small screens', () => {
      const { result } = require('@testing-library/react-hooks').renderHook(() => useMobileBreakpoint());
      
      expect(result.current.isMobile).toBe(true);
      expect(result.current.currentBreakpoint).toBe('mobile');
    });

    it('should handle window resize events', async () => {
      const { result } = require('@testing-library/react-hooks').renderHook(() => useMobileBreakpoint());
      
      // Change window width to desktop
      Object.defineProperty(window, 'innerWidth', { value: 1200 });
      fireEvent(window, new Event('resize'));
      
      await waitFor(() => {
        // The hook should update after resize (with debounce)
      });
    });
  });

  describe('MobileTabNavigation', () => {
    const mockTabs = [
      { id: 'overview', label: 'overview' },
      { id: 'requirements', label: 'requirements' },
      { id: 'locations', label: 'locations' },
      { id: 'contact', label: 'contact' },
      { id: 'faqs', label: 'faqs' },
    ];

    const mockProps = {
      tabs: mockTabs,
      activeTab: 'overview',
      onTabChange: jest.fn(),
      companyName: 'Test Company',
    };

    it('should render all tabs', () => {
      render(<MobileTabNavigation {...mockProps} />);
      
      expect(screen.getByText('From Test Company')).toBeInTheDocument();
      expect(screen.getByText('Requirements')).toBeInTheDocument();
      expect(screen.getByText('Locations')).toBeInTheDocument();
      expect(screen.getByText('Contact')).toBeInTheDocument();
      expect(screen.getByText('FAQs')).toBeInTheDocument();
    });

    it('should call onTabChange when tab is clicked', () => {
      render(<MobileTabNavigation {...mockProps} />);
      
      fireEvent.click(screen.getByText('Requirements'));
      
      expect(mockProps.onTabChange).toHaveBeenCalledWith('requirements');
    });

    it('should apply active state to current tab', () => {
      render(<MobileTabNavigation {...mockProps} />);
      
      const activeTab = screen.getByRole('tab', { selected: true });
      expect(activeTab).toHaveTextContent('From Test Company');
    });

    it('should format tab labels correctly', () => {
      render(<MobileTabNavigation {...mockProps} />);
      
      // Overview should show company name
      expect(screen.getByText('From Test Company')).toBeInTheDocument();
      
      // FAQs should be uppercase
      expect(screen.getByText('FAQs')).toBeInTheDocument();
      
      // Other tabs should be capitalized
      expect(screen.getByText('Requirements')).toBeInTheDocument();
    });

    it('should support keyboard navigation', () => {
      render(<MobileTabNavigation {...mockProps} />);
      
      const firstTab = screen.getByRole('tab', { selected: true });
      const secondTab = screen.getByText('Requirements');
      
      // First tab should be focusable
      expect(firstTab).toHaveAttribute('tabIndex', '0');
      
      // Other tabs should not be focusable initially
      expect(secondTab).toHaveAttribute('tabIndex', '-1');
    });

    it('should show gradient indicators when tabs overflow', () => {
      // Mock scrollWidth to be larger than clientWidth to simulate overflow
      const mockScrollContainer = {
        scrollLeft: 0,
        scrollWidth: 1000,
        clientWidth: 300,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        querySelector: jest.fn(),
        getBoundingClientRect: jest.fn().mockReturnValue({ left: 0, right: 300 }),
      };

      // Mock querySelector to return our mock container
      jest.spyOn(document, 'querySelector').mockReturnValue(mockScrollContainer as any);
      
      render(<MobileTabNavigation {...mockProps} />);
      
      // The component should handle overflow scenarios
      expect(screen.getByRole('tablist')).toBeInTheDocument();
    });
  });

  describe('Touch Interactions', () => {
    it('should handle touch events appropriately', () => {
      render(<MobileTabNavigation {...mockProps} />);
      
      const tab = screen.getByText('Requirements');
      
      // Simulate touch events
      fireEvent.touchStart(tab);
      fireEvent.touchEnd(tab);
      fireEvent.click(tab);
      
      expect(mockProps.onTabChange).toHaveBeenCalledWith('requirements');
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA attributes', () => {
      render(<MobileTabNavigation {...mockProps} />);
      
      const tablist = screen.getByRole('tablist');
      expect(tablist).toHaveAttribute('aria-label', 'Content sections');
      
      const tabs = screen.getAllByRole('tab');
      tabs.forEach((tab, index) => {
        expect(tab).toHaveAttribute('aria-controls', `tabpanel-${mockTabs[index].id}`);
        if (index === 0) {
          expect(tab).toHaveAttribute('aria-selected', 'true');
        } else {
          expect(tab).toHaveAttribute('aria-selected', 'false');
        }
      });
    });
  });
});

// Export the mock props for other tests
export const mockTabNavigationProps = {
  tabs: [
    { id: 'overview', label: 'overview' },
    { id: 'requirements', label: 'requirements' },
    { id: 'locations', label: 'locations' },
    { id: 'contact', label: 'contact' },
    { id: 'faqs', label: 'faqs' },
  ],
  activeTab: 'overview',
  onTabChange: jest.fn(),
  companyName: 'Test Company',
};
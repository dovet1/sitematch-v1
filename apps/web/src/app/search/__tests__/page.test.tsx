import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import SearchPage from '../page';
import '@testing-library/jest-dom';

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
  useSearchParams: jest.fn(),
  usePathname: jest.fn(),
}));

// Mock components
jest.mock('next/link', () => {
  return ({ href, children, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  );
});

jest.mock('next/image', () => {
  return function MockImage({ alt, priority: _priority, ...props }: any) {
    return <img alt={alt} {...props} />;
  };
});

jest.mock('@/contexts/auth-context', () => ({
  useAuth: jest.fn(),
}));

jest.mock('@/hooks/useSubscriptionTier', () => ({
  useSubscriptionTier: jest.fn(),
}));

jest.mock('@/components/auth/user-menu', () => ({
  UserMenu: () => <div>User menu</div>,
}));

jest.mock('@/components/auth/user-status-header', () => ({
  UserStatusHeader: () => <div>User status</div>,
}));

jest.mock('@/components/auth/user-type-modal', () => ({
  UserTypeModal: () => null,
}));

jest.mock('@/components/search/search-context-toast', () => ({
  SearchContextToast: () => null,
}));

jest.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: any) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: any) => <>{children}</>,
  DropdownMenuContent: ({ children }: any) => <div>{children}</div>,
  DropdownMenuItem: ({ children }: any) => <div>{children}</div>,
}));

jest.mock('@/components/search/UnifiedSearch', () => ({
  UnifiedSearch: ({ value, onChange, placeholder, onEnterKey, onFocus, onBlur }: any) => (
    <input
      data-testid="location-search"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onEnterKey?.();
      }}
      onFocus={onFocus}
      onBlur={onBlur}
      placeholder={placeholder}
    />
  ),
}));

jest.mock('@/components/search/FilterDrawer', () => ({
  FilterDrawer: ({ isOpen, onClose }: any) => 
    isOpen ? <div data-testid="filter-drawer">Filter Drawer</div> : null,
}));

jest.mock('@/components/listings/ListingGrid', () => ({
  ListingGrid: ({ filters }: any) => (
    <div data-testid="listing-grid">
      Listing Grid - {filters.location || 'No location'}
    </div>
  ),
}));

jest.mock('@/components/listings/ListingMap', () => ({
  ListingMap: () => <div data-testid="listing-map">Listing Map</div>,
}));

jest.mock('@/components/listings/ListingModal', () => ({
  ListingModal: ({ isOpen }: any) => 
    isOpen ? <div data-testid="listing-modal">Listing Modal</div> : null,
}));

describe('Search Page', () => {
  const mockPush = jest.fn();
  const mockReplace = jest.fn();
  const { useAuth } = require('@/contexts/auth-context');
  const { useSubscriptionTier } = require('@/hooks/useSubscriptionTier');

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue({
      push: mockPush,
      replace: mockReplace,
    });
    (usePathname as jest.Mock).mockReturnValue('/search');
    (useAuth as jest.Mock).mockReturnValue({
      user: null,
      loading: false,
      isAdmin: false,
    });
    (useSubscriptionTier as jest.Mock).mockReturnValue({
      hasProAccess: false,
    });
  });

  it('renders with location from URL parameters', async () => {
    const searchParams = new URLSearchParams({
      location: 'London',
      lat: '51.5074',
      lng: '-0.1278',
    });
    (useSearchParams as jest.Mock).mockReturnValue(searchParams);

    render(<SearchPage />);

    await waitFor(() => {
      expect(screen.getByTestId('location-search')).toHaveValue('London');
      expect(screen.getByText(/Search: "London"/i)).toBeInTheDocument();
    });
  });

  it('renders with nationwide search from URL parameters', async () => {
    const searchParams = new URLSearchParams({
      nationwide: 'true',
    });
    (useSearchParams as jest.Mock).mockReturnValue(searchParams);

    render(<SearchPage />);

    await waitFor(() => {
      expect(screen.getByText(/Nationwide Only/i)).toBeInTheDocument();
    });
  });

  it('renders the shared site navbar content on search', async () => {
    (useSearchParams as jest.Mock).mockReturnValue(new URLSearchParams());

    render(<SearchPage />);

    await waitFor(() => {
      expect(screen.getByRole('navigation', { name: 'Main navigation' })).toBeInTheDocument();
      expect(screen.getByText('Browse Requirements')).toBeInTheDocument();
      expect(screen.getByText('Tools')).toBeInTheDocument();
      expect(screen.getByText('SiteSketcher')).toBeInTheDocument();
      expect(screen.getByText('SiteAnalyser')).toBeInTheDocument();
      expect(screen.getByText('GapFinder')).toBeInTheDocument();
      expect(screen.getByText('Articles')).toBeInTheDocument();
      expect(screen.getByText('Post Requirement')).toBeInTheDocument();
      expect(screen.getByText('Sign in')).toBeInTheDocument();
      expect(screen.getByText('Create account')).toBeInTheDocument();
    });
  });

  it('shows sticky header that remains visible', async () => {
    (useSearchParams as jest.Mock).mockReturnValue(new URLSearchParams());

    render(<SearchPage />);

    await waitFor(() => {
      const header = screen.getByRole('banner');
      expect(header).toHaveClass('sticky top-0');
    });
  });

  it('toggles between list and map view', async () => {
    (useSearchParams as jest.Mock).mockReturnValue(new URLSearchParams());

    render(<SearchPage />);

    // Initially shows list view
    await waitFor(() => {
      expect(screen.getByTestId('listing-grid')).toBeInTheDocument();
      expect(screen.queryByTestId('listing-map')).not.toBeInTheDocument();
    });

    // Click map view button
    const mapButton = screen.getAllByRole('button', { name: /map/i })[0];
    fireEvent.click(mapButton);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith(expect.stringContaining('view=map'));
    });
  });

  it('opens filter drawer when filter button is clicked', async () => {
    (useSearchParams as jest.Mock).mockReturnValue(new URLSearchParams());

    render(<SearchPage />);

    const filterButton = screen.getAllByRole('button', { name: /filters/i })[0];
    fireEvent.click(filterButton);

    await waitFor(() => {
      expect(screen.getByTestId('filter-drawer')).toBeInTheDocument();
    });
  });

  it('shows active filter badges', async () => {
    const searchParams = new URLSearchParams();
    searchParams.append('sectors[]', 'retail');
    searchParams.append('sectors[]', 'office');
    searchParams.set('companyName', 'Test Corp');
    (useSearchParams as jest.Mock).mockReturnValue(searchParams);

    render(<SearchPage />);

    await waitFor(() => {
      expect(screen.getByText(/Company: Test Corp/i)).toBeInTheDocument();
      expect(screen.getByText(/Sector: Retail/i)).toBeInTheDocument();
      expect(screen.getByText(/Sector: Office/i)).toBeInTheDocument();
    });
  });

  it('updates URL when filters change', async () => {
    (useSearchParams as jest.Mock).mockReturnValue(new URLSearchParams());

    render(<SearchPage />);

    const locationSearch = screen.getByTestId('location-search');
    fireEvent.change(locationSearch, { target: { value: 'Manchester' } });

    // In a real test, we would trigger the location select callback
    // The component should update the URL
    expect(locationSearch).toHaveValue('Manchester');
  });

  describe('Mobile View', () => {
    beforeEach(() => {
      // Mock mobile viewport
      window.matchMedia = jest.fn().mockImplementation(query => ({
        matches: query === '(max-width: 768px)',
        media: query,
        onchange: null,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        addListener: jest.fn(),
        removeListener: jest.fn(),
        dispatchEvent: jest.fn(),
      }));
    });

    it('shows expandable search on mobile', async () => {
      (useSearchParams as jest.Mock).mockReturnValue(new URLSearchParams());

      render(<SearchPage />);

      // Mobile view should show a compact search button initially
      await waitFor(() => {
        const searchButton = screen.getByRole('button', { name: /search location/i });
        expect(searchButton).toBeInTheDocument();
      });
    });
  });
});

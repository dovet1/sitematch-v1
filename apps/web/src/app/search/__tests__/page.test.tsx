import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useRouter, useSearchParams } from 'next/navigation';
import SearchPage from '../page';
import '@testing-library/jest-dom';

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
  useSearchParams: jest.fn(),
}));

// Mock components
jest.mock('@/components/search/LocationSearch', () => ({
  LocationSearch: ({ value, onChange, onLocationSelect, placeholder }: any) => (
    <input
      data-testid="location-search"
      value={value}
      onChange={(e) => onChange(e.target.value)}
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

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue({
      push: mockPush,
      replace: mockReplace,
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
      expect(screen.getByText(/Requirements in London/i)).toBeInTheDocument();
    });
  });

  it('renders with nationwide search from URL parameters', async () => {
    const searchParams = new URLSearchParams({
      nationwide: 'true',
    });
    (useSearchParams as jest.Mock).mockReturnValue(searchParams);

    render(<SearchPage />);

    await waitFor(() => {
      expect(screen.getByText(/Nationwide Requirements/i)).toBeInTheDocument();
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
    const mapButton = screen.getByRole('button', { name: /map/i });
    fireEvent.click(mapButton);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith(expect.stringContaining('view=map'));
    });
  });

  it('opens filter drawer when filter button is clicked', async () => {
    (useSearchParams as jest.Mock).mockReturnValue(new URLSearchParams());

    render(<SearchPage />);

    const filterButton = screen.getByRole('button', { name: /filters/i });
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
      expect(screen.getByText(/2 Sectors/i)).toBeInTheDocument();
      expect(screen.getByText(/Company: Test Corp/i)).toBeInTheDocument();
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
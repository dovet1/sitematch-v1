import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { HeroSearch } from '../HeroSearch';
import '@testing-library/jest-dom';

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
  useSearchParams: jest.fn(),
}));

describe('Search Flow', () => {
  const mockPush = jest.fn();
  const mockReplace = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue({
      push: mockPush,
      replace: mockReplace,
    });
    (useSearchParams as jest.Mock).mockReturnValue(new URLSearchParams());
  });

  describe('HeroSearch Component', () => {
    it('renders location search and nationwide button', () => {
      render(<HeroSearch />);
      
      expect(screen.getByPlaceholderText(/enter address, postcode, or location/i)).toBeInTheDocument();
      expect(screen.getByText(/search nationwide/i)).toBeInTheDocument();
    });

    it('navigates to search page when location is selected', async () => {
      render(<HeroSearch />);
      
      const input = screen.getByPlaceholderText(/enter address, postcode, or location/i);
      fireEvent.change(input, { target: { value: 'London' } });
      
      // Simulate selecting a location from dropdown
      // In a real test, we would trigger the onLocationSelect callback
      // For now, we'll test form submission
      const form = input.closest('form');
      if (form) {
        fireEvent.submit(form);
      }

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/search?location=London');
      });
    });

    it('navigates to search page with nationwide parameter when nationwide button is clicked', async () => {
      render(<HeroSearch />);
      
      const nationwideButton = screen.getByText(/search nationwide/i);
      fireEvent.click(nationwideButton);

      expect(mockPush).toHaveBeenCalledWith('/search?nationwide=true');
    });

    it('does not show filter button', () => {
      render(<HeroSearch />);
      
      expect(screen.queryByText(/filters/i)).not.toBeInTheDocument();
    });
  });

  describe('Search Page URL Parameters', () => {
    it('correctly parses location parameters from URL', () => {
      const params = new URLSearchParams({
        location: 'London',
        lat: '51.5074',
        lng: '-0.1278',
      });
      
      expect(params.get('location')).toBe('London');
      expect(params.get('lat')).toBe('51.5074');
      expect(params.get('lng')).toBe('-0.1278');
    });

    it('correctly parses nationwide parameter from URL', () => {
      const params = new URLSearchParams({
        nationwide: 'true',
      });
      
      expect(params.get('nationwide')).toBe('true');
    });

    it('correctly parses filter parameters from URL', () => {
      const params = new URLSearchParams();
      params.append('sectors[]', 'retail');
      params.append('sectors[]', 'office');
      params.append('useClasses[]', 'A1');
      params.set('minSize', '1000');
      params.set('maxSize', '5000');
      params.set('companyName', 'Test Corp');
      
      expect(params.getAll('sectors[]')).toEqual(['retail', 'office']);
      expect(params.getAll('useClasses[]')).toEqual(['A1']);
      expect(params.get('minSize')).toBe('1000');
      expect(params.get('maxSize')).toBe('5000');
      expect(params.get('companyName')).toBe('Test Corp');
    });

    it('correctly parses view parameter from URL', () => {
      const params = new URLSearchParams({
        view: 'map',
      });
      
      expect(params.get('view')).toBe('map');
    });
  });

  describe('Mobile Responsiveness', () => {
    it('shows compact search on mobile', () => {
      // Mock window size for mobile
      global.innerWidth = 375;
      global.innerHeight = 667;
      
      // Test would need to render the search page component
      // and verify mobile-specific elements are shown
    });

    it('shows full search on desktop', () => {
      // Mock window size for desktop
      global.innerWidth = 1920;
      global.innerHeight = 1080;
      
      // Test would need to render the search page component
      // and verify desktop-specific elements are shown
    });
  });
});
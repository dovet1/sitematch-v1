import { render, screen, fireEvent } from '@testing-library/react';
import { MultiListingClusterPopup } from '../MultiListingClusterPopup';
import { SearchResult } from '@/types/search';

// Mock data for testing
const mockListings: SearchResult[] = [
  {
    id: '1',
    company_name: 'Acme Corp',
    title: 'Modern Office Space Required',
    description: 'Seeking flexible workspace in London',
    site_size_min: 5000,
    site_size_max: 10000,
    sectors: [{ id: '1', name: 'Technology' }],
    use_classes: [{ id: '1', name: 'Office', code: 'B1' }],
    sector: 'Technology',
    use_class: 'Office',
    contact_name: 'John Smith',
    contact_title: 'Property Manager',
    contact_email: 'john@acme.com',
    contact_phone: '020 1234 5678',
    is_nationwide: false,
    logo_url: null,
    clearbit_logo: false,
    company_domain: null,
    place_name: 'London, UK',
    coordinates: { lat: 51.5074, lng: -0.1278 },
    created_at: new Date().toISOString()
  },
  {
    id: '2',
    company_name: 'TechStart Ltd',
    title: 'Co-working Space Needed',
    description: 'Looking for shared workspace',
    site_size_min: 2000,
    site_size_max: 5000,
    sectors: [{ id: '1', name: 'Technology' }],
    use_classes: [{ id: '1', name: 'Office', code: 'B1' }],
    sector: 'Technology',
    use_class: 'Office',
    contact_name: 'Sarah Wilson',
    contact_title: 'CEO',
    contact_email: 'sarah@techstart.com',
    contact_phone: '0161 234 5678',
    is_nationwide: false,
    logo_url: null,
    clearbit_logo: false,
    company_domain: null,
    place_name: 'London, UK',
    coordinates: { lat: 51.5074, lng: -0.1278 },
    created_at: new Date().toISOString()
  }
];

const mockProps = {
  listings: mockListings,
  isOpen: true,
  onClose: jest.fn(),
  onListingClick: jest.fn(),
  position: { x: 100, y: 100 }
};

// Mock window dimensions
Object.defineProperty(window, 'innerWidth', {
  writable: true,
  configurable: true,
  value: 1024,
});

Object.defineProperty(window, 'innerHeight', {
  writable: true,
  configurable: true,
  value: 768,
});

describe('MultiListingClusterPopup', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders popup with multiple listings', () => {
    render(<MultiListingClusterPopup {...mockProps} />);
    
    expect(screen.getByText('2 Properties at this location')).toBeInTheDocument();
    expect(screen.getAllByText('Acme Corp')).toHaveLength(2); // Mobile and desktop versions
    expect(screen.getAllByText('TechStart Ltd')).toHaveLength(2); // Mobile and desktop versions
  });

  test('calls onListingClick when listing is clicked', () => {
    render(<MultiListingClusterPopup {...mockProps} />);
    
    const viewDetailsButtons = screen.getAllByText('View Details');
    fireEvent.click(viewDetailsButtons[0]);
    
    expect(mockProps.onListingClick).toHaveBeenCalledWith('1');
  });

  test('calls onClose when close button is clicked', () => {
    render(<MultiListingClusterPopup {...mockProps} />);
    
    const closeButtons = screen.getAllByRole('button');
    const closeButton = closeButtons.find(button => 
      button.innerHTML.includes('lucide-x')
    );
    if (closeButton) {
      fireEvent.click(closeButton);
    }
    
    expect(mockProps.onClose).toHaveBeenCalled();
  });

  test('calls onClose when escape key is pressed', () => {
    render(<MultiListingClusterPopup {...mockProps} />);
    
    fireEvent.keyDown(document, { key: 'Escape' });
    
    expect(mockProps.onClose).toHaveBeenCalled();
  });

  test('displays listing information correctly', () => {
    render(<MultiListingClusterPopup {...mockProps} />);
    
    expect(screen.getAllByText('Modern Office Space Required')).toHaveLength(2);
    expect(screen.getAllByText('5,000 - 10,000 sq ft')).toHaveLength(2);
    expect(screen.getAllByText('London, UK')).toHaveLength(2);
    expect(screen.getAllByText('Technology')).toHaveLength(2);
  });

  test('handles listings without size information', () => {
    const listingWithoutSize = {
      ...mockListings[0],
      site_size_min: null,
      site_size_max: null
    };
    
    render(
      <MultiListingClusterPopup 
        {...mockProps} 
        listings={[listingWithoutSize]} 
      />
    );
    
    expect(screen.getAllByText('Size flexible')).toHaveLength(2);
  });

  test('does not render when isOpen is false', () => {
    render(<MultiListingClusterPopup {...mockProps} isOpen={false} />);
    
    expect(screen.queryByText('2 Properties at this location')).not.toBeInTheDocument();
  });
});
import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { SimplifiedListingModal } from '../SimplifiedListingModal';

// Mock the API call
global.fetch = jest.fn();

const mockListing = {
  id: '1',
  title: 'Test Listing',
  description: 'Test description',
  listing_type: 'commercial' as const,
  created_at: '2023-01-01T00:00:00Z',
  company: {
    name: 'Test Company',
    logo_url: null,
    sectors: ['Technology', 'Finance'],
    use_classes: ['Office (B1)', 'Storage (B8)'],
    sector: 'Technology',
    use_class: 'Office (B1)',
    site_size: '1,000 - 5,000 sq ft',
    dwelling_count: 'N/A',
    site_acreage: 'N/A'
  },
  contacts: {
    primary: {
      name: 'John Doe',
      title: 'Manager',
      email: 'john@test.com',
      phone: '+44 20 1234 5678',
      contact_area: 'London & South East'
    },
    additional: []
  },
  locations: {
    all: [
      {
        id: '1',
        place_name: 'London, UK',
        coordinates: { lat: 51.5074, lng: -0.1278 }
      }
    ],
    is_nationwide: false
  },
  faqs: [
    {
      id: '1',
      question: 'What are your requirements?',
      answer: 'We need modern office space'
    }
  ],
  files: {
    brochures: [],
    fit_outs: [],
    site_plans: []
  }
};

describe('SimplifiedListingModal', () => {
  beforeEach(() => {
    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => mockListing
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders modal when open with commercial listing', async () => {
    render(
      <SimplifiedListingModal
        listingId="1"
        isOpen={true}
        onClose={() => {}}
        searchState={{
          location: '',
          coordinates: null,
          companyName: '',
          sector: [],
          useClass: [],
          sizeMin: null,
          sizeMax: null,
          isNationwide: false
        }}
      />
    );

    // Check that loading state is shown initially
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    render(
      <SimplifiedListingModal
        listingId="1"
        isOpen={false}
        onClose={() => {}}
      />
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('handles residential listing type correctly', async () => {
    const residentialListing = {
      ...mockListing,
      listing_type: 'residential' as const,
      company: {
        ...mockListing.company,
        sectors: [],
        use_classes: [],
        dwelling_count: '5 - 10 dwellings',
        site_acreage: '2 - 5 acres'
      }
    };

    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => residentialListing
    });

    render(
      <SimplifiedListingModal
        listingId="1"
        isOpen={true}
        onClose={() => {}}
      />
    );

    // Should show residential in the subtitle
    await expect(screen.findByText('Residential Property Requirement')).resolves.toBeInTheDocument();
  });
});
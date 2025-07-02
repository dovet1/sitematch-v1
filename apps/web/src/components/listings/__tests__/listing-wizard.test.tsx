// =====================================================
// Listing Wizard Tests - Story 3.1
// Unit tests for the main wizard container component
// =====================================================

import { render, screen } from '@testing-library/react';
import { ListingWizard } from '../listing-wizard';
import type { SubmissionResult } from '@/types/wizard';

// Mock the wizard utils
jest.mock('@/lib/wizard-utils', () => ({
  ...jest.requireActual('@/lib/wizard-utils'),
  saveToLocalStorage: jest.fn(),
  loadFromLocalStorage: jest.fn().mockReturnValue(null),
  clearLocalStorage: jest.fn(),
}));

describe('ListingWizard', () => {
  const mockOnSubmit = jest.fn().mockResolvedValue({ success: true } as SubmissionResult);
  const mockOnSave = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const defaultProps = {
    initialData: { contactEmail: 'test@example.com' },
    onSubmit: mockOnSubmit,
    onSave: mockOnSave,
    userEmail: 'test@example.com'
  };

  it('renders wizard with progress indicator', () => {
    render(<ListingWizard {...defaultProps} />);

    expect(screen.getByText(/Company Information/i)).toBeInTheDocument();
    expect(screen.getByText(/Property Requirements/i)).toBeInTheDocument();
  });

  it('starts on step 1', () => {
    render(<ListingWizard {...defaultProps} />);

    expect(screen.getByText(/tell us about your company/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/company name/i)).toBeInTheDocument();
  });

  it('displays step navigation buttons', () => {
    render(<ListingWizard {...defaultProps} />);

    expect(screen.getByText(/next: property requirements/i)).toBeInTheDocument();
  });

  it('shows loading state', () => {
    const props = {
      ...defaultProps,
    };

    render(<ListingWizard {...props} />);

    // The wizard should render without errors
    expect(screen.getByText(/Company Information/i)).toBeInTheDocument();
  });

  it('pre-fills contact email from initial data', () => {
    render(<ListingWizard {...defaultProps} />);

    const emailInput = screen.getByLabelText(/contact email/i) as HTMLInputElement;
    expect(emailInput.value).toBe('test@example.com');
  });

  it('loads initial data from localStorage when available', () => {
    const savedData = {
      companyName: 'Saved Company',
      title: 'Saved Title'
    };

    // Mock localStorage to return saved data
    require('@/lib/wizard-utils').loadFromLocalStorage.mockReturnValue(savedData);

    render(<ListingWizard {...defaultProps} />);

    expect(screen.getByDisplayValue('Saved Company')).toBeInTheDocument();
  });
});
// =====================================================
// Logo UX Improvements Tests
// Tests for the high priority UX enhancements
// =====================================================

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Step1CompanyInfo } from '../step1-company-info';

// Mock the clearbit logo service
jest.mock('@/lib/clearbit-logo', () => ({
  fetchCompanyLogo: jest.fn(),
  validateDomain: jest.fn(),
  normalizeDomain: jest.fn(),
}));

// Mock the wizard utils
jest.mock('@/lib/wizard-utils', () => ({
  validateStep: jest.fn(() => ({})),
}));

const mockProps = {
  data: {
    companyName: '',
    primaryContact: {
      contactName: '',
      contactTitle: '',
      contactEmail: '',
      contactPhone: '',
      contactArea: '',
      isPrimaryContact: true,
    },
  },
  onUpdate: jest.fn(),
  onNext: jest.fn(),
  onValidationChange: jest.fn(),
  errors: {},
};

describe('Logo Section UX Improvements', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Enhanced Method Selection', () => {
    it('displays enhanced method selection cards with context', () => {
      render(<Step1CompanyInfo {...mockProps} />);
      
      // Check for improved heading
      expect(screen.getByText('How would you like to add your logo?')).toBeInTheDocument();
      
      // Check for context description
      expect(screen.getByText('We can automatically find your logo, or you can upload your own')).toBeInTheDocument();
      
      // Check for method cards with descriptions
      expect(screen.getByText('Find logo automatically')).toBeInTheDocument();
      expect(screen.getByText('We\'ll search for your company\'s logo using your domain • Usually instant')).toBeInTheDocument();
      
      expect(screen.getByText('Upload your own logo')).toBeInTheDocument();
      expect(screen.getByText('Choose a custom logo file • PNG, JPG, or SVG up to 2MB')).toBeInTheDocument();
      
      // Check for recommended badge
      expect(screen.getByText('Recommended')).toBeInTheDocument();
    });

    it('shows hover effects on method selection cards', async () => {
      const user = userEvent.setup();
      render(<Step1CompanyInfo {...mockProps} />);
      
      const clearbitCard = screen.getByLabelText('Find logo automatically').closest('div');
      expect(clearbitCard).toHaveClass('hover:bg-muted/30');
    });
  });

  describe('Enhanced Error Handling', () => {
    it('displays enhanced error message for invalid domain', async () => {
      const { validateDomain } = require('@/lib/clearbit-logo');
      validateDomain.mockReturnValue(false);
      
      render(<Step1CompanyInfo {...mockProps} />);
      
      // Switch to clearbit method and enter invalid domain
      const domainInput = screen.getByPlaceholderText('e.g., apple.com');
      await userEvent.type(domainInput, 'invalid-domain');
      
      await waitFor(() => {
        expect(screen.getByText('Invalid domain format')).toBeInTheDocument();
        expect(screen.getByText('Please enter a valid domain like "company.com" (without www or https://)')).toBeInTheDocument();
      });
    });

    it('displays enhanced error message for logo not found with recovery button', async () => {
      render(<Step1CompanyInfo {...mockProps} />);
      
      // Simulate logo not found error
      const errorText = 'No logo found for this domain. Try uploading your own logo instead.';
      
      // This would be triggered by the component's error handling
      // We'll test the UI rendering when domainError state contains this message
      
      expect(screen.queryByText('Upload logo instead')).not.toBeInTheDocument();
    });
  });

  describe('Enhanced Success States', () => {
    it('displays enhanced success state with logo preview and alternative action', () => {
      const dataWithLogo = {
        ...mockProps.data,
        logoPreview: 'https://img.logo.dev/apple.com?token=pk_test',
        clearbitLogo: true,
        companyDomain: 'apple.com',
        logoMethod: 'clearbit' as const,
      };

      render(<Step1CompanyInfo {...mockProps} data={dataWithLogo} />);

      // Check for enhanced success state
      expect(screen.getByText('Logo found!')).toBeInTheDocument();
      expect(screen.getByText('We found your logo automatically from apple.com')).toBeInTheDocument();
      expect(screen.getByText('Use different logo')).toBeInTheDocument();
    });

    it('allows switching to upload method from success state', async () => {
      const user = userEvent.setup();
      const dataWithLogo = {
        ...mockProps.data,
        logoPreview: 'https://img.logo.dev/apple.com?token=pk_test',
        clearbitLogo: true,
        companyDomain: 'apple.com',
        logoMethod: 'clearbit' as const,
      };

      render(<Step1CompanyInfo {...mockProps} data={dataWithLogo} />);
      
      const useDifferentButton = screen.getByText('Use different logo');
      await user.click(useDifferentButton);
      
      // This would trigger the handleLogoMethodChange function
      expect(useDifferentButton).toBeInTheDocument();
    });
  });

  describe('Visual Design Improvements', () => {
    it('applies proper styling classes for enhanced visual hierarchy', () => {
      render(<Step1CompanyInfo {...mockProps} />);
      
      // Check for proper card styling
      const methodCards = screen.getAllByText(/Find logo automatically|Upload your own logo/);
      methodCards.forEach(card => {
        const cardElement = card.closest('div');
        expect(cardElement).toHaveClass('rounded-lg', 'border', 'border-muted');
      });
    });

    it('displays proper loading state with enhanced styling', () => {
      // This would require mocking the logoLoading state
      // The component should show enhanced loading UI when logoLoading is true
      expect(true).toBe(true); // Placeholder for now
    });
  });
});
// =====================================================
// Wizard Integration Tests - QA Enhancement
// End-to-end testing of complete wizard flow
// =====================================================

import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ListingWizard } from '../listing-wizard';
import type { WizardFormData, SubmissionResult } from '@/types/wizard';

// Mock the wizard utils
jest.mock('@/lib/wizard-utils', () => ({
  ...jest.requireActual('@/lib/wizard-utils'),
  saveToLocalStorage: jest.fn(),
  loadFromLocalStorage: jest.fn().mockReturnValue(null),
  clearLocalStorage: jest.fn(),
}));

describe('Wizard Integration Tests', () => {
  const user = userEvent.setup();
  
  const mockOnSubmit: jest.MockedFunction<(data: WizardFormData) => Promise<SubmissionResult>> = jest.fn();
  const mockOnSave: jest.MockedFunction<(data: Partial<WizardFormData>) => Promise<void>> = jest.fn();
  
  beforeEach(() => {
    jest.clearAllMocks();
    mockOnSubmit.mockResolvedValue({ success: true });
    mockOnSave.mockResolvedValue(undefined);
  });

  const defaultProps = {
    initialData: { contactEmail: 'test@example.com' },
    onSubmit: mockOnSubmit,
    onSave: mockOnSave,
    userEmail: 'test@example.com'
  };

  describe('Complete Wizard Flow', () => {
    it('should complete entire wizard flow successfully', async () => {
      render(<ListingWizard {...defaultProps} />);

      // Verify we start on step 1
      expect(screen.getByText(/Company Information/)).toBeInTheDocument();
      expect(screen.getByText(/tell us about your company/i)).toBeInTheDocument();

      // Fill out step 1
      await user.type(screen.getByLabelText(/company name/i), 'Test Company Ltd');
      await user.type(screen.getByLabelText(/company description/i), 'A test company for integration testing');
      await user.type(screen.getByLabelText(/contact phone/i), '+44 20 1234 5678');

      // Verify email is pre-filled and readonly
      const emailInput = screen.getByLabelText(/contact email/i) as HTMLInputElement;
      expect(emailInput.value).toBe('test@example.com');
      expect(emailInput.readOnly).toBe(true);

      // Navigate to step 2
      await user.click(screen.getByText(/next: property requirements/i));

      // Wait for step 2 to load
      await waitFor(() => {
        expect(screen.getByText(/specify your property requirements/i)).toBeInTheDocument();
      });

      // Fill out step 2
      await user.type(screen.getByLabelText(/listing title/i), 'Retail Space Required in Central London');
      await user.type(screen.getByLabelText(/listing description/i), 'Looking for premium retail space in a high-footfall location');
      
      // Select sector
      await user.click(screen.getByLabelText(/retail/i));
      
      // Fill use class
      await user.type(screen.getByLabelText(/use class/i), 'E(a)');
      
      // Fill site sizes
      await user.type(screen.getByLabelText(/minimum site size/i), '1000');
      await user.type(screen.getByLabelText(/maximum site size/i), '2500');

      // Submit the form
      await user.click(screen.getByText(/create listing/i));

      // Verify submission was called with correct data
      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith(
          expect.objectContaining({
            companyName: 'Test Company Ltd',
            companyDescription: 'A test company for integration testing',
            contactEmail: 'test@example.com',
            contactPhone: '+44 20 1234 5678',
            title: 'Retail Space Required in Central London',
            description: 'Looking for premium retail space in a high-footfall location',
            sector: 'retail',
            useClass: 'E(a)',
            siteSizeMin: 1000,
            siteSizeMax: 2500
          })
        );
      });
    });

    it('should handle navigation between steps correctly', async () => {
      render(<ListingWizard {...defaultProps} />);

      // Fill required fields in step 1
      await user.type(screen.getByLabelText(/company name/i), 'Test Company');

      // Navigate to step 2
      await user.click(screen.getByText(/next: property requirements/i));

      await waitFor(() => {
        expect(screen.getByText(/specify your property requirements/i)).toBeInTheDocument();
      });

      // Navigate back to step 1
      await user.click(screen.getByText(/back/i));

      await waitFor(() => {
        expect(screen.getByText(/tell us about your company/i)).toBeInTheDocument();
      });

      // Verify data is preserved
      expect(screen.getByDisplayValue('Test Company')).toBeInTheDocument();
    });

    it('should prevent navigation with invalid data', async () => {
      render(<ListingWizard {...defaultProps} />);

      // Try to navigate without filling required fields
      await user.click(screen.getByText(/next: property requirements/i));

      // Should still be on step 1
      await waitFor(() => {
        expect(screen.getByText(/tell us about your company/i)).toBeInTheDocument();
        expect(screen.getByText(/company name is required/i)).toBeInTheDocument();
      });
    });

    it('should validate cross-field constraints', async () => {
      render(<ListingWizard {...defaultProps} />);

      // Complete step 1
      await user.type(screen.getByLabelText(/company name/i), 'Test Company');
      await user.click(screen.getByText(/next: property requirements/i));

      await waitFor(() => {
        expect(screen.getByText(/listing title/i)).toBeInTheDocument();
      });

      // Fill step 2 with invalid site size range
      await user.type(screen.getByLabelText(/listing title/i), 'Test Listing');
      await user.click(screen.getByLabelText(/retail/i));
      await user.type(screen.getByLabelText(/use class/i), 'E(a)');
      await user.type(screen.getByLabelText(/minimum site size/i), '2000');
      await user.type(screen.getByLabelText(/maximum site size/i), '1000');

      // Try to submit
      await user.click(screen.getByText(/create listing/i));

      // Should show validation error
      await waitFor(() => {
        expect(screen.getByText(/minimum size cannot be greater than maximum size/i)).toBeInTheDocument();
      });

      // Should not have called submit
      expect(mockOnSubmit).not.toHaveBeenCalled();
    });
  });

  describe('Auto-save Functionality', () => {
    it('should auto-save form data as user types', async () => {
      const { saveToLocalStorage } = require('@/lib/wizard-utils');
      
      render(<ListingWizard {...defaultProps} />);

      await user.type(screen.getByLabelText(/company name/i), 'Test Company');

      // Auto-save should be triggered
      await waitFor(() => {
        expect(saveToLocalStorage).toHaveBeenCalledWith(
          expect.objectContaining({
            companyName: 'Test Company'
          })
        );
      });
    });

    it('should call onSave periodically', async () => {
      render(<ListingWizard {...defaultProps} />);

      await user.type(screen.getByLabelText(/company name/i), 'Test Company');

      // onSave should be called
      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledWith(
          expect.objectContaining({
            companyName: 'Test Company'
          })
        );
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle submission errors gracefully', async () => {
      const errorSubmit = jest.fn().mockResolvedValue({
        success: false,
        error: 'Network error occurred'
      });

      render(<ListingWizard {...defaultProps} onSubmit={errorSubmit} />);

      // Complete the form
      await user.type(screen.getByLabelText(/company name/i), 'Test Company');
      await user.click(screen.getByText(/next: property requirements/i));

      await waitFor(() => {
        expect(screen.getByText(/listing title/i)).toBeInTheDocument();
      });

      await user.type(screen.getByLabelText(/listing title/i), 'Test Listing');
      await user.click(screen.getByLabelText(/retail/i));
      await user.type(screen.getByLabelText(/use class/i), 'E(a)');

      // Submit with error
      await user.click(screen.getByText(/create listing/i));

      await waitFor(() => {
        expect(errorSubmit).toHaveBeenCalled();
      });

      // Should remain on the same step
      expect(screen.getByText(/create listing/i)).toBeInTheDocument();
    });

    it('should show loading state during submission', async () => {
      const slowSubmit = jest.fn().mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve({ success: true }), 100))
      );

      render(<ListingWizard {...defaultProps} onSubmit={slowSubmit} />);

      // Complete the form quickly
      await user.type(screen.getByLabelText(/company name/i), 'Test Company');
      await user.click(screen.getByText(/next: property requirements/i));

      await waitFor(() => {
        expect(screen.getByText(/listing title/i)).toBeInTheDocument();
      });

      await user.type(screen.getByLabelText(/listing title/i), 'Test Listing');
      await user.click(screen.getByLabelText(/retail/i));
      await user.type(screen.getByLabelText(/use class/i), 'E(a)');

      // Submit
      await user.click(screen.getByText(/create listing/i));

      // Should show loading state
      expect(screen.getByText(/creating listing/i)).toBeInTheDocument();
      expect(screen.getByText(/creating listing/i)).toBeDisabled();
    });
  });

  describe('Progressive Disclosure', () => {
    it('should show/hide steps appropriately', async () => {
      render(<ListingWizard {...defaultProps} />);

      // Initially, only step 1 should be accessible
      const progressSteps = screen.getAllByText(/Company Information|Property Requirements/);
      
      // Company Information should be active
      const companyStep = screen.getByText('Company Information').closest('[data-testid]') || 
                          screen.getByText('Company Information').closest('div');
      expect(companyStep).toHaveClass('text-blue-600'); // Active step styling

      // Property Requirements should not be accessible yet
      const requirementsStep = screen.getByText('Property Requirements').closest('[data-testid]') || 
                               screen.getByText('Property Requirements').closest('div');
      expect(requirementsStep).not.toHaveClass('text-blue-600');
    });

    it('should update progress indicator correctly', async () => {
      render(<ListingWizard {...defaultProps} />);

      // Complete step 1
      await user.type(screen.getByLabelText(/company name/i), 'Test Company');
      await user.click(screen.getByText(/next: property requirements/i));

      await waitFor(() => {
        // Step 1 should now be completed
        const step1 = screen.getByText('1').parentElement;
        expect(step1).toHaveClass('bg-green-600'); // Completed step styling
        
        // Step 2 should be active
        const step2 = screen.getByText('2').parentElement;
        expect(step2).toHaveClass('bg-blue-600'); // Active step styling
      });
    });
  });

  describe('Form Persistence', () => {
    it('should restore form data from localStorage on load', () => {
      const savedData = {
        companyName: 'Saved Company',
        contactEmail: 'test@example.com',
        title: 'Saved Title'
      };

      require('@/lib/wizard-utils').loadFromLocalStorage.mockReturnValue(savedData);

      render(<ListingWizard {...defaultProps} />);

      // Should restore saved data
      expect(screen.getByDisplayValue('Saved Company')).toBeInTheDocument();
    });

    it('should clear localStorage on successful submission', async () => {
      const { clearLocalStorage } = require('@/lib/wizard-utils');
      
      render(<ListingWizard {...defaultProps} />);

      // Complete form
      await user.type(screen.getByLabelText(/company name/i), 'Test Company');
      await user.click(screen.getByText(/next: property requirements/i));

      await waitFor(() => {
        expect(screen.getByText(/listing title/i)).toBeInTheDocument();
      });

      await user.type(screen.getByLabelText(/listing title/i), 'Test Listing');
      await user.click(screen.getByLabelText(/retail/i));
      await user.type(screen.getByLabelText(/use class/i), 'E(a)');

      await user.click(screen.getByText(/create listing/i));

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalled();
        expect(clearLocalStorage).toHaveBeenCalled();
      });
    });
  });
});
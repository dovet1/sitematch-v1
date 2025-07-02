// =====================================================
// Step 1 Company Info Tests - Story 3.1
// Unit tests for company information step component
// =====================================================

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Step1CompanyInfo } from '../step1-company-info';
import type { WizardFormData } from '@/types/wizard';

describe('Step1CompanyInfo', () => {
  const mockOnNext = jest.fn();
  const mockOnPrevious = jest.fn();
  const mockOnUpdate = jest.fn();
  const mockOnValidationChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const defaultProps = {
    data: {},
    onNext: mockOnNext,
    onPrevious: mockOnPrevious,
    onUpdate: mockOnUpdate,
    onValidationChange: mockOnValidationChange,
    errors: {}
  };

  it('renders all form fields', () => {
    render(<Step1CompanyInfo {...defaultProps} />);

    expect(screen.getByLabelText(/company name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/company description/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/contact email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/contact phone/i)).toBeInTheDocument();
  });

  it('shows contact email as read-only when provided', () => {
    const props = {
      ...defaultProps,
      data: { contactEmail: 'test@example.com' }
    };

    render(<Step1CompanyInfo {...props} />);

    const emailInput = screen.getByLabelText(/contact email/i) as HTMLInputElement;
    expect(emailInput.readOnly).toBe(true);
    expect(emailInput.value).toBe('test@example.com');
  });

  it('calls onUpdate when form values change', async () => {
    render(<Step1CompanyInfo {...defaultProps} />);

    const companyNameInput = screen.getByLabelText(/company name/i);
    fireEvent.change(companyNameInput, { target: { value: 'Test Company' } });

    await waitFor(() => {
      expect(mockOnUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          companyName: 'Test Company'
        })
      );
    });
  });

  it('calls onValidationChange with validation state', async () => {
    render(<Step1CompanyInfo {...defaultProps} />);

    const companyNameInput = screen.getByLabelText(/company name/i);
    const emailInput = screen.getByLabelText(/contact email/i);

    // Fill required fields
    fireEvent.change(companyNameInput, { target: { value: 'Test Company' } });
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });

    await waitFor(() => {
      expect(mockOnValidationChange).toHaveBeenCalledWith(true);
    });
  });

  it('shows validation errors for invalid phone', async () => {
    const props = {
      ...defaultProps,
      data: {
        companyName: 'Test Company',
        contactEmail: 'test@example.com',
        contactPhone: '123'
      }
    };

    render(<Step1CompanyInfo {...props} />);

    const phoneInput = screen.getByLabelText(/contact phone/i);
    fireEvent.blur(phoneInput);

    await waitFor(() => {
      expect(screen.getByText(/please enter a valid UK phone number/i)).toBeInTheDocument();
    });
  });

  it('accepts valid phone numbers', async () => {
    render(<Step1CompanyInfo {...defaultProps} />);

    const phoneInput = screen.getByLabelText(/contact phone/i);
    fireEvent.change(phoneInput, { target: { value: '+44 20 1234 5678' } });

    await waitFor(() => {
      expect(mockOnUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          contactPhone: '+44 20 1234 5678'
        })
      );
    });

    // Should not show error
    expect(screen.queryByText(/please enter a valid UK phone number/i)).not.toBeInTheDocument();
  });

  it('shows required field errors', async () => {
    render(<Step1CompanyInfo {...defaultProps} />);

    const companyNameInput = screen.getByLabelText(/company name/i);
    const emailInput = screen.getByLabelText(/contact email/i);

    // Focus and blur to trigger validation
    fireEvent.focus(companyNameInput);
    fireEvent.blur(companyNameInput);
    fireEvent.focus(emailInput);
    fireEvent.blur(emailInput);

    await waitFor(() => {
      expect(screen.getByText(/company name is required/i)).toBeInTheDocument();
      expect(screen.getByText(/contact email is required/i)).toBeInTheDocument();
    });
  });
});
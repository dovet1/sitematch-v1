// =====================================================
// Step 2 Requirement Details Tests - Story 3.1
// Unit tests for requirement details step component
// =====================================================

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Step2RequirementDetails } from '../step2-requirement-details';

describe('Step2RequirementDetails', () => {
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
    render(<Step2RequirementDetails {...defaultProps} />);

    expect(screen.getByLabelText(/listing title/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/listing description/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/use class/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/minimum site size/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/maximum site size/i)).toBeInTheDocument();
  });

  it('renders sector radio buttons', () => {
    render(<Step2RequirementDetails {...defaultProps} />);

    expect(screen.getByText(/retail/i)).toBeInTheDocument();
    expect(screen.getByText(/office/i)).toBeInTheDocument();
    expect(screen.getByText(/industrial/i)).toBeInTheDocument();
    expect(screen.getByText(/leisure/i)).toBeInTheDocument();
    expect(screen.getByText(/mixed use/i)).toBeInTheDocument();
  });

  it('calls onUpdate when form values change', async () => {
    render(<Step2RequirementDetails {...defaultProps} />);

    const titleInput = screen.getByLabelText(/listing title/i);
    fireEvent.change(titleInput, { target: { value: 'Test Listing' } });

    await waitFor(() => {
      expect(mockOnUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Test Listing'
        })
      );
    });
  });

  it('calls onValidationChange with validation state', async () => {
    render(<Step2RequirementDetails {...defaultProps} />);

    const titleInput = screen.getByLabelText(/listing title/i);
    const useClassInput = screen.getByLabelText(/use class/i);

    // Fill required fields
    fireEvent.change(titleInput, { target: { value: 'Test Listing' } });
    fireEvent.change(useClassInput, { target: { value: 'E(a)' } });

    await waitFor(() => {
      expect(mockOnValidationChange).toHaveBeenCalled();
    });
  });

  it('handles site size inputs correctly', async () => {
    render(<Step2RequirementDetails {...defaultProps} />);

    const minSizeInput = screen.getByLabelText(/minimum site size/i);
    const maxSizeInput = screen.getByLabelText(/maximum site size/i);

    fireEvent.change(minSizeInput, { target: { value: '1000' } });
    fireEvent.change(maxSizeInput, { target: { value: '2000' } });

    await waitFor(() => {
      expect(mockOnUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          siteSizeMin: 1000,
          siteSizeMax: 2000
        })
      );
    });
  });

  it('shows character count for description', () => {
    render(<Step2RequirementDetails {...defaultProps} />);

    const descriptionTextarea = screen.getByLabelText(/listing description/i);
    fireEvent.change(descriptionTextarea, { target: { value: 'Test description' } });

    expect(screen.getByText(/16 \/ 1000/)).toBeInTheDocument();
  });

  it('populates form with provided data', () => {
    const props = {
      ...defaultProps,
      data: {
        title: 'Existing Title',
        description: 'Existing description',
        sector: 'retail' as const,
        useClass: 'E(a)',
        siteSizeMin: 1000,
        siteSizeMax: 2000
      }
    };

    render(<Step2RequirementDetails {...props} />);

    expect(screen.getByDisplayValue('Existing Title')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Existing description')).toBeInTheDocument();
    expect(screen.getByDisplayValue('E(a)')).toBeInTheDocument();
    expect(screen.getByDisplayValue('1000')).toBeInTheDocument();
    expect(screen.getByDisplayValue('2000')).toBeInTheDocument();
  });

  it('displays site size preview', () => {
    const props = {
      ...defaultProps,
      data: {
        siteSizeMin: 1000,
        siteSizeMax: 2000
      }
    };

    render(<Step2RequirementDetails {...props} />);

    expect(screen.getByText(/1,000 - 2,000 sq ft/)).toBeInTheDocument();
  });
});
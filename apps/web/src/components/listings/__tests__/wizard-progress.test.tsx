// =====================================================
// Wizard Progress Tests - Story 3.1
// Unit tests for the wizard progress component
// =====================================================

import { render, screen } from '@testing-library/react';
import { WizardProgress, createProgressSteps } from '../wizard-progress';
import type { ProgressStep } from '@/types/wizard';

describe('WizardProgress', () => {
  const mockSteps: ProgressStep[] = [
    {
      number: 1,
      title: 'Company Information',
      description: 'Tell us about your company',
      isActive: true,
      isCompleted: false,
      isAccessible: true
    },
    {
      number: 2,
      title: 'Property Requirements',
      description: 'Specify your requirements',
      isActive: false,
      isCompleted: false,
      isAccessible: false
    }
  ];

  it('renders all steps', () => {
    render(<WizardProgress steps={mockSteps} currentStep={1} />);
    
    expect(screen.getByText('Company Information')).toBeInTheDocument();
    expect(screen.getByText('Property Requirements')).toBeInTheDocument();
  });

  it('displays current step description', () => {
    render(<WizardProgress steps={mockSteps} currentStep={1} />);
    
    expect(screen.getByText('Tell us about your company')).toBeInTheDocument();
  });

  it('shows step numbers correctly', () => {
    render(<WizardProgress steps={mockSteps} currentStep={1} />);
    
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('applies correct active step styling', () => {
    render(<WizardProgress steps={mockSteps} currentStep={1} />);
    
    const activeStep = screen.getByText('1').parentElement;
    expect(activeStep).toHaveClass('bg-blue-600');
  });

  it('shows completed step with check icon', () => {
    const completedSteps: ProgressStep[] = [
      {
        ...mockSteps[0],
        isActive: false,
        isCompleted: true
      },
      {
        ...mockSteps[1],
        isActive: true,
        isAccessible: true
      }
    ];

    render(<WizardProgress steps={completedSteps} currentStep={2} />);
    
    // Check icon should be present for completed step
    const checkIcon = document.querySelector('svg');
    expect(checkIcon).toBeInTheDocument();
  });
});

describe('createProgressSteps', () => {
  it('creates correct step configuration for step 1', () => {
    const stepValidation = { 1: false, 2: false };
    const steps = createProgressSteps(1, stepValidation);
    
    expect(steps).toHaveLength(2);
    expect(steps[0].isActive).toBe(true);
    expect(steps[0].isAccessible).toBe(true);
    expect(steps[1].isActive).toBe(false);
    expect(steps[1].isAccessible).toBe(false); // Step 1 not valid
  });

  it('creates correct step configuration for step 2', () => {
    const stepValidation = { 1: true, 2: false };
    const steps = createProgressSteps(2, stepValidation);
    
    expect(steps[0].isActive).toBe(false);
    expect(steps[0].isCompleted).toBe(true);
    expect(steps[1].isActive).toBe(true);
    expect(steps[1].isAccessible).toBe(true);
  });

  it('marks step as accessible when previous step is valid', () => {
    const stepValidation = { 1: true, 2: false };
    const steps = createProgressSteps(1, stepValidation);
    
    expect(steps[1].isAccessible).toBe(true);
  });
});
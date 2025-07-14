// =====================================================
// Step 5: FAQs - Story 3.3
// FAQ management for the listing
// =====================================================

'use client';

import { useEffect, useCallback, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { HelpCircle } from 'lucide-react';

import { FAQManager, type FAQ } from '@/components/listings/faq-manager';

import type { WizardStepProps, FAQData } from '@/types/wizard';
import { validateStep } from '@/lib/wizard-utils';

interface Step5FormData extends FAQData {}

export function Step5FAQs({
  data,
  onUpdate,
  onNext,
  onPrevious,
  onValidationChange,
  errors
}: WizardStepProps) {
  const {
    handleSubmit,
    formState: { errors: formErrors }
  } = useForm<Step5FormData>({
    defaultValues: {
      faqs: data.faqs || []
    },
    mode: 'onChange'
  });

  // =====================================================
  // STATE MANAGEMENT
  // =====================================================

  const [faqs, setFaqs] = useState<FAQ[]>(data.faqs || []);

  // =====================================================
  // EFFECTS
  // =====================================================

  const prevValuesRef = useRef<string>('');
  const prevValidRef = useRef<boolean>(false);

  // Update parent when FAQs change
  useEffect(() => {
    const formData = { faqs };
    const currentJson = JSON.stringify(formData);
    
    if (prevValuesRef.current !== currentJson) {
      prevValuesRef.current = currentJson;
      onUpdate(formData);
    }
  }, [faqs, onUpdate]);

  // Validation
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      const stepErrors = validateStep(5, { faqs });
      const isValid = Object.keys(stepErrors).length === 0;
      
      if (prevValidRef.current !== isValid) {
        prevValidRef.current = isValid;
        onValidationChange(isValid);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [faqs, onValidationChange]);

  // =====================================================
  // HANDLERS
  // =====================================================

  const handleFAQsChange = useCallback((newFaqs: FAQ[]) => {
    setFaqs(newFaqs);
  }, []);

  const onSubmit = (formData: Step5FormData) => {
    onNext();
  };

  // =====================================================
  // RENDER
  // =====================================================

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Header Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <HelpCircle className="w-5 h-5" />
            Frequently Asked Questions (Optional)
          </CardTitle>
          <p className="text-sm text-gray-600">
            Add common questions and answers about your property requirements to help potential partners understand your needs better.
          </p>
        </CardHeader>
        <CardContent>
          <FAQManager
            faqs={faqs}
            onChange={handleFAQsChange}
          />
        </CardContent>
      </Card>

      {/* Hidden submit button for form validation */}
      <Button type="submit" className="hidden">
        Next
      </Button>
    </form>
  );
}
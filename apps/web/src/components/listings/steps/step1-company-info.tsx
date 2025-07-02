// =====================================================
// Step 1: Company Information - Story 3.1
// Company details and contact information form
// =====================================================

'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';

import type { WizardStepProps, CompanyInfoData } from '@/types/wizard';
import { validateStep } from '@/lib/wizard-utils';

interface Step1FormData extends CompanyInfoData {}

export function Step1CompanyInfo({
  data,
  onUpdate,
  onNext,
  onValidationChange,
  errors
}: WizardStepProps) {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors: formErrors }
  } = useForm<Step1FormData>({
    defaultValues: {
      companyName: data.companyName || '',
      companyDescription: data.companyDescription || '',
      contactEmail: data.contactEmail || '',
      contactPhone: data.contactPhone || ''
    },
    mode: 'onChange'
  });

  const watchedValues = watch();

  // =====================================================
  // EFFECTS
  // =====================================================

  // Update parent component when form data changes
  useEffect(() => {
    onUpdate(watchedValues);
  }, [watchedValues, onUpdate]);

  // Update validation state
  useEffect(() => {
    const stepErrors = validateStep(1, watchedValues);
    const isValid = Object.keys(stepErrors).length === 0;
    onValidationChange(isValid);
  }, [watchedValues, onValidationChange]);

  // Set initial values when data prop changes
  useEffect(() => {
    if (data.companyName !== undefined) setValue('companyName', data.companyName);
    if (data.companyDescription !== undefined) setValue('companyDescription', data.companyDescription);
    if (data.contactEmail !== undefined) setValue('contactEmail', data.contactEmail);
    if (data.contactPhone !== undefined) setValue('contactPhone', data.contactPhone);
  }, [data, setValue]);

  // =====================================================
  // FORM SUBMISSION
  // =====================================================

  const onSubmit = (formData: Step1FormData) => {
    onNext();
  };

  // =====================================================
  // RENDER
  // =====================================================

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Company Details Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Company Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Company Name */}
          <div className="space-y-2">
            <Label htmlFor="companyName" className="text-sm font-medium">
              Company Name *
            </Label>
            <Input
              id="companyName"
              {...register('companyName', {
                required: 'Company name is required',
                minLength: {
                  value: 2,
                  message: 'Company name must be at least 2 characters'
                },
                maxLength: {
                  value: 100,
                  message: 'Company name must be no more than 100 characters'
                }
              })}
              placeholder="Enter your company name"
              className={
                formErrors.companyName || errors?.companyName
                  ? 'border-red-500 focus:ring-red-500'
                  : ''
              }
            />
            {(formErrors.companyName || errors?.companyName) && (
              <p className="text-sm text-red-600">
                {formErrors.companyName?.message || errors?.companyName}
              </p>
            )}
          </div>

          {/* Company Description */}
          <div className="space-y-2">
            <Label htmlFor="companyDescription" className="text-sm font-medium">
              Company Description
              <span className="text-gray-500 font-normal ml-1">(Optional)</span>
            </Label>
            <textarea
              id="companyDescription"
              {...register('companyDescription', {
                maxLength: {
                  value: 500,
                  message: 'Description must be no more than 500 characters'
                }
              })}
              placeholder="Brief description of your company and what you do"
              rows={3}
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            />
            {(formErrors.companyDescription || errors?.companyDescription) && (
              <p className="text-sm text-red-600">
                {formErrors.companyDescription?.message || errors?.companyDescription}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Contact Information Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Contact Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Contact Email */}
          <div className="space-y-2">
            <Label htmlFor="contactEmail" className="text-sm font-medium">
              Contact Email *
            </Label>
            <Input
              id="contactEmail"
              type="email"
              {...register('contactEmail', {
                required: 'Contact email is required',
                pattern: {
                  value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                  message: 'Please enter a valid email address'
                }
              })}
              placeholder="your.email@company.com"
              className={
                formErrors.contactEmail || errors?.contactEmail
                  ? 'border-red-500 focus:ring-red-500'
                  : ''
              }
              readOnly={!!data.contactEmail}
            />
            {data.contactEmail && (
              <p className="text-xs text-gray-500">
                This email is pre-filled from your account settings
              </p>
            )}
            {(formErrors.contactEmail || errors?.contactEmail) && (
              <p className="text-sm text-red-600">
                {formErrors.contactEmail?.message || errors?.contactEmail}
              </p>
            )}
          </div>

          {/* Contact Phone */}
          <div className="space-y-2">
            <Label htmlFor="contactPhone" className="text-sm font-medium">
              Contact Phone
              <span className="text-gray-500 font-normal ml-1">(Optional)</span>
            </Label>
            <Input
              id="contactPhone"
              type="tel"
              {...register('contactPhone', {
                pattern: {
                  value: /^(\+44|0)[1-9]\d{8,9}$/,
                  message: 'Please enter a valid UK phone number'
                }
              })}
              placeholder="+44 20 1234 5678 or 020 1234 5678"
              className={
                formErrors.contactPhone || errors?.contactPhone
                  ? 'border-red-500 focus:ring-red-500'
                  : ''
              }
            />
            {(formErrors.contactPhone || errors?.contactPhone) && (
              <p className="text-sm text-red-600">
                {formErrors.contactPhone?.message || errors?.contactPhone}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Hidden submit button for form validation */}
      <Button type="submit" className="hidden">
        Next
      </Button>
    </form>
  );
}
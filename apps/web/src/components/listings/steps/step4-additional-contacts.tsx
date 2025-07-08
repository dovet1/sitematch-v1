// =====================================================
// Step 4: Additional Contacts - Story 3.1
// Optional additional contacts for the listing
// =====================================================

'use client';

import { useEffect, useCallback, useRef, useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { ImageUpload } from '@/components/ui/image-upload';
import { Plus, Trash2, User } from 'lucide-react';

import type { WizardStepProps, AdditionalContactsData } from '@/types/wizard';
import { validateStep } from '@/lib/wizard-utils';
import { cn } from '@/lib/utils';

interface Step4FormData extends AdditionalContactsData {}

interface ContactForm {
  contactName: string;
  contactTitle: string;
  contactEmail: string;
  contactPhone?: string;
  headshotFile?: File;
  headshotPreview?: string;
  headshotUrl?: string;
}

export function Step4AdditionalContacts({
  data,
  onUpdate,
  onNext,
  onPrevious,
  onValidationChange,
  errors
}: WizardStepProps) {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    control,
    formState: { errors: formErrors }
  } = useForm<Step4FormData>({
    defaultValues: {
      additionalContacts: data.additionalContacts || []
    },
    mode: 'onChange'
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'additionalContacts'
  });

  const watchedValues = watch();

  // =====================================================
  // EFFECTS
  // =====================================================

  const prevValuesRef = useRef<string>('');
  const prevValidRef = useRef<boolean>(false);

  // Debounced update to parent
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      const currentJson = JSON.stringify(watchedValues, (key, value) => {
        if (value instanceof File) {
          return { name: value.name, size: value.size, type: value.type };
        }
        return value;
      });
      
      if (prevValuesRef.current !== currentJson) {
        prevValuesRef.current = currentJson;
        onUpdate(watchedValues);
      }
    }, 150);

    return () => clearTimeout(timeoutId);
  }, [watchedValues, onUpdate]);

  // Debounced validation
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      const stepErrors = validateStep(4, watchedValues);
      const isValid = Object.keys(stepErrors).length === 0;
      
      if (prevValidRef.current !== isValid) {
        prevValidRef.current = isValid;
        onValidationChange(isValid);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [watchedValues, onValidationChange]);

  // =====================================================
  // HANDLERS
  // =====================================================

  const addContact = () => {
    append({
      id: Date.now().toString(),
      contactName: '',
      contactTitle: '',
      contactEmail: '',
      contactPhone: '',
      isPrimaryContact: false,
      headshotFile: undefined,
      headshotPreview: '',
      headshotUrl: ''
    });
  };

  const removeContact = (index: number) => {
    remove(index);
  };

  const onSubmit = (formData: Step4FormData) => {
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
            <User className="w-5 h-5" />
            Additional Contacts
          </CardTitle>
          <p className="text-sm text-gray-600">
            Add additional contacts who may be involved in property discussions. This step is optional.
          </p>
        </CardHeader>
        <CardContent>
          {fields.length === 0 ? (
            <div className="text-center py-8">
              <User className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 mb-4">No additional contacts added yet</p>
              <Button type="button" onClick={addContact} variant="outline">
                <Plus className="w-4 h-4 mr-2" />
                Add Contact
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <Button type="button" onClick={addContact} variant="outline" className="w-full">
                <Plus className="w-4 h-4 mr-2" />
                Add Another Contact
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Contact Cards */}
      {fields.map((field, index) => (
        <Card key={field.id}>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle className="text-lg">Contact {index + 1}</CardTitle>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => removeContact(index)}
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Contact Name */}
            <div className="space-y-2">
              <Label htmlFor={`contact-${index}-name`} className="text-sm font-medium">
                Contact Name *
              </Label>
              <Input
                id={`contact-${index}-name`}
                {...register(`additionalContacts.${index}.contactName`, {
                  required: 'Contact name is required',
                  minLength: {
                    value: 2,
                    message: 'Contact name must be at least 2 characters'
                  }
                })}
                placeholder="Enter contact name"
                className={
                  formErrors.additionalContacts?.[index]?.contactName
                    ? 'border-red-500 focus:ring-red-500'
                    : ''
                }
              />
              {formErrors.additionalContacts?.[index]?.contactName && (
                <p className="text-sm text-red-600">
                  {formErrors.additionalContacts[index]?.contactName?.message}
                </p>
              )}
            </div>

            {/* Contact Title */}
            <div className="space-y-2">
              <Label htmlFor={`contact-${index}-title`} className="text-sm font-medium">
                Contact Title *
              </Label>
              <Input
                id={`contact-${index}-title`}
                {...register(`additionalContacts.${index}.contactTitle`, {
                  required: 'Contact title is required',
                  minLength: {
                    value: 2,
                    message: 'Contact title must be at least 2 characters'
                  }
                })}
                placeholder="e.g., Property Manager, Facilities Director"
                className={
                  formErrors.additionalContacts?.[index]?.contactTitle
                    ? 'border-red-500 focus:ring-red-500'
                    : ''
                }
              />
              {formErrors.additionalContacts?.[index]?.contactTitle && (
                <p className="text-sm text-red-600">
                  {formErrors.additionalContacts[index]?.contactTitle?.message}
                </p>
              )}
            </div>

            {/* Contact Email */}
            <div className="space-y-2">
              <Label htmlFor={`contact-${index}-email`} className="text-sm font-medium">
                Contact Email *
              </Label>
              <Input
                id={`contact-${index}-email`}
                type="email"
                {...register(`additionalContacts.${index}.contactEmail`, {
                  required: 'Contact email is required',
                  pattern: {
                    value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                    message: 'Please enter a valid email address'
                  }
                })}
                placeholder="contact@company.com"
                className={
                  formErrors.additionalContacts?.[index]?.contactEmail
                    ? 'border-red-500 focus:ring-red-500'
                    : ''
                }
              />
              {formErrors.additionalContacts?.[index]?.contactEmail && (
                <p className="text-sm text-red-600">
                  {formErrors.additionalContacts[index]?.contactEmail?.message}
                </p>
              )}
            </div>

            {/* Contact Phone */}
            <div className="space-y-2">
              <Label htmlFor={`contact-${index}-phone`} className="text-sm font-medium">
                Contact Phone
                <span className="text-gray-500 font-normal ml-1">(Optional)</span>
              </Label>
              <Input
                id={`contact-${index}-phone`}
                type="tel"
                {...register(`additionalContacts.${index}.contactPhone`, {
                  pattern: {
                    value: /^(\+44|0)[1-9]\d{8,9}$/,
                    message: 'Please enter a valid UK phone number'
                  }
                })}
                placeholder="E.g. 07123 456789"
                className={
                  formErrors.additionalContacts?.[index]?.contactPhone
                    ? 'border-red-500 focus:ring-red-500'
                    : ''
                }
              />
              {formErrors.additionalContacts?.[index]?.contactPhone && (
                <p className="text-sm text-red-600">
                  {formErrors.additionalContacts[index]?.contactPhone?.message}
                </p>
              )}
            </div>

            {/* Contact Headshot */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                Contact Headshot
                <span className="text-gray-500 font-normal ml-1">(Optional)</span>
              </Label>
              <ImageUpload
                value={watchedValues.additionalContacts?.[index]?.headshotFile || watchedValues.additionalContacts?.[index]?.headshotPreview}
                onChange={async (file) => {
                  setValue(`additionalContacts.${index}.headshotFile`, file || undefined);
                  if (!file) {
                    setValue(`additionalContacts.${index}.headshotPreview`, '');
                    setValue(`additionalContacts.${index}.headshotUrl`, '');
                  } else {
                    // Upload the file to get a URL
                    try {
                      const formData = new FormData();
                      formData.append('file', file);
                      formData.append('type', 'headshot');
                      formData.append('is_primary', 'false'); // Mark as additional contact headshot
                      
                      const response = await fetch('/api/upload', {
                        method: 'POST',
                        body: formData,
                      });
                      
                      if (response.ok) {
                        const result = await response.json();
                        setValue(`additionalContacts.${index}.headshotUrl`, result.url);
                      } else {
                        console.error('Failed to upload headshot:', await response.text());
                      }
                    } catch (error) {
                      console.error('Error uploading headshot:', error);
                    }
                  }
                }}
                onPreviewChange={(preview: string | null) => {
                  setValue(`additionalContacts.${index}.headshotPreview`, preview || '');
                }}
                placeholder="Upload contact headshot"
                maxSize={2 * 1024 * 1024} // 2MB
                acceptedTypes={["image/png", "image/jpeg", "image/jpg"]}
              />
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Hidden submit button for form validation */}
      <Button type="submit" className="hidden">
        Next
      </Button>
    </form>
  );
}
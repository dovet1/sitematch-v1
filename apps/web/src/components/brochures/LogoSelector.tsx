'use client';

import { useState, useEffect, useCallback } from 'react';
import { Globe, Upload, X, Check, Loader2, AlertCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { fetchCompanyLogo, validateDomain, normalizeDomain } from '@/lib/clearbit-logo';
import type { LogoSource } from '@/types/brochure';

interface LogoSelectorProps {
  label: string;
  logoSource: LogoSource;
  logoUrl: string;
  companyDomain: string;
  onLogoSourceChange: (source: LogoSource) => void;
  onLogoUrlChange: (url: string) => void;
  onCompanyDomainChange: (domain: string) => void;
}

export function LogoSelector({
  label,
  logoSource,
  logoUrl,
  companyDomain,
  onLogoSourceChange,
  onLogoUrlChange,
  onCompanyDomainChange,
}: LogoSelectorProps) {
  const [isLoadingLogo, setIsLoadingLogo] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(logoUrl || null);

  // Debounced logo fetching from logo.dev
  const fetchLogoForDomain = useCallback(async (domain: string) => {
    if (!domain.trim()) return;

    // Only validate and fetch if it looks like a complete domain
    if (!validateDomain(domain)) {
      return;
    }

    setIsLoadingLogo(true);
    setLogoError(null);

    try {
      const fetchedLogoUrl = await fetchCompanyLogo(domain);
      if (fetchedLogoUrl) {
        setPreviewUrl(fetchedLogoUrl);
        onLogoUrlChange(fetchedLogoUrl);
        setLogoError(null);
      } else {
        setPreviewUrl(null);
        onLogoUrlChange('');
        setLogoError('No logo found for this domain');
      }
    } catch (error) {
      setPreviewUrl(null);
      onLogoUrlChange('');
      if (error instanceof Error) {
        setLogoError(error.message);
      } else {
        setLogoError('Failed to fetch logo');
      }
    } finally {
      setIsLoadingLogo(false);
    }
  }, [onLogoUrlChange]);

  // Debounced effect to fetch logo after user stops typing
  useEffect(() => {
    if (logoSource !== 'logo_dev' || !companyDomain) {
      return;
    }

    const timeoutId = setTimeout(() => {
      fetchLogoForDomain(companyDomain);
    }, 1000); // Wait 1 second after user stops typing

    return () => clearTimeout(timeoutId);
  }, [companyDomain, logoSource, fetchLogoForDomain]);

  // Clear state when switching methods
  const handleSourceChange = (source: LogoSource) => {
    onLogoSourceChange(source);
    setLogoError(null);

    if (source === 'logo_dev') {
      // Switching to logo.dev - clear uploaded data
      setPreviewUrl(null);
      onLogoUrlChange('');
    } else if (source === 'upload') {
      // Switching to upload - clear logo.dev data
      onCompanyDomainChange('');
      setPreviewUrl(null);
      onLogoUrlChange('');
    } else {
      // No logo
      onCompanyDomainChange('');
      setPreviewUrl(null);
      onLogoUrlChange('');
    }
  };

  const handleDomainInput = (domain: string) => {
    onCompanyDomainChange(domain);
    if (logoError) {
      setLogoError(null);
    }

    // Clear logo data if domain is empty
    if (!domain.trim()) {
      setPreviewUrl(null);
      onLogoUrlChange('');
      setIsLoadingLogo(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        setLogoError('Please select an image file');
        return;
      }

      // Validate file size (max 2MB)
      if (file.size > 2 * 1024 * 1024) {
        setLogoError('Image must be less than 2MB');
        return;
      }

      setLogoError(null);

      // Create preview
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        setPreviewUrl(dataUrl);
        onLogoUrlChange(dataUrl);
      };
      reader.readAsDataURL(file);
    }
  };

  const options = [
    { value: 'logo_dev' as LogoSource, label: 'Find logo from website', icon: Globe },
    { value: 'upload' as LogoSource, label: 'Upload logo', icon: Upload },
    { value: 'none' as LogoSource, label: 'No logo', icon: X },
  ];

  return (
    <div className="space-y-4">
      <Label className="text-sm font-medium text-gray-700">{label}</Label>

      <div className="space-y-2">
        {options.map((option) => {
          const Icon = option.icon;
          const isSelected = logoSource === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => handleSourceChange(option.value)}
              className={cn(
                'relative flex w-full cursor-pointer rounded-lg border px-4 py-3 focus:outline-none transition-all text-left',
                isSelected
                  ? 'border-violet-500 bg-violet-50 ring-1 ring-violet-500'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              )}
            >
              <div className="flex w-full items-center justify-between">
                <div className="flex items-center gap-3">
                  <Icon className={cn('h-4 w-4', isSelected ? 'text-violet-600' : 'text-gray-400')} />
                  <span className={cn('text-sm', isSelected ? 'text-violet-900 font-medium' : 'text-gray-700')}>
                    {option.label}
                  </span>
                </div>
                {isSelected && <Check className="h-4 w-4 text-violet-600" />}
              </div>
            </button>
          );
        })}
      </div>

      {/* Domain input for logo.dev */}
      {logoSource === 'logo_dev' && (
        <div className="space-y-2">
          <Input
            type="text"
            placeholder="e.g., company.com"
            value={companyDomain}
            onChange={(e) => handleDomainInput(e.target.value)}
            className="w-full"
          />
          {isLoadingLogo && (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Finding logo...</span>
            </div>
          )}
        </div>
      )}

      {/* File upload for upload option */}
      {logoSource === 'upload' && (
        <div className="space-y-2">
          <input
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-violet-50 file:text-violet-700 hover:file:bg-violet-100 cursor-pointer"
          />
          <p className="text-xs text-gray-500">PNG, JPG, or SVG. Max 2MB.</p>
        </div>
      )}

      {/* Error message */}
      {logoError && (
        <div className="flex items-center gap-2 text-sm text-amber-600">
          <AlertCircle className="h-4 w-4" />
          <span>{logoError}</span>
        </div>
      )}

      {/* Logo preview */}
      {previewUrl && logoSource !== 'none' && (
        <div className="mt-3">
          <p className="text-xs text-gray-500 mb-2">Preview:</p>
          <div className="inline-flex items-center justify-center p-3 bg-gray-50 rounded-lg border border-gray-200">
            <img
              src={previewUrl}
              alt="Logo preview"
              className="max-h-12 max-w-32 object-contain"
              onError={() => {
                setLogoError('Failed to load logo image');
                setPreviewUrl(null);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

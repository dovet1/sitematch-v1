'use client';

import React from 'react';
import { X, Building, Tag, FileText, Home, Ruler, TreePine, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export type FilterType = 'company' | 'sector' | 'useClass' | 'listingType' | 'size' | 'acreage' | 'dwelling';

interface FilterPillProps {
  type: FilterType;
  label: string;
  value: string;
  onRemove: () => void;
  maxLength?: number;
  showIcon?: boolean;
  className?: string;
}

// Icon mapping for different filter types
const FILTER_ICONS = {
  company: Building,
  sector: Tag,
  useClass: FileText,
  listingType: Home,
  size: Ruler,
  acreage: TreePine,
  dwelling: Users
} as const;

// Filter type styling
const FILTER_STYLES = {
  company: 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100',
  sector: 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100',
  useClass: 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100',
  listingType: 'bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100',
  size: 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100',
  acreage: 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100',
  dwelling: 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100'
} as const;

// Remove button hover styles for each type
const REMOVE_HOVER_STYLES = {
  company: 'hover:bg-blue-200',
  sector: 'hover:bg-green-200',
  useClass: 'hover:bg-purple-200',
  listingType: 'hover:bg-orange-200',
  size: 'hover:bg-gray-200',
  acreage: 'hover:bg-emerald-200',
  dwelling: 'hover:bg-indigo-200'
} as const;

const FilterIcon: React.FC<{ type: FilterType }> = ({ type }) => {
  const Icon = FILTER_ICONS[type];
  return <Icon className="w-3 h-3 flex-shrink-0" />;
};

const capitalizeText = (text: string): string => {
  return text
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

const smartTruncateText = (text: string, maxLength: number, type: FilterType): string => {
  if (text.length <= maxLength) return text;
  
  // For different filter types, preserve the most important part
  switch (type) {
    case 'company':
      // For company names, try to preserve the end (e.g., "...Ltd", "...Inc")
      const companyValue = text.replace('Company: ', '');
      if (companyValue.length > maxLength - 10) { // Account for "Company: "
        const truncatedCompany = `${companyValue.slice(0, maxLength - 13)}...`;
        return `Company: ${truncatedCompany}`;
      }
      return text;
      
    case 'sector':
    case 'useClass':
      // For sectors and use classes, preserve the beginning as it's usually most descriptive
      return `${text.slice(0, maxLength - 3)}...`;
      
    case 'listingType':
      // Listing types are usually short, but if long, preserve beginning
      return `${text.slice(0, maxLength - 3)}...`;
      
    case 'size':
    case 'acreage':
    case 'dwelling':
      // For ranges, try to keep both numbers visible or show "X - ..."
      if (text.includes(' - ')) {
        const parts = text.split(' - ');
        const start = parts[0];
        const end = parts[1];
        
        // If start is very long, truncate it but keep context
        if (start.length > maxLength - 8) {
          const truncatedStart = start.slice(0, maxLength - 11);
          return `${truncatedStart}... - ...`;
        }
        
        // If total length is too long, show "start - ..."
        if (text.length > maxLength) {
          return `${start} - ...`;
        }
      }
      return `${text.slice(0, maxLength - 3)}...`;
      
    default:
      return `${text.slice(0, maxLength - 3)}...`;
  }
};

const formatPillLabel = (type: FilterType, value: string): string => {
  // Special handling for listing types to ensure proper capitalization
  let capitalizedValue;
  if (type === 'listingType') {
    // Ensure proper capitalization for listing types
    capitalizedValue = value.toLowerCase() === 'commercial' ? 'Commercial' : 
                     value.toLowerCase() === 'residential' ? 'Residential' : 
                     capitalizeText(value);
  } else {
    capitalizedValue = capitalizeText(value);
  }
  
  const prefixes = {
    company: 'Company: ',
    sector: 'Sector: ',
    useClass: 'Use Class: ',
    listingType: '', // No prefix for listing types
    size: 'Size: ',
    acreage: 'Acreage: ',
    dwelling: 'Dwellings: '
  };
  
  return `${prefixes[type]}${capitalizedValue}`;
};

const FilterPillWithTooltip: React.FC<{
  children: React.ReactNode;
  fullText: string;
  isShortened: boolean;
}> = ({ children, fullText, isShortened }) => {
  if (!isShortened) return <>{children}</>;
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {children}
        </TooltipTrigger>
        <TooltipContent>
          <p className="max-w-xs">{fullText}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export const FilterPill: React.FC<FilterPillProps> = ({
  type,
  label,
  value,
  onRemove,
  maxLength = 25,
  showIcon = true,
  className = ''
}) => {
  const fullText = formatPillLabel(type, value);
  const displayText = smartTruncateText(fullText, maxLength, type);
  const isShortened = fullText !== displayText;
  const ariaLabel = `Remove ${fullText} filter`;

  return (
    <FilterPillWithTooltip fullText={fullText} isShortened={isShortened}>
      <div 
        className={cn(
          // Base pill styles
          'inline-flex items-center gap-1.5 px-3 py-1.5 pr-1 rounded-2xl text-sm font-medium',
          'border transition-all duration-200 ease-out max-w-[200px]',
          'hover:transform hover:-translate-y-0.5 hover:shadow-md',
          'md:max-w-[200px] sm:max-w-[150px] xs:max-w-[120px]',
          // Type-specific styles
          FILTER_STYLES[type],
          className
        )}
        role="group"
        aria-label={`Active filter: ${fullText}`}
      >
        {showIcon && <FilterIcon type={type} />}
        
        <span className="overflow-hidden text-ellipsis whitespace-nowrap flex-1 min-w-0">
          {displayText}
        </span>
        
        <Button
          type="button"
          onClick={onRemove}
          className={cn(
            'h-5 w-5 p-0 rounded-full border-none bg-transparent',
            'transition-all duration-150 ease-out flex-shrink-0',
            'hover:scale-110 focus:scale-110',
            'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1',
            'relative',
            // Type-specific remove button hover
            REMOVE_HOVER_STYLES[type],
            // Enhanced touch target for mobile
            'before:content-[""] before:absolute before:inset-0',
            'before:w-11 before:h-11 before:-m-3 before:rounded-full',
            'md:before:w-5 md:before:h-5 md:before:m-0'
          )}
          aria-label={ariaLabel}
          title={ariaLabel}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onRemove();
            }
          }}
        >
          <X className="w-3 h-3" aria-hidden="true" />
        </Button>
      </div>
    </FilterPillWithTooltip>
  );
};
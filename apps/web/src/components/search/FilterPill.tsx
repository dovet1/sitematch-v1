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

// Unified filter styling - matches site's primary color system
const FILTER_STYLES = {
  company: 'bg-primary-50 text-primary-700 border-primary-200 hover:bg-primary-100',
  sector: 'bg-primary-50 text-primary-700 border-primary-200 hover:bg-primary-100',
  useClass: 'bg-primary-50 text-primary-700 border-primary-200 hover:bg-primary-100',
  listingType: 'bg-primary-50 text-primary-700 border-primary-200 hover:bg-primary-100',
  size: 'bg-muted text-foreground border-border hover:bg-muted/80',
  acreage: 'bg-muted text-foreground border-border hover:bg-muted/80',
  dwelling: 'bg-muted text-foreground border-border hover:bg-muted/80'
} as const;

// Unified remove button hover styles
const REMOVE_HOVER_STYLES = {
  company: 'hover:bg-primary-200/60',
  sector: 'hover:bg-primary-200/60',
  useClass: 'hover:bg-primary-200/60',
  listingType: 'hover:bg-primary-200/60',
  size: 'hover:bg-muted-foreground/20',
  acreage: 'hover:bg-muted-foreground/20',
  dwelling: 'hover:bg-muted-foreground/20'
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
      // For company names, show more of the actual company name
      const companyValue = text.replace('Company: ', '');
      if (companyValue.length > maxLength - 10) { // Account for "Company: "
        const availableSpace = maxLength - 10; // "Company: " = 9 chars + ellipsis
        const truncatedCompany = `${companyValue.slice(0, availableSpace - 3)}...`;
        return `Company: ${truncatedCompany}`;
      }
      return text;
      
    case 'sector':
    case 'useClass':
      // For sectors and use classes, preserve the beginning but be less aggressive
      if (text.length > maxLength) {
        return `${text.slice(0, maxLength - 3)}...`;
      }
      return text;
      
    case 'listingType':
      // Listing types are usually short, don't truncate aggressively
      if (text.length > maxLength) {
        return `${text.slice(0, maxLength - 3)}...`;
      }
      return text;
      
    case 'size':
    case 'acreage':
    case 'dwelling':
      // For ranges, prioritize showing complete information
      if (text.includes(' - ')) {
        const parts = text.split(' - ');
        const prefix = type === 'size' ? 'Size: ' : type === 'acreage' ? 'Acreage: ' : 'Dwellings: ';
        const start = parts[0].replace(prefix, '');
        const end = parts[1];
        
        // Try to show the full range if possible
        const rangeText = `${start} - ${end}`;
        const fullTextWithPrefix = `${prefix}${rangeText}`;
        
        if (fullTextWithPrefix.length <= maxLength) {
          return fullTextWithPrefix;
        }
        
        // If too long, truncate the end value
        const availableForEnd = maxLength - prefix.length - start.length - 5; // " - ..."
        if (availableForEnd > 3) {
          return `${prefix}${start} - ${end.slice(0, availableForEnd)}...`;
        }
        
        // Last resort: show start only
        return `${prefix}${start}+`;
      }
      return text.length > maxLength ? `${text.slice(0, maxLength - 3)}...` : text;
      
    default:
      return text.length > maxLength ? `${text.slice(0, maxLength - 3)}...` : text;
  }
};

const formatNumber = (num: string): string => {
  // Remove any existing commas and convert to number
  const cleanNum = num.replace(/,/g, '');
  const number = parseInt(cleanNum);
  
  // If it's a valid number, format with commas
  if (!isNaN(number)) {
    return number.toLocaleString();
  }
  
  // If not a number, return as is
  return num;
};

const formatPillLabel = (type: FilterType, value: string): string => {
  // Special handling for listing types to ensure proper capitalization
  let capitalizedValue;
  if (type === 'listingType') {
    // Ensure proper capitalization for listing types
    capitalizedValue = value.toLowerCase() === 'commercial' ? 'Commercial' : 
                     value.toLowerCase() === 'residential' ? 'Residential' : 
                     capitalizeText(value);
  } else if (type === 'size') {
    // Special formatting for size ranges with comma-separated numbers
    if (value.includes(' - ')) {
      const parts = value.split(' - ');
      const startNum = formatNumber(parts[0]);
      const endPart = parts[1];
      
      // Handle cases like "5000 sq ft" or just "5000"
      if (endPart.includes(' ')) {
        const endParts = endPart.split(' ');
        const endNum = formatNumber(endParts[0]);
        const unit = endParts.slice(1).join(' ');
        capitalizedValue = `${startNum} - ${endNum} ${unit}`;
      } else {
        const endNum = formatNumber(endPart);
        capitalizedValue = `${startNum} - ${endNum}`;
      }
    } else {
      // Single number case
      if (value.includes(' ')) {
        const parts = value.split(' ');
        const num = formatNumber(parts[0]);
        const unit = parts.slice(1).join(' ');
        capitalizedValue = `${num} ${unit}`;
      } else {
        capitalizedValue = formatNumber(value);
      }
    }
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
  maxLength = 40,
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
          // Base pill styles - matches button design language
          'inline-flex items-center gap-1 px-2 py-1 pr-1 rounded-md text-xs font-medium',
          'border transition-all duration-200 ease-in-out',
          'hover:shadow-sm focus-within:ring-2 focus-within:ring-primary-300 focus-within:ring-offset-1',
          'max-w-fit min-w-0',
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
            'h-6 w-6 p-0 rounded-full border-none',
            'bg-black/10 hover:bg-black/20 focus:bg-black/20',
            'transition-all duration-200 ease-in-out flex-shrink-0',
            'hover:scale-110 focus:scale-110',
            'focus:outline-none focus:ring-2 focus:ring-primary-300 focus:ring-offset-1',
            'relative group',
            // Enhanced touch target for mobile
            'before:content-[""] before:absolute before:inset-0',
            'before:w-11 before:h-11 before:-m-2.5 before:rounded-full',
            'md:before:w-6 md:before:h-6 md:before:m-0'
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
          <X className="w-3.5 h-3.5 text-black/60 group-hover:text-black/80 transition-colors" aria-hidden="true" />
        </Button>
      </div>
    </FilterPillWithTooltip>
  );
};
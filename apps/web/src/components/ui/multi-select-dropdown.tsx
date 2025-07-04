// =====================================================
// Multi-Select Dropdown Component
// Searchable multi-select dropdown with badges
// =====================================================

'use client';

import * as React from 'react';
import { Check, ChevronDown, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

export interface MultiSelectOption {
  value: string;
  label: string;
  description?: string;
}

interface MultiSelectDropdownProps {
  label?: string;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  options: MultiSelectOption[];
  value: string[];
  onChange: (value: string[]) => void;
  disabled?: boolean;
  className?: string;
  maxDisplay?: number;
}

export function MultiSelectDropdown({
  label,
  placeholder = "Select options...",
  searchPlaceholder = "Search options...",
  emptyText = "No options found",
  options,
  value = [],
  onChange,
  disabled = false,
  className,
  maxDisplay = 2
}: MultiSelectDropdownProps) {
  const [open, setOpen] = React.useState(false);

  const handleSelect = (optionValue: string) => {
    const newValue = value.includes(optionValue)
      ? value.filter(v => v !== optionValue)
      : [...value, optionValue];
    onChange(newValue);
  };

  const handleRemove = (optionValue: string) => {
    onChange(value.filter(v => v !== optionValue));
  };

  const selectedOptions = value.map(v => options.find(opt => opt.value === v)).filter(Boolean) as MultiSelectOption[];
  const displayOptions = selectedOptions.slice(0, maxDisplay);
  const remainingCount = selectedOptions.length - maxDisplay;

  return (
    <div className={cn("space-y-2", className)}>
      {label && (
        <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
          {label}
        </label>
      )}
      
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn(
              "w-full justify-between min-h-10 h-auto bg-white border-gray-300 hover:bg-gray-50",
              disabled && "cursor-not-allowed opacity-50"
            )}
            disabled={disabled}
          >
            <div className="flex flex-wrap gap-1 flex-1">
              {selectedOptions.length === 0 ? (
                <span className="text-muted-foreground">{placeholder}</span>
              ) : (
                <>
                  {displayOptions.map((option) => (
                    <Badge
                      key={option.value}
                      className="text-xs bg-violet-100 text-violet-800 hover:bg-violet-200"
                    >
                      {option.label}
                      <button
                        className="ml-1 ring-offset-background rounded-full outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            handleRemove(option.value);
                          }
                        }}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                        }}
                        onClick={() => handleRemove(option.value)}
                      >
                        <X className="h-3 w-3 text-violet-600 hover:text-violet-800" />
                      </button>
                    </Badge>
                  ))}
                  {remainingCount > 0 && (
                    <Badge className="text-xs bg-violet-100 text-violet-800">
                      +{remainingCount} more
                    </Badge>
                  )}
                </>
              )}
            </div>
            <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        
        <PopoverContent className="w-full p-0 bg-white" align="start">
          <Command>
            <CommandInput placeholder={searchPlaceholder} className="h-9" />
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup className="max-h-64 overflow-auto">
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.value}
                  onSelect={() => handleSelect(option.value)}
                  className="cursor-pointer"
                >
                  <div className="flex items-center space-x-2 w-full">
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value.includes(option.value) ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium">{option.label}</div>
                      {option.description && (
                        <div className="text-xs text-muted-foreground truncate">
                          {option.description}
                        </div>
                      )}
                    </div>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
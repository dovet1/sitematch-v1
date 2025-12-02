"use client"

import * as React from "react"
import { Check, ChevronDown, Search, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Command } from "cmdk"

export interface SearchableOption {
  value: string
  label: string
  description?: string
  disabled?: boolean
}

interface SearchableDropdownProps {
  value?: string
  selected?: string[]
  onChange?: (value: string) => void
  options: SearchableOption[]
  placeholder?: string
  searchPlaceholder?: string
  emptyText?: string
  label?: string
  className?: string
  disabled?: boolean
  required?: boolean
  clearable?: boolean
  multiple?: boolean
}

export function SearchableDropdown({
  value,
  selected = [],
  onChange,
  options,
  placeholder = "Select an option...",
  searchPlaceholder = "Search options...",
  emptyText = "No options found.",
  label,
  className,
  disabled = false,
  required = false,
  clearable = false,
  multiple = false
}: SearchableDropdownProps) {
  const [open, setOpen] = React.useState(false)
  const [searchValue, setSearchValue] = React.useState("")

  const selectedOption = options.find((option) => option.value === value)
  const selectedOptions = options.filter((option) => selected.includes(option.value))

  const filteredOptions = React.useMemo(() => {
    if (!searchValue) return options

    return options.filter((option) =>
      option.label.toLowerCase().includes(searchValue.toLowerCase()) ||
      option.description?.toLowerCase().includes(searchValue.toLowerCase())
    )
  }, [options, searchValue])

  const handleSelect = (optionValue: string) => {
    if (multiple) {
      // Toggle selection for multiple mode
      const newSelected = selected.includes(optionValue)
        ? selected.filter(v => v !== optionValue)
        : [...selected, optionValue]
      onChange?.(newSelected as any)
      setSearchValue("")
    } else {
      onChange?.(optionValue)
      setOpen(false)
      setSearchValue("")
    }
  }

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (multiple) {
      onChange?.([] as any)
    } else {
      onChange?.("")
    }
    setSearchValue("")
  }

  const handleRemoveItem = (e: React.MouseEvent, valueToRemove: string) => {
    e.stopPropagation()
    const newSelected = selected.filter(v => v !== valueToRemove)
    onChange?.(newSelected as any)
  }

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen)
    if (!newOpen) {
      setSearchValue("")
    }
  }

  return (
    <div className={cn("space-y-2", className)}>
      {label && (
        <Label className="text-sm font-medium">
          {label}
          {required && <span className="text-destructive ml-1">*</span>}
        </Label>
      )}
      
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn(
              "w-full justify-between bg-white hover:bg-gray-50 hover:text-foreground min-h-[40px] h-auto",
              !selectedOption && !selectedOptions.length && "text-muted-foreground",
              disabled && "opacity-50 cursor-not-allowed"
            )}
            disabled={disabled}
          >
            <div className="flex items-center flex-1 min-w-0">
              {multiple ? (
                selectedOptions.length > 0 ? (
                  <div className="flex flex-wrap gap-1 py-1">
                    {selectedOptions.map((option) => (
                      <div
                        key={option.value}
                        className="inline-flex items-center gap-1 bg-violet-100 text-violet-900 px-2 py-0.5 rounded text-sm"
                      >
                        <span>{option.label}</span>
                        <button
                          type="button"
                          onClick={(e) => handleRemoveItem(e, option.value)}
                          className="hover:bg-violet-200 rounded p-0.5"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <span>{placeholder}</span>
                )
              ) : selectedOption ? (
                <div className="flex flex-col items-start min-w-0">
                  <span className="truncate text-sm">{selectedOption.label}</span>
                  {selectedOption.description && (
                    <span className="text-xs text-muted-foreground truncate">
                      {selectedOption.description}
                    </span>
                  )}
                </div>
              ) : (
                <span>{placeholder}</span>
              )}
            </div>

            <div className="flex items-center gap-1 flex-shrink-0">
              {clearable && ((multiple && selectedOptions.length > 0) || (!multiple && selectedOption)) && !disabled && (
                <div
                  onClick={handleClear}
                  className="hover:bg-muted rounded p-1 transition-colors"
                >
                  <X className="h-3 w-3" />
                </div>
              )}
              <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
            </div>
          </Button>
        </PopoverTrigger>
        
        <PopoverContent
          className="w-[var(--radix-popover-trigger-width)] p-0"
          align="start"
          style={{ maxHeight: '400px', display: 'flex', flexDirection: 'column' }}
        >
          <div className="flex items-center border-b px-3 flex-shrink-0">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <Input
              placeholder={searchPlaceholder}
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              className="border-0 px-0 py-2 focus-visible:ring-0 focus-visible:ring-offset-0"
            />
          </div>

          <div
            className="overflow-y-scroll p-2 flex-1"
            style={{ maxHeight: '300px', overflowY: 'scroll', WebkitOverflowScrolling: 'touch' }}
          >
            {filteredOptions.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                {emptyText}
              </div>
            ) : (
              filteredOptions.map((option) => {
                const isSelected = multiple
                  ? selected.includes(option.value)
                  : value === option.value

                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => handleSelect(option.value)}
                    disabled={option.disabled}
                    className={cn(
                      "w-full flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-accent rounded-sm text-left",
                      option.disabled && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    <Check
                      className={cn(
                        "h-4 w-4 flex-shrink-0",
                        isSelected ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <span className="truncate">{option.label}</span>
                  </button>
                )
              })
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
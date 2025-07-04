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
  onChange: (value: string) => void
  options: SearchableOption[]
  placeholder?: string
  searchPlaceholder?: string
  emptyText?: string
  label?: string
  className?: string
  disabled?: boolean
  required?: boolean
  clearable?: boolean
}

export function SearchableDropdown({
  value,
  onChange,
  options,
  placeholder = "Select an option...",
  searchPlaceholder = "Search options...",
  emptyText = "No options found.",
  label,
  className,
  disabled = false,
  required = false,
  clearable = false
}: SearchableDropdownProps) {
  const [open, setOpen] = React.useState(false)
  const [searchValue, setSearchValue] = React.useState("")

  const selectedOption = options.find((option) => option.value === value)

  const filteredOptions = React.useMemo(() => {
    if (!searchValue) return options
    
    return options.filter((option) =>
      option.label.toLowerCase().includes(searchValue.toLowerCase()) ||
      option.description?.toLowerCase().includes(searchValue.toLowerCase())
    )
  }, [options, searchValue])

  const handleSelect = (optionValue: string) => {
    onChange(optionValue)
    setOpen(false)
    setSearchValue("")
  }

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    onChange("")
    setSearchValue("")
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
              "w-full justify-between bg-white",
              !selectedOption && "text-muted-foreground",
              disabled && "opacity-50 cursor-not-allowed"
            )}
            disabled={disabled}
          >
            <div className="flex items-center flex-1 min-w-0">
              {selectedOption ? (
                <div className="flex flex-col items-start min-w-0">
                  <span className="truncate">{selectedOption.label}</span>
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
            
            <div className="flex items-center gap-1">
              {clearable && selectedOption && !disabled && (
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
        
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
          <Command shouldFilter={false}>
            <div className="flex items-center border-b px-3">
              <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
              <Input
                placeholder={searchPlaceholder}
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                className="border-0 px-0 py-2 focus-visible:ring-0 focus-visible:ring-offset-0"
              />
            </div>
            
            <Command.Group className="max-h-[300px] overflow-y-auto">
              {filteredOptions.length === 0 ? (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  {emptyText}
                </div>
              ) : (
                filteredOptions.map((option) => (
                  <Command.Item
                    key={option.value}
                    value={option.value}
                    onSelect={() => handleSelect(option.value)}
                    disabled={option.disabled}
                    className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-accent"
                  >
                    <Check
                      className={cn(
                        "h-4 w-4",
                        value === option.value ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <div className="flex flex-col flex-1 min-w-0">
                      <span className="truncate">{option.label}</span>
                      {option.description && (
                        <span className="text-xs text-muted-foreground truncate">
                          {option.description}
                        </span>
                      )}
                    </div>
                  </Command.Item>
                ))
              )}
            </Command.Group>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  )
}
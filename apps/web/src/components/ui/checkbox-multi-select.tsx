"use client"

import * as React from "react"
import { ChevronDown, X, Search } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"

export interface CheckboxOption {
  value: string
  label: string
}

interface CheckboxMultiSelectProps {
  options: CheckboxOption[]
  selected: string[]
  onChange: (values: string[]) => void
  placeholder?: string
  searchPlaceholder?: string
  emptyText?: string
  label?: string
  className?: string
  disabled?: boolean
}

export function CheckboxMultiSelect({
  options,
  selected,
  onChange,
  placeholder = "Select options...",
  searchPlaceholder = "Search...",
  emptyText = "No options found.",
  label,
  className,
  disabled = false,
}: CheckboxMultiSelectProps) {
  const [open, setOpen] = React.useState(false)
  const [searchValue, setSearchValue] = React.useState("")
  const containerRef = React.useRef<HTMLDivElement>(null)

  const selectedOptions = options.filter((option) => selected.includes(option.value))

  const filteredOptions = React.useMemo(() => {
    if (!searchValue) return options

    return options.filter((option) =>
      option.label.toLowerCase().includes(searchValue.toLowerCase())
    )
  }, [options, searchValue])

  const handleToggle = (value: string) => {
    const newSelected = selected.includes(value)
      ? selected.filter((v) => v !== value)
      : [...selected, value]
    onChange(newSelected)
  }

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    onChange([])
  }

  const handleRemoveItem = (e: React.MouseEvent, valueToRemove: string) => {
    e.stopPropagation()
    const newSelected = selected.filter((v) => v !== valueToRemove)
    onChange(newSelected)
  }

  // Close on click outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    if (open) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [open])

  return (
    <div className={cn("space-y-2 relative", className)} ref={containerRef}>
      {label && <Label className="text-sm font-medium">{label}</Label>}

      <Button
        type="button"
        variant="outline"
        onClick={() => setOpen(!open)}
        className={cn(
          "w-full justify-between bg-white hover:bg-gray-50 hover:text-foreground min-h-[40px] h-auto",
          !selectedOptions.length && "text-muted-foreground",
          disabled && "opacity-50 cursor-not-allowed"
        )}
        disabled={disabled}
      >
        <div className="flex items-center flex-1 min-w-0">
          {selectedOptions.length > 0 ? (
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
          )}
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          {selectedOptions.length > 0 && !disabled && (
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

      {/* Dropdown - absolute positioned like location dropdown */}
      {open && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-80 overflow-y-auto">
          {/* Search Input */}
          <div className="sticky top-0 bg-white border-b px-3 py-2">
            <div className="flex items-center">
              <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
              <Input
                placeholder={searchPlaceholder}
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                className="border-0 px-0 py-0 h-auto focus-visible:ring-0 focus-visible:ring-offset-0"
              />
            </div>
          </div>

          {/* Scrollable Options List */}
          <div className="p-3">
            {filteredOptions.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                {emptyText}
              </div>
            ) : (
              <div className="space-y-2">
                {filteredOptions.map((option) => (
                  <div key={option.value} className="flex items-center space-x-2">
                    <Checkbox
                      id={`checkbox-${option.value}`}
                      checked={selected.includes(option.value)}
                      onCheckedChange={() => handleToggle(option.value)}
                      className="violet-bloom-checkbox"
                    />
                    <Label
                      htmlFor={`checkbox-${option.value}`}
                      className="text-sm cursor-pointer flex-1"
                    >
                      {option.label}
                    </Label>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

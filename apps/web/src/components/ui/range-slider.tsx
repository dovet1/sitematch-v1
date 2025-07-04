"use client"

import * as React from "react"
import * as SliderPrimitive from "@radix-ui/react-slider"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface RangeSliderProps {
  value: [number, number]
  onChange: (value: [number, number]) => void
  min?: number
  max?: number
  step?: number
  className?: string
  disabled?: boolean
  label?: string
  unit?: string
  formatValue?: (value: number) => string
  showInputs?: boolean
}

export function RangeSlider({
  value,
  onChange,
  min = 0,
  max = 10000,
  step = 100,
  className,
  disabled = false,
  label,
  unit = "sq ft",
  formatValue,
  showInputs = true
}: RangeSliderProps) {
  const [localValue, setLocalValue] = React.useState<[number, number]>(value)
  const [inputValues, setInputValues] = React.useState({
    min: value[0].toString(),
    max: value[1].toString()
  })

  // Sync with external value changes
  React.useEffect(() => {
    setLocalValue(value)
    setInputValues({
      min: value[0].toString(),
      max: value[1].toString()
    })
  }, [value])

  const defaultFormatValue = React.useCallback((val: number): string => {
    if (val === 0) return "0"
    return val.toLocaleString()
  }, [])

  const formatValueFn = formatValue || defaultFormatValue

  const handleSliderChange = (newValue: number[]) => {
    const [newMin, newMax] = newValue as [number, number]
    const validatedValue: [number, number] = [
      Math.max(min, Math.min(newMin, max)),
      Math.max(min, Math.min(newMax, max))
    ]
    
    // Ensure min is not greater than max
    if (validatedValue[0] > validatedValue[1]) {
      validatedValue[0] = validatedValue[1]
    }

    setLocalValue(validatedValue)
    onChange(validatedValue)
  }

  const handleInputChange = (type: 'min' | 'max', inputValue: string) => {
    setInputValues(prev => ({ ...prev, [type]: inputValue }))
  }

  const handleInputBlur = (type: 'min' | 'max') => {
    const inputValue = inputValues[type]
    const numericValue = inputValue === '' ? 0 : parseInt(inputValue, 10)
    
    if (isNaN(numericValue)) {
      // Reset to current value if invalid
      setInputValues(prev => ({ 
        ...prev, 
        [type]: localValue[type === 'min' ? 0 : 1].toString() 
      }))
      return
    }

    const clampedValue = Math.max(min, Math.min(numericValue, max))
    const newValue: [number, number] = [...localValue]
    
    if (type === 'min') {
      newValue[0] = Math.min(clampedValue, localValue[1])
    } else {
      newValue[1] = Math.max(clampedValue, localValue[0])
    }

    setLocalValue(newValue)
    onChange(newValue)
  }

  const handleInputKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    type: 'min' | 'max'
  ) => {
    if (e.key === 'Enter') {
      handleInputBlur(type)
    }
  }

  const getRangeDisplay = () => {
    const [minVal, maxVal] = localValue
    if (minVal === maxVal) {
      return `${formatValueFn(minVal)} ${unit}`
    }
    if (minVal === min && maxVal === max) {
      return `Any size`
    }
    if (minVal === min) {
      return `Up to ${formatValueFn(maxVal)} ${unit}`
    }
    if (maxVal === max) {
      return `${formatValueFn(minVal)}+ ${unit}`
    }
    return `${formatValueFn(minVal)} - ${formatValueFn(maxVal)} ${unit}`
  }

  return (
    <div className={cn("space-y-4", className)}>
      {label && (
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">{label}</Label>
          <span className="text-sm text-muted-foreground">
            {getRangeDisplay()}
          </span>
        </div>
      )}
      
      <div className="px-2">
        <SliderPrimitive.Root
          className={cn(
            "relative flex w-full touch-none select-none items-center",
            disabled && "opacity-50 cursor-not-allowed"
          )}
          value={localValue}
          onValueChange={handleSliderChange}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
        >
          <SliderPrimitive.Track className="relative h-2 w-full grow overflow-hidden rounded-full bg-gray-200">
            <SliderPrimitive.Range className="absolute h-full bg-violet-500" />
          </SliderPrimitive.Track>
          
          <SliderPrimitive.Thumb className="block h-5 w-5 rounded-full border-2 border-violet-500 bg-white ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50" />
          
          <SliderPrimitive.Thumb className="block h-5 w-5 rounded-full border-2 border-violet-500 bg-white ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50" />
        </SliderPrimitive.Root>
      </div>

      {showInputs && (
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label htmlFor="range-min" className="text-xs text-muted-foreground">
              Minimum {unit}
            </Label>
            <div className="relative">
              <Input
                id="range-min"
                type="number"
                value={inputValues.min}
                onChange={(e) => handleInputChange('min', e.target.value)}
                onBlur={() => handleInputBlur('min')}
                onKeyDown={(e) => handleInputKeyDown(e, 'min')}
                min={min}
                max={max}
                step={step}
                disabled={disabled}
                className="pr-12"
                placeholder="0"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                {unit}
              </span>
            </div>
          </div>
          
          <div className="space-y-1">
            <Label htmlFor="range-max" className="text-xs text-muted-foreground">
              Maximum {unit}
            </Label>
            <div className="relative">
              <Input
                id="range-max"
                type="number"
                value={inputValues.max}
                onChange={(e) => handleInputChange('max', e.target.value)}
                onBlur={() => handleInputBlur('max')}
                onKeyDown={(e) => handleInputKeyDown(e, 'max')}
                min={min}
                max={max}
                step={step}
                disabled={disabled}
                className="pr-12"
                placeholder={max.toString()}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                {unit}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
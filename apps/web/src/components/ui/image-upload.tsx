"use client"

import * as React from "react"
import { Upload, X, Image as ImageIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

interface ImageUploadProps {
  value?: File | string
  onChange: (file: File | null) => void
  onPreviewChange?: (preview: string | null) => void
  maxSize?: number // bytes, default 2MB
  acceptedTypes?: string[]
  className?: string
  disabled?: boolean
  placeholder?: string
}

export function ImageUpload({
  value,
  onChange,
  onPreviewChange,
  maxSize = 2 * 1024 * 1024, // 2MB default
  acceptedTypes = ["image/png", "image/jpeg", "image/jpg", "image/svg+xml"],
  className,
  disabled = false,
  placeholder = "Upload company logo"
}: ImageUploadProps) {
  const [preview, setPreview] = React.useState<string | null>(null)
  const [isDragOver, setIsDragOver] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  // Generate preview when value changes
  React.useEffect(() => {
    if (value instanceof File) {
      const objectUrl = URL.createObjectURL(value)
      setPreview(objectUrl)
      onPreviewChange?.(objectUrl)
      return () => {
        URL.revokeObjectURL(objectUrl)
      }
    } else if (typeof value === "string" && value) {
      setPreview(value)
      onPreviewChange?.(value)
    } else {
      setPreview(null)
      onPreviewChange?.(null)
    }
  }, [value]) // Removed onPreviewChange to prevent infinite loops

  const validateFile = React.useCallback((file: File): string | null => {
    if (!acceptedTypes.includes(file.type)) {
      return `Invalid file type. Please upload ${acceptedTypes.join(", ")}`
    }
    if (file.size > maxSize) {
      const maxSizeMB = maxSize / (1024 * 1024)
      return `File too large. Maximum size is ${maxSizeMB}MB`
    }
    return null
  }, [acceptedTypes, maxSize])

  const handleFileChange = React.useCallback((file: File) => {
    setError(null)
    const validationError = validateFile(file)
    
    if (validationError) {
      setError(validationError)
      return
    }

    onChange(file)
  }, [onChange, validateFile])

  const handleDrop = React.useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      setIsDragOver(false)

      if (disabled) return

      const files = Array.from(e.dataTransfer.files)
      if (files.length > 0) {
        handleFileChange(files[0])
      }
    },
    [disabled, handleFileChange] // Added handleFileChange dependency
  )

  const handleDragOver = React.useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    if (!disabled) {
      setIsDragOver(true)
    }
  }, [disabled])

  const handleDragLeave = React.useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragOver(false)
  }, [])

  const handleClick = () => {
    if (!disabled) {
      fileInputRef.current?.click()
    }
  }

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length > 0) {
      handleFileChange(files[0])
    }
  }

  const handleRemove = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setError(null)
    onChange(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes"
    const k = 1024
    const sizes = ["Bytes", "KB", "MB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
  }

  return (
    <div className={cn("space-y-2", className)}>
      <div
        className={cn(
          "relative border-2 border-dashed rounded-lg transition-colors cursor-pointer",
          "hover:border-primary/50 focus-within:border-primary",
          isDragOver && "border-primary bg-primary/5",
          disabled && "opacity-50 cursor-not-allowed",
          error && "border-destructive",
          preview ? "border-solid" : "border-dashed"
        )}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={handleClick}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={acceptedTypes.join(",")}
          onChange={handleFileInputChange}
          className="hidden"
          disabled={disabled}
        />

        {preview ? (
          <div className="relative p-4">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                <img
                  src={preview}
                  alt="Upload preview"
                  className="w-24 h-24 object-cover rounded-lg border"
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium truncate">
                      {value instanceof File ? value.name : "Uploaded image"}
                    </p>
                    {value instanceof File && (
                      <p className="text-xs text-muted-foreground">
                        {formatFileSize(value.size)}
                      </p>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleRemove}
                    disabled={disabled}
                    className="flex-shrink-0 h-8 w-8 p-0"
                  >
                    <X className="h-4 w-4" />
                    <span className="sr-only">Remove image</span>
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Click to replace or drag a new image here
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-8 text-center">
            <div className="mx-auto w-12 h-12 mb-4 bg-muted rounded-lg flex items-center justify-center">
              {isDragOver ? (
                <Upload className="h-6 w-6 text-primary" />
              ) : (
                <ImageIcon className="h-6 w-6 text-muted-foreground" />
              )}
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium">{placeholder}</p>
              <p className="text-xs text-muted-foreground">
                Drag and drop or click to browse
              </p>
              <p className="text-xs text-muted-foreground">
                {acceptedTypes.map(type => type.split('/')[1].toUpperCase()).join(', ')} • Max {Math.round(maxSize / (1024 * 1024))}MB
              </p>
            </div>
          </div>
        )}
      </div>

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
    </div>
  )
}
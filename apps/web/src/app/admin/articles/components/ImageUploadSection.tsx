'use client'

import { useState } from 'react'
import { ArticleImage } from '@/types/articles'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Upload, X, Star } from 'lucide-react'
import { updateArticleImageAction, deleteArticleImageAction } from '@/lib/actions/articles'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

interface ImageUploadSectionProps {
  articleId: string
  images: ArticleImage[]
}

export function ImageUploadSection({ articleId, images }: ImageUploadSectionProps) {
  const [uploading, setUploading] = useState(false)
  const router = useRouter()

  // Sort images by display_order
  const sortedImages = [...images].sort((a, b) => a.display_order - b.display_order)

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)

    const formData = new FormData()
    formData.append('file', file)
    formData.append('articleId', articleId)

    try {
      const response = await fetch('/api/articles/upload-image', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Upload failed')
      }

      const uploadData = await response.json()

      // Success! The upload endpoint already adds to article_images table
      toast.success('Image uploaded successfully')
      // Reset the file input
      e.target.value = ''
      // Force a hard refresh to reload the page with new images
      window.location.reload()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to upload image')
      // Reset the file input on error too
      e.target.value = ''
    } finally {
      setUploading(false)
    }
  }

  const handleDeleteImage = async (imageId: string) => {
    if (!confirm('Are you sure you want to delete this image?')) return

    const result = await deleteArticleImageAction(imageId)
    if (result.success) {
      toast.success('Image deleted')
      router.refresh()
    } else {
      toast.error(result.error || 'Failed to delete image')
    }
  }

  const handleSetFeatured = async (imageId: string) => {
    // Unset all featured flags first
    for (const img of sortedImages) {
      if (img.is_featured) {
        await updateArticleImageAction(img.id, { is_featured: false })
      }
    }

    // Set new featured image
    const result = await updateArticleImageAction(imageId, { is_featured: true })
    if (result.success) {
      toast.success('Featured image updated')
      router.refresh()
    } else {
      toast.error(result.error || 'Failed to update featured image')
    }
  }

  const handleCaptionChange = async (imageId: string, caption: string) => {
    const result = await updateArticleImageAction(imageId, { caption })
    if (result.success) {
      toast.success('Caption updated')
      router.refresh()
    } else {
      toast.error(result.error || 'Failed to update caption')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label>Article Images (2-3 recommended)</Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={uploading}
          onClick={() => document.getElementById('article-image-upload')?.click()}
        >
          <Upload className="w-4 h-4 mr-2" />
          {uploading ? 'Uploading...' : 'Upload Image'}
        </Button>
        <input
          id="article-image-upload"
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileUpload}
        />
      </div>

      {sortedImages.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8 border-2 border-dashed rounded-lg">
          No images uploaded yet. Upload 2-3 images for your article.
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {sortedImages.map((image) => (
            <div key={image.id} className="border rounded-lg p-4 space-y-3">
              <div className="relative aspect-video rounded overflow-hidden bg-gray-100">
                <img
                  src={image.url}
                  alt={image.caption || ''}
                  className="w-full h-full object-cover"
                />
                {image.is_featured && (
                  <div className="absolute top-2 left-2 bg-yellow-500 text-white px-2 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                    <Star className="w-3 h-3 fill-current" />
                    Featured
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex gap-2">
                  {!image.is_featured && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleSetFeatured(image.id)}
                    >
                      <Star className="w-3 h-3 mr-1" />
                      Set Featured
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDeleteImage(image.id)}
                  >
                    <X className="w-3 h-3 mr-1" />
                    Delete
                  </Button>
                </div>

                <Input
                  placeholder="Image caption (optional)"
                  defaultValue={image.caption || ''}
                  onBlur={(e) => handleCaptionChange(image.id, e.target.value)}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

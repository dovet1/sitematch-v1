'use client'

import { ArticleImage } from '@/types/articles'
import { useState } from 'react'
import { X } from 'lucide-react'

interface ArticleImageGalleryProps {
  images: ArticleImage[]
}

export function ArticleImageGallery({ images }: ArticleImageGalleryProps) {
  const [selectedImage, setSelectedImage] = useState<ArticleImage | null>(null)

  if (images.length === 0) return null

  return (
    <>
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {images.map((image) => (
            <div
              key={image.id}
              className="relative aspect-video rounded-2xl overflow-hidden cursor-pointer group shadow-lg hover:shadow-xl transition-shadow"
              onClick={() => setSelectedImage(image)}
            >
              <img
                src={image.url}
                alt={image.caption || ''}
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
              />
              {image.caption && (
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-4">
                  <p className="text-white text-sm font-semibold">{image.caption}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Lightbox Modal */}
      {selectedImage && (
        <div
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedImage(null)}
        >
          <button
            className="absolute top-4 right-4 text-white hover:text-gray-300 transition-colors z-10"
            onClick={() => setSelectedImage(null)}
          >
            <X className="w-8 h-8" />
          </button>
          <div className="max-w-6xl max-h-[90vh] flex flex-col">
            <img
              src={selectedImage.url}
              alt={selectedImage.caption || ''}
              className="max-w-full max-h-[80vh] object-contain"
            />
            {selectedImage.caption && (
              <p className="text-white text-center mt-4 text-lg">
                {selectedImage.caption}
              </p>
            )}
          </div>
        </div>
      )}
    </>
  )
}

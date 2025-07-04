import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'

export async function POST() {
  try {
    const supabase = createAdminClient()

    const buckets = [
      {
        name: 'logos',
        public: true,
        fileSizeLimit: 2 * 1024 * 1024, // 2MB
        allowedMimeTypes: ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml']
      },
      {
        name: 'brochures',
        public: true,
        fileSizeLimit: 40 * 1024 * 1024, // 40MB
        allowedMimeTypes: ['application/pdf']
      },
      {
        name: 'site-plans',
        public: true,
        fileSizeLimit: 10 * 1024 * 1024, // 10MB
        allowedMimeTypes: ['image/png', 'image/jpeg', 'image/jpg', 'application/pdf']
      },
      {
        name: 'fit-outs',
        public: true,
        fileSizeLimit: 10 * 1024 * 1024, // 10MB
        allowedMimeTypes: ['image/png', 'image/jpeg', 'image/jpg', 'video/mp4', 'video/quicktime']
      }
    ]

    const results = []

    for (const bucket of buckets) {
      const { data, error } = await supabase.storage.createBucket(bucket.name, {
        public: bucket.public,
        fileSizeLimit: bucket.fileSizeLimit,
        allowedMimeTypes: bucket.allowedMimeTypes
      })

      if (error) {
        if (error.message.includes('already exists')) {
          results.push({ bucket: bucket.name, status: 'already exists' })
        } else {
          results.push({ bucket: bucket.name, status: 'error', error: error.message })
        }
      } else {
        results.push({ bucket: bucket.name, status: 'created' })
      }
    }

    return NextResponse.json({
      success: true,
      results
    })

  } catch (error) {
    console.error('Storage setup error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Setup failed'
    }, { status: 500 })
  }
}
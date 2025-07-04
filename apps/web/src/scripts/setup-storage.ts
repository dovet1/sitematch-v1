// Script to create Supabase Storage buckets
import { createAdminClient } from '@/lib/supabase'

async function setupStorageBuckets() {
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

  console.log('Setting up storage buckets...')

  for (const bucket of buckets) {
    console.log(`Creating bucket: ${bucket.name}`)
    
    const { data, error } = await supabase.storage.createBucket(bucket.name, {
      public: bucket.public,
      fileSizeLimit: bucket.fileSizeLimit,
      allowedMimeTypes: bucket.allowedMimeTypes
    })

    if (error) {
      if (error.message.includes('already exists')) {
        console.log(`✓ Bucket ${bucket.name} already exists`)
      } else {
        console.error(`✗ Failed to create bucket ${bucket.name}:`, error.message)
      }
    } else {
      console.log(`✓ Created bucket ${bucket.name}`)
    }
  }

  console.log('Storage bucket setup complete!')
}

// Only run if this script is executed directly
if (require.main === module) {
  setupStorageBuckets().catch(console.error)
}

export { setupStorageBuckets }
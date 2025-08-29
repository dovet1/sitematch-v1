/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    // !! WARN !!
    // Dangerously allow production builds to successfully complete even if
    // your project has TypeScript errors.
    // !! WARN !!
    ignoreBuildErrors: false,
  },
  eslint: {
    // Warning: This allows production builds to successfully complete even if
    // your project has ESLint errors.
    ignoreDuringBuilds: true,
  },
  // Enable standalone output for better deployment
  output: 'standalone',
  // Configure images for Supabase storage and external services
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'nunvbolbcekvtlwuacul.supabase.co',
        port: '',
        pathname: '/storage/v1/object/public/**',
      },
      {
        protocol: 'https',
        hostname: 'logo.clearbit.com',
        port: '',
        pathname: '/**',
      }
    ],
  },
  // Configure for Supabase
  async redirects() {
    return []
  },
  async rewrites() {
    return []
  },
}

module.exports = nextConfig
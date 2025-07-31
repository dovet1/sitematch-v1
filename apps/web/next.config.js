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
  // Increase body size limit for file uploads (40MB for brochures)
  experimental: {
    bodySizeLimit: '50mb',
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
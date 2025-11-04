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
  // Experimental config to handle error pages
  experimental: {
    missingSuspenseWithCSRBailout: false,
  },
  // Custom webpack config to handle styled-jsx SSR issues
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Ignore styled-jsx SSR errors during build
      config.ignoreWarnings = [
        ...(config.ignoreWarnings || []),
        /Cannot read properties of null/,
      ]
    }
    return config
  },
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
        hostname: 'img.logo.dev',
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
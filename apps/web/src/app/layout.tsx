import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { AuthProvider } from '@/contexts/auth-context'
import { Header } from '@/components/header'
import { LeadCaptureProvider } from '@/components/lead-capture-provider'
import { SessionInvalidModal } from '@/components/auth/SessionInvalidModal'
import { Termly } from '@/components/analytics/Termly'
import { Hotjar } from '@/components/analytics/Hotjar'
import { PostHogProvider } from '@/components/analytics/PostHogProvider'
import { Analytics } from '@vercel/analytics/react'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  metadataBase: new URL('https://www.sitematcher.co.uk'),
  title: {
    default: 'SiteMatcher | Find Tenants & Buyers Actively Looking for Sites',
    template: '%s | SiteMatcher'
  },
  description: 'Access 8700+ verified commercial and residential property requirements. Match your sites with qualified companies actively seeking their next location. Trusted by 1400+ property professionals.',
  keywords: ['commercial property', 'property requirements', 'site matching', 'development opportunities', 'land acquisition', 'property professionals', 'real estate', 'UK property', 'site finding', 'commercial real estate'],
  authors: [{ name: 'SiteMatcher' }],
  creator: 'SiteMatcher',
  publisher: 'SiteMatcher',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  viewport: 'width=device-width, initial-scale=1',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: '32x32' },
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon.png', sizes: 'any' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: '/apple-touch-icon.png',
    shortcut: '/favicon.ico',
  },
  manifest: '/site.webmanifest',
  openGraph: {
    type: 'website',
    locale: 'en_GB',
    url: 'https://www.sitematcher.co.uk',
    siteName: 'SiteMatcher',
    title: 'SiteMatcher - Connect Sites with Verified Property Requirements',
    description: 'Access 8000+ verified commercial and residential property requirements. Match your sites with qualified companies actively seeking their next location.',
    images: [
      {
        url: '/map-screenshot.png',
        width: 1200,
        height: 630,
        alt: 'SiteMatcher - Property Requirements Map',
      }
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'SiteMatcher - Connect Sites with Verified Property Requirements',
    description: 'Access 8000+ verified commercial and residential property requirements. Match your sites with qualified companies.',
    images: ['/map-screenshot.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const websiteSchema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "url": "https://www.sitematcher.co.uk/",
    "name": "SiteMatcher",
    "alternateName": "SiteMatcher UK"
  };

  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "SiteMatcher",
    "url": "https://www.sitematcher.co.uk",
    "logo": "https://www.sitematcher.co.uk/logo.svg"
  };

  return (
    <html lang="en">
      <head>
        <Termly />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
        />
      </head>
      <body className={inter.className}>
        <Hotjar />
        <AuthProvider>
          <PostHogProvider>
            <SessionInvalidModal />
            <Header />
            <main>
              {children}
            </main>
            <LeadCaptureProvider />
          </PostHogProvider>
        </AuthProvider>
        <Analytics />
      </body>
    </html>
  )
}
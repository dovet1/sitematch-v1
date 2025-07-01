import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { AuthProvider } from '@/contexts/auth-context'
import { Header } from '@/components/header'
import { LeadCaptureProvider } from '@/components/lead-capture-provider'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'SiteMatch - Commercial Directory',
  description: 'Find and list commercial properties and businesses',
  icons: {
    icon: '/favicon.svg',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <div id="root">
          <AuthProvider>
            <Header />
            {children}
            <LeadCaptureProvider />
          </AuthProvider>
        </div>
      </body>
    </html>
  )
}
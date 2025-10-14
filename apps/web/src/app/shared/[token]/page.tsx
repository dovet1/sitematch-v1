import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { SharedListingPage } from './SharedListingPage';

interface PageProps {
  params: { token: string };
}

// Generate metadata for SEO and social sharing
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  try {
    // Fetch listing data for metadata
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/public/shared/${params.token}`,
      { 
        next: { revalidate: 3600 } // Cache for 1 hour
      }
    );

    if (!response.ok) {
      return {
        title: 'Shared Listing Not Found',
        description: 'The shared property requirement could not be found.',
      };
    }

    const listing = await response.json();
    const companyName = listing.company?.name || 'Unknown Company';
    const title = listing.title || 'Property Requirement';
    const description = listing.description 
      ? `${listing.description.substring(0, 160)}...`
      : `View this commercial property requirement from ${companyName}`;

    const shareUrl = `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/shared/${params.token}`;

    return {
      title: `${title} - ${companyName}`,
      description,
      openGraph: {
        title: `${title} - ${companyName}`,
        description,
        url: shareUrl,
        siteName: 'Property Requirement Directory',
        type: 'website',
        images: [
          {
            url: listing.company?.logo_url || '/og-fallback.jpg',
            width: 1200,
            height: 630,
            alt: `${companyName} logo`,
          },
        ],
      },
      twitter: {
        card: 'summary_large_image',
        title: `${title} - ${companyName}`,
        description,
        images: [listing.company?.logo_url || '/og-fallback.jpg'],
      },
      alternates: {
        canonical: shareUrl,
      },
    };
  } catch (error) {
    console.error('Error generating metadata for shared listing:', error);
    return {
      title: 'Shared Property Requirement',
      description: 'View this property requirement that was shared with you.',
    };
  }
}

export default function Page({ params }: PageProps) {
  return <SharedListingPage token={params.token} />;
}
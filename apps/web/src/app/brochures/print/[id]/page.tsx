'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { BrochureDocument } from '@/components/brochures';
import type { BrochureRow } from '@/types/brochure';

export default function PrintBrochurePage() {
  const params = useParams();
  const id = params?.id as string;
  const [brochure, setBrochure] = useState<BrochureRow | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const fetchBrochure = async () => {
      try {
        const response = await fetch(`/api/brochures/${id}`);
        if (!response.ok) throw new Error();
        const data = await response.json();
        setBrochure(data);
      } catch {
        setError(true);
      }
    };
    fetchBrochure();
  }, [id]);

  useEffect(() => {
    if (brochure) {
      // Small delay to ensure content is rendered
      const timer = setTimeout(() => {
        window.print();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [brochure]);

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-red-600">Brochure not found</p>
      </div>
    );
  }

  if (!brochure) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  return (
    <>
      <style>{`
        /* Hide site navigation - target the sticky header */
        header.sticky,
        header[class*="sticky"],
        header[class*="top-0"] {
          display: none !important;
        }
        main {
          padding: 0 !important;
          margin: 0 !important;
        }

        @media print {
          @page {
            size: A4;
            margin: 0;
          }
          body {
            margin: 0;
            padding: 0;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          header.sticky,
          header[class*="sticky"],
          header[class*="top-0"] {
            display: none !important;
          }
        }

        .print-container {
          margin: 0;
          padding: 0;
        }
      `}</style>
      <div className="print-container">
        <BrochureDocument brochure={brochure} />
      </div>
    </>
  );
}

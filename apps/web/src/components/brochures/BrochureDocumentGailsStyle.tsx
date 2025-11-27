'use client';

import type { BrochureRow } from '@/types/brochure';
import type { LocationSelection } from '@/types/locations';

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

function generateStaticMapUrl(
  locations: (string | LocationSelection)[],
  brandColor: string
): string {
  const validLocations = locations.filter(
    (loc): loc is LocationSelection =>
      typeof loc !== 'string' && Array.isArray(loc.coordinates) && loc.coordinates.length === 2
  );

  if (!validLocations.length || !MAPBOX_TOKEN) return '';

  const pinColor = brandColor.replace('#', '');

  const markers = validLocations
    .map((loc) => {
      const [lng, lat] = loc.coordinates;
      return `pin-s+${pinColor}(${lng},${lat})`;
    })
    .join(',');

  return `https://api.mapbox.com/styles/v1/mapbox/light-v11/static/${markers}/auto/800x300?access_token=${MAPBOX_TOKEN}&padding=50`;
}

interface BrochureDocumentProps {
  brochure: BrochureRow;
}

/**
 * Gail's Style template - inspired by Gail's brochure design.
 * This component renders a single A4 page designed for print/PDF export.
 */
export function BrochureDocumentGailsStyle({ brochure }: BrochureDocumentProps) {
  const brandColor = brochure.brand_color || '#dc2626';

  // Format size range
  const sizeRange = (() => {
    if (brochure.sqft_min && brochure.sqft_max) {
      return `${brochure.sqft_min.toLocaleString()} - ${brochure.sqft_max.toLocaleString()} sqft`;
    }
    if (brochure.sqft_min) {
      return `${brochure.sqft_min.toLocaleString()}+ sqft`;
    }
    if (brochure.sqft_max) {
      return `Up to ${brochure.sqft_max.toLocaleString()} sqft`;
    }
    return null;
  })();

  return (
    <div
      className="bg-white"
      style={{
        width: '210mm',
        height: '297mm',
        padding: 0,
        margin: '0 auto',
        fontFamily: 'Inter, system-ui, sans-serif',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        boxSizing: 'border-box',
      }}
    >
      {/* Main Content Area */}
      <div className="flex flex-1">
        {/* Left Column - Store Images */}
        <div className="w-1/2 flex flex-col gap-0">
          {brochure.store_images && brochure.store_images.length > 0 ? (
            brochure.store_images.slice(0, 3).map((image, index) => (
              <div
                key={index}
                className="flex-1"
                style={{
                  minHeight: 0,
                  overflow: 'hidden'
                }}
              >
                <img
                  src={image}
                  alt={`${brochure.company_name} store ${index + 1}`}
                  className="w-full h-full object-cover"
                />
              </div>
            ))
          ) : (
            <div className="flex-1 bg-gray-100" />
          )}
        </div>

        {/* Right Column - Content */}
        <div className="w-1/2 flex flex-col p-12">
          {/* Header */}
          <div className="mb-8">
            <h1
              className="text-5xl font-bold tracking-tight mb-2"
              style={{
                color: brandColor,
                fontWeight: 300,
                letterSpacing: '0.05em'
              }}
            >
              PROPERTY<br />REQUIREMENTS
            </h1>
          </div>

          {/* Company About */}
          {brochure.company_about && (
            <div className="mb-8">
              <p className="text-sm text-gray-700 leading-relaxed">
                {brochure.company_about}
              </p>
            </div>
          )}

          {/* OUR REQUIREMENTS Section */}
          <div className="mb-8">
            <h2 className="text-xs font-bold tracking-widest uppercase mb-3 text-gray-900">
              OUR REQUIREMENTS
            </h2>
            <div className="space-y-2 text-sm">
              {/* Size */}
              {sizeRange && (
                <div className="flex items-start">
                  <span className="mr-2">•</span>
                  <span className="text-gray-900">{sizeRange} standard on ground floor but other configurations considered</span>
                </div>
              )}

              {/* Use Class */}
              {brochure.use_class && (
                <div className="flex items-start">
                  <span className="mr-2">•</span>
                  <span className="text-gray-900">{brochure.use_class_label || formatUseClass(brochure.use_class)} Use Class</span>
                </div>
              )}

              {/* Requirements Summary */}
              <div className="flex items-start">
                <span className="mr-2">•</span>
                <span className="text-gray-900">{brochure.requirements_summary}</span>
              </div>

              {/* Additional Notes as bullet points */}
              {brochure.additional_notes && (
                brochure.additional_notes.split('\n').map((note, idx) => (
                  note.trim() && (
                    <div key={idx} className="flex items-start">
                      <span className="mr-2">•</span>
                      <span className="text-gray-900">{note.trim()}</span>
                    </div>
                  )
                ))
              )}
            </div>
          </div>

          {/* Contact Section */}
          <div
            className="mt-auto p-6 text-white"
            style={{ backgroundColor: brandColor }}
          >
            {/* Primary Contact */}
            <div className="mb-6">
              <h3 className="text-lg font-bold uppercase tracking-wider mb-1">
                {brochure.agent_name}
              </h3>
              <div className="text-sm space-y-0.5">
                <div>{brochure.agent_phone || brochure.agent_email.split('@')[0]}</div>
                <div className="text-xs">{brochure.agent_email}</div>
              </div>
            </div>

            {/* Areas Covered */}
            {brochure.target_locations && brochure.target_locations.length > 0 && (
              <div>
                <h4 className="text-xs font-bold uppercase tracking-widest mb-2">
                  AREAS COVERED
                </h4>
                <p className="text-sm leading-relaxed">
                  {brochure.target_locations
                    .map(loc => typeof loc === 'string' ? loc : (loc.formatted_address || loc.place_name))
                    .join(', ')}
                </p>
              </div>
            )}

            {/* Agent Logo */}
            {brochure.agent_logo_url && brochure.agent_logo_source !== 'none' && (
              <div className="mt-6 pt-6 border-t border-white/20">
                <img
                  src={brochure.agent_logo_url}
                  alt={brochure.agent_company}
                  className="h-8 object-contain brightness-0 invert"
                  style={{ maxWidth: '120px' }}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer - Company Logo */}
      <div
        className="px-12 py-6 flex items-center justify-center"
        style={{
          backgroundColor: 'white',
          borderTop: `1px solid ${brandColor}20`
        }}
      >
        {brochure.company_logo_url && brochure.company_logo_source !== 'none' ? (
          <img
            src={brochure.company_logo_url}
            alt={brochure.company_name}
            className="h-16 object-contain"
            style={{ maxWidth: '240px' }}
          />
        ) : (
          <h2
            className="text-3xl font-bold tracking-widest"
            style={{
              color: brandColor,
              fontWeight: 300,
              letterSpacing: '0.15em'
            }}
          >
            {brochure.company_name}
          </h2>
        )}
      </div>
    </div>
  );
}

function formatUseClass(useClass: string): string {
  const labels: Record<string, string> = {
    B1: 'B1 - Business',
    B2: 'B2 - General Industrial',
    B8: 'B8 - Storage & Distribution',
    E: 'E - Commercial & Service',
    F1: 'F1 - Learning',
    F2: 'F2 - Local Community',
    C1: 'C1 - Hotels',
    C2: 'C2 - Residential Institutions',
    C3: 'C3 - Dwellinghouses',
    C4: 'C4 - HMO',
    sui_generis: 'Sui Generis',
    mixed: 'Mixed Use',
  };
  return labels[useClass] || useClass;
}

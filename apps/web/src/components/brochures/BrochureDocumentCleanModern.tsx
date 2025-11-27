'use client';

import type { BrochureRow } from '@/types/brochure';
import type { LocationSelection } from '@/types/locations';

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

function generateStaticMapUrl(
  locations: (string | LocationSelection)[],
  brandColor: string
): string {
  // Filter to only LocationSelection objects with coordinates
  const validLocations = locations.filter(
    (loc): loc is LocationSelection =>
      typeof loc !== 'string' && Array.isArray(loc.coordinates) && loc.coordinates.length === 2
  );

  if (!validLocations.length || !MAPBOX_TOKEN) return '';

  // Convert brand color to hex without #
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
 * Clean Modern template - Print-optimized brochure document for PDF generation.
 * This component renders a single A4 page designed for print/PDF export.
 */
export function BrochureDocumentCleanModern({ brochure }: BrochureDocumentProps) {
  const brandColor = brochure.brand_color || '#7c3aed';

  // Generate a lighter tint for gradients and accents
  const brandColorLight = `${brandColor}15`;
  const brandColorMedium = `${brandColor}30`;

  // Format size range
  const sizeRange = (() => {
    if (brochure.sqft_min && brochure.sqft_max) {
      return `${brochure.sqft_min.toLocaleString()} - ${brochure.sqft_max.toLocaleString()} sq ft`;
    }
    if (brochure.sqft_min) {
      return `From ${brochure.sqft_min.toLocaleString()} sq ft`;
    }
    if (brochure.sqft_max) {
      return `Up to ${brochure.sqft_max.toLocaleString()} sq ft`;
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
      {/* Header Section - with gradient overlay for depth */}
      <header
        className="text-white p-8 relative"
        style={{
          background: `linear-gradient(135deg, ${brandColor} 0%, ${brandColor}dd 100%)`,
          flexShrink: 0,
        }}
      >
        {/* Subtle pattern overlay */}
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: `radial-gradient(circle at 20% 50%, white 1px, transparent 1px)`,
            backgroundSize: '24px 24px',
          }}
        />

        <div className="relative z-10">
          <div className="flex items-start justify-between mb-4">
            {/* Company Logo */}
            {brochure.company_logo_url && brochure.company_logo_source !== 'none' ? (
              <div className="bg-white rounded-xl p-3 shadow-lg">
                <img
                  src={brochure.company_logo_url}
                  alt={brochure.company_name}
                  className="h-12 object-contain"
                  style={{ maxWidth: '160px' }}
                />
              </div>
            ) : (
              <div className="h-12" />
            )}

            {/* Badge */}
            <div
              className="px-4 py-2 rounded-full text-xs font-bold tracking-widest uppercase"
              style={{ backgroundColor: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(4px)' }}
            >
              Site Requirement
            </div>
          </div>

          {/* Company Name */}
          <h1 className="text-4xl font-bold tracking-tight">{brochure.company_name}</h1>

          {/* Company About */}
          {brochure.company_about && (
            <p className="mt-2 text-sm" style={{ color: 'rgba(255,255,255,0.8)' }}>
              {brochure.company_about}
            </p>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="px-8 py-6" style={{ flex: 1, overflow: 'hidden' }}>
        {/* Requirements Summary - with accent border */}
        <section className="mb-5">
          <div
            className="pl-4 py-1"
            style={{ borderLeft: `3px solid ${brandColor}` }}
          >
            <h2
              className="text-sm font-bold uppercase tracking-wide mb-2"
              style={{ color: brandColor }}
            >
              Requirements
            </h2>
            <p className="text-gray-700 leading-relaxed">
              {brochure.requirements_summary}
            </p>
          </div>
        </section>

        {/* Key Details Grid - refined cards */}
        <section className="mb-5">
          <div className="grid grid-cols-3 gap-4">
            {/* Size */}
            {sizeRange && (
              <DetailCard
                label="Size"
                value={sizeRange}
                brandColor={brandColor}
                icon="📐"
              />
            )}

            {/* Use Class */}
            {brochure.use_class && (
              <DetailCard
                label="Use Class"
                value={brochure.use_class_label || formatUseClass(brochure.use_class)}
                brandColor={brandColor}
                icon="🏢"
              />
            )}

            {/* Sector */}
            {brochure.sector && (
              <DetailCard
                label="Sector"
                value={brochure.sector_label || formatSector(brochure.sector)}
                brandColor={brandColor}
                icon="🏷️"
              />
            )}
          </div>
        </section>

        {/* Target Locations with Map */}
        {brochure.target_locations && brochure.target_locations.length > 0 && (
          <section className="mb-5">
            <h2
              className="text-sm font-bold uppercase tracking-wide mb-3"
              style={{ color: brandColor }}
            >
              Target Locations
            </h2>
            <div className="flex gap-4">
              {/* Location Pills */}
              <div className="flex flex-wrap gap-2 content-start" style={{ flex: '0 0 40%' }}>
                {brochure.target_locations.map((location, index) => (
                  <span
                    key={typeof location === 'string' ? index : location.id}
                    className="px-3 py-1.5 rounded-lg text-white text-xs font-medium shadow-sm"
                    style={{ backgroundColor: brandColor }}
                  >
                    {typeof location === 'string' ? location : (location.formatted_address || location.place_name)}
                  </span>
                ))}
              </div>
              {/* Static Map */}
              {generateStaticMapUrl(brochure.target_locations, brandColor) && (
                <div
                  className="rounded-xl overflow-hidden shadow-md"
                  style={{ flex: '1 1 60%' }}
                >
                  <img
                    src={generateStaticMapUrl(brochure.target_locations, brandColor)}
                    alt="Map showing target locations"
                    className="w-full h-28 object-cover"
                  />
                </div>
              )}
            </div>
          </section>
        )}

        {/* Store Images */}
        {brochure.store_images && brochure.store_images.length > 0 && (
          <section className="mb-5">
            <h2
              className="text-sm font-bold uppercase tracking-wide mb-3"
              style={{ color: brandColor }}
            >
              Our Stores
            </h2>
            <div className="grid grid-cols-3 gap-3">
              {brochure.store_images.slice(0, 3).map((image, index) => (
                <div
                  key={index}
                  className="aspect-video rounded-xl overflow-hidden shadow-md"
                >
                  <img
                    src={image}
                    alt={`Store ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Additional Notes */}
        {brochure.additional_notes && (
          <section className="mb-4">
            <h2
              className="text-sm font-bold uppercase tracking-wide mb-2"
              style={{ color: brandColor }}
            >
              Additional Information
            </h2>
            <p className="text-gray-600 text-sm leading-relaxed">{brochure.additional_notes}</p>
          </section>
        )}
      </main>

      {/* Footer - Agent Details - with brand accent */}
      <footer
        className="px-8 py-5"
        style={{
          flexShrink: 0,
          background: `linear-gradient(135deg, ${brandColor}08 0%, ${brandColor}15 100%)`,
          borderTop: `2px solid ${brandColor}20`,
        }}
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Contact</p>
            <h3 className="text-lg font-bold text-gray-900">
              {brochure.agent_name}
            </h3>
            <p className="text-sm font-medium" style={{ color: brandColor }}>{brochure.agent_company}</p>
            <div className="flex gap-4 mt-2 text-sm text-gray-600">
              <span>{brochure.agent_email}</span>
              {brochure.agent_phone && (
                <span className="flex items-center gap-1">
                  <span>|</span>
                  {brochure.agent_phone}
                </span>
              )}
            </div>
          </div>

          {/* Agent Logo */}
          {brochure.agent_logo_url && brochure.agent_logo_source !== 'none' && (
            <div className="bg-white rounded-lg p-3 shadow-sm">
              <img
                src={brochure.agent_logo_url}
                alt={brochure.agent_company}
                className="h-10 object-contain"
                style={{ maxWidth: '120px' }}
              />
            </div>
          )}
        </div>
      </footer>
    </div>
  );
}

interface DetailCardProps {
  label: string;
  value: string;
  brandColor: string;
  icon?: string;
}

function DetailCard({ label, value, brandColor, icon }: DetailCardProps) {
  return (
    <div
      className="rounded-xl p-4 relative overflow-hidden"
      style={{
        background: `linear-gradient(135deg, ${brandColor}08 0%, ${brandColor}15 100%)`,
        border: `1px solid ${brandColor}20`,
      }}
    >
      {icon && (
        <span className="text-lg mb-2 block">{icon}</span>
      )}
      <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">{label}</p>
      <p className="text-base font-bold" style={{ color: brandColor }}>
        {value}
      </p>
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

function formatSector(sector: string): string {
  const labels: Record<string, string> = {
    retail: 'Retail',
    office: 'Office',
    industrial: 'Industrial',
    logistics: 'Logistics & Distribution',
    warehouse: 'Warehouse',
    food_beverage: 'Food & Beverage',
    healthcare: 'Healthcare',
    education: 'Education',
    leisure: 'Leisure & Entertainment',
    hospitality: 'Hospitality',
    residential: 'Residential',
    mixed_use: 'Mixed Use',
  };
  return labels[sector] || sector;
}

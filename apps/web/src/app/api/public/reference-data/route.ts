import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient();
    
    // Fetch sectors
    const { data: sectors, error: sectorsError } = await supabase
      .from('sectors')
      .select('id, name, description')
      .order('name');
      
    if (sectorsError) {
      console.error('Error fetching sectors:', sectorsError);
      return NextResponse.json(
        { error: 'Failed to fetch sectors' },
        { status: 500 }
      );
    }
    
    // Fetch use classes
    const { data: useClasses, error: useClassesError } = await supabase
      .from('use_classes')
      .select('id, code, name, description')
      .order('code');
      
    if (useClassesError) {
      console.error('Error fetching use classes:', useClassesError);
      return NextResponse.json(
        { error: 'Failed to fetch use classes' },
        { status: 500 }
      );
    }
    
    // First, get listing IDs that have approved versions (same logic as public listings API)
    const { data: approvedVersions, error: versionError } = await supabase
      .from('listing_versions')
      .select('listing_id')
      .eq('status', 'approved');
    
    if (versionError) {
      console.error('Error fetching approved versions:', versionError);
      return NextResponse.json(
        { error: 'Failed to fetch listings', details: versionError.message },
        { status: 500 }
      );
    }
    
    const approvedListingIds = approvedVersions?.map(v => v.listing_id) || [];
    
    // Get counts for each sector and use class through junction tables
    // First get sector counts from junction table
    const { data: sectorJunctions, error: sectorJunctionsError } = await supabase
      .from('listing_sectors')
      .select('sector_id, listing_id')
      .in('listing_id', approvedListingIds);
      
    // Get use class counts from junction table
    const { data: useClassJunctions, error: useClassJunctionsError } = await supabase
      .from('listing_use_classes')
      .select('use_class_id, listing_id')
      .in('listing_id', approvedListingIds);
      
    if (sectorJunctionsError) {
      console.error('Error fetching sector junction counts:', sectorJunctionsError);
    }
    
    if (useClassJunctionsError) {
      console.error('Error fetching use class junction counts:', useClassJunctionsError);
    }
    
    // Calculate counts from junction tables
    const sectorCounts = sectorJunctions?.reduce((acc, junction) => {
      if (junction.sector_id) {
        acc[junction.sector_id] = (acc[junction.sector_id] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>) || {};
    
    const useClassCounts = useClassJunctions?.reduce((acc, junction) => {
      if (junction.use_class_id) {
        acc[junction.use_class_id] = (acc[junction.use_class_id] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>) || {};
    
    // Note: Legacy columns (sector_id, use_class_id) in the main listings table
    // are no longer used for counting. All sector/use_class relationships are
    // now handled exclusively through the junction tables (listing_sectors, listing_use_classes)
    // to support many-to-many relationships. The junction tables contain the migrated data
    // and are the single source of truth.
    
    // Format response
    const response = {
      sectors: sectors.map(sector => ({
        id: sector.id,
        value: sector.name,
        label: sector.name.charAt(0).toUpperCase() + sector.name.slice(1).replace(/_/g, ' '),
        description: sector.description,
        count: sectorCounts[sector.id] || 0
      })),
      useClasses: useClasses.map(uc => ({
        id: uc.id,
        value: uc.name, // Use name for filtering
        code: uc.code,
        label: `${uc.code} - ${uc.name}`,
        description: uc.description,
        count: useClassCounts[uc.id] || 0
      }))
    };
    
    return NextResponse.json(response);
    
  } catch (error) {
    console.error('Unexpected error in reference data API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

interface CompanySuggestion {
  id: string;
  name: string;
  description?: string;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || '';
    const limit = Math.min(Number(searchParams.get('limit')) || 8, 20);

    if (query.length < 2) {
      return NextResponse.json({
        results: [],
        total: 0
      });
    }

    try {
      // Search the listings table for company names
      const supabase = createServerClient();

      const { data: listings, error } = await supabase
        .from('listings')
        .select('company_name')
        .not('company_name', 'is', null)
        .ilike('company_name', `%${query.trim()}%`)
        .limit(limit * 3); // Get more results since we'll deduplicate

      if (error) {
        throw error;
      }

      // Extract unique company names and transform to CompanySuggestion format
      const uniqueCompanies = new Set<string>();
      const suggestions: CompanySuggestion[] = [];

      (listings || []).forEach((listing: { company_name: string }, index: number) => {
        if (listing.company_name && !uniqueCompanies.has(listing.company_name)) {
          uniqueCompanies.add(listing.company_name);
          suggestions.push({
            id: `company-${index}`,
            name: listing.company_name,
            description: 'Company'
          });
        }
      });

      // Limit to the requested number of unique suggestions
      const limitedSuggestions = suggestions.slice(0, limit);

      // If no database results, fall back to mock data
      if (limitedSuggestions.length === 0) {
        const mockCompanies: CompanySuggestion[] = [
          { id: '1', name: 'Savills', description: 'Real Estate Services' },
          { id: '2', name: 'CBRE', description: 'Commercial Real Estate Services' },
          { id: '3', name: 'JLL', description: 'Jones Lang LaSalle' },
          { id: '4', name: 'Cushman & Wakefield', description: 'Commercial Real Estate Services' },
          { id: '5', name: 'Knight Frank', description: 'Residential & Commercial Property' },
          { id: '6', name: 'Colliers', description: 'Commercial Real Estate Services' },
          { id: '7', name: 'Lambert Smith Hampton', description: 'Property Consultancy' },
          { id: '8', name: 'Avison Young', description: 'Commercial Real Estate Advisory' },
        ];

        const filteredCompanies = mockCompanies.filter(company =>
          company.name.toLowerCase().includes(query.toLowerCase()) ||
          (company.description && company.description.toLowerCase().includes(query.toLowerCase()))
        ).slice(0, limit);

        return NextResponse.json({
          results: filteredCompanies,
          total: filteredCompanies.length,
          query,
          fallback: true
        });
      }

      return NextResponse.json({
        results: limitedSuggestions,
        total: limitedSuggestions.length,
        query
      });

    } catch (dbError) {
      console.error('Database query error:', dbError);

      // Fallback to mock company data if database fails
      const mockCompanies: CompanySuggestion[] = [
        { id: '1', name: 'Savills', description: 'Real Estate Services' },
        { id: '2', name: 'CBRE', description: 'Commercial Real Estate Services' },
        { id: '3', name: 'JLL', description: 'Jones Lang LaSalle' },
        { id: '4', name: 'Cushman & Wakefield', description: 'Commercial Real Estate Services' },
        { id: '5', name: 'Knight Frank', description: 'Residential & Commercial Property' },
        { id: '6', name: 'Colliers', description: 'Commercial Real Estate Services' },
        { id: '7', name: 'Lambert Smith Hampton', description: 'Property Consultancy' },
        { id: '8', name: 'Avison Young', description: 'Commercial Real Estate Advisory' },
      ];

      const filteredCompanies = mockCompanies.filter(company =>
        company.name.toLowerCase().includes(query.toLowerCase()) ||
        (company.description && company.description.toLowerCase().includes(query.toLowerCase()))
      ).slice(0, limit);

      return NextResponse.json({
        results: filteredCompanies,
        total: filteredCompanies.length,
        query,
        fallback: true
      });
    }

  } catch (error) {
    console.error('Unexpected error in company suggestions API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
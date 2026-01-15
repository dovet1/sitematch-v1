import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// POST /api/brochures/[id]/export - Generate PDF for a brochure
// Note: In production, this would use Playwright to render the print page and generate PDF
// For MVP, we return the print URL that can be used with browser print or a PDF service
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: 'Brochure ID is required' },
        { status: 400 }
      );
    }

    const supabase = await createServerClient();

    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Verify the brochure exists and belongs to the user
    const { data: brochure, error } = await supabase
      .from('brochures')
      .select('id, company_name')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (error || !brochure) {
      return NextResponse.json(
        { error: 'Brochure not found' },
        { status: 404 }
      );
    }

    // Generate the print URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const printUrl = `${baseUrl}/brochures/print/${id}`;

    // For MVP, return the print URL
    // In V2, this would trigger Playwright to generate the actual PDF
    return NextResponse.json({
      success: true,
      printUrl,
      message: 'Use the print URL to generate PDF via browser print or Playwright service',
      // Future: pdfUrl would be returned here after Playwright generation
    });
  } catch (error) {
    console.error('Unexpected error in POST /api/brochures/[id]/export:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

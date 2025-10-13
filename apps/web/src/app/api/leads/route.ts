import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { subscribeToNewsletter } from '@/lib/resend';
import { LeadCaptureFormData, LeadCaptureResponse } from '@/types/leads';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body: LeadCaptureFormData = await request.json();
    const { email, persona } = body;

    // Validate input
    if (!email || !persona) {
      return NextResponse.json(
        { success: false, error: 'Email and persona are required' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { success: false, error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Validate persona
    const validPersonas = ['agent', 'investor', 'landlord', 'vendor'];
    if (!validPersonas.includes(persona)) {
      return NextResponse.json(
        { success: false, error: 'Invalid persona' },
        { status: 400 }
      );
    }

    // Create Supabase client with service role to bypass RLS for lead insertion
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Insert into leads table
    const { data, error } = await supabase
      .from('leads')
      .insert([{ email, persona }])
      .select()
      .single();

    if (error) {
      // Handle duplicate email error gracefully
      if (error.code === '23505') { // Unique constraint violation
        return NextResponse.json(
          { success: false, error: 'Email already registered' },
          { status: 409 }
        );
      }
      
      console.error('Database error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to save lead' },
        { status: 500 }
      );
    }

    // Attempt newsletter subscription (don't fail if this fails)
    const newsletterResult = await subscribeToNewsletter(email, persona);
    if (!newsletterResult.success) {
      console.warn('Newsletter subscription failed:', newsletterResult.error);
      // Continue anyway - the lead is still captured
    }

    const response: LeadCaptureResponse = {
      success: true,
      message: 'Thank you for your interest! We\'ll keep you updated with relevant opportunities.',
    };

    return NextResponse.json(response, { status: 201 });

  } catch (error) {
    console.error('Lead capture error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
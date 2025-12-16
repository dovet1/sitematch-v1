import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { readFile } from 'fs/promises';
import path from 'path';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, company, description, geojsonFile, metadataFile } = body;

    if (!name || !company || !geojsonFile) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: 'Supabase configuration missing' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Navigate to monorepo root (process.cwd() is apps/web)
    const projectRoot = path.join(process.cwd(), '..', '..');
    const uploadDir = path.join(projectRoot, 'store-dwg-files');
    const geojsonPath = path.join(uploadDir, geojsonFile);
    const geojsonContent = await readFile(geojsonPath, 'utf-8');
    const geojson = JSON.parse(geojsonContent);

    // Read metadata file if provided
    let metadata = null;
    if (metadataFile) {
      try {
        const metadataPath = path.join(uploadDir, metadataFile);
        const metadataContent = await readFile(metadataPath, 'utf-8');
        metadata = JSON.parse(metadataContent);
      } catch (e) {
        console.warn('Could not read metadata file:', e);
      }
    }

    // Get next display order
    const { data: existingShapes } = await supabase
      .from('store_shapes')
      .select('display_order')
      .order('display_order', { ascending: false })
      .limit(1);

    const nextOrder = existingShapes && existingShapes.length > 0
      ? (existingShapes[0].display_order || 0) + 10
      : 10;

    // Insert into database
    const insertData = {
      name,
      company_name: company,
      description: description || null,
      geojson,
      metadata: metadata || null,
      is_active: true,
      display_order: nextOrder,
    };

    const { data, error } = await supabase
      .from('store_shapes')
      .insert([insertData])
      .select();

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { error: error.message || 'Database insertion failed' },
        { status: 500 }
      );
    }

    if (!data || data.length === 0) {
      return NextResponse.json(
        { error: 'No data returned from insert' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      shape: data[0],
    });

  } catch (error: any) {
    console.error('Insert error:', error);
    return NextResponse.json(
      { error: error.message || 'Insert failed' },
      { status: 500 }
    );
  }
}

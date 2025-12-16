import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { readFile } from 'fs/promises';

const execAsync = promisify(exec);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { filename } = body;

    if (!filename) {
      return NextResponse.json(
        { error: 'Missing filename' },
        { status: 400 }
      );
    }

    // Navigate to monorepo root (process.cwd() is apps/web)
    const projectRoot = path.join(process.cwd(), '..', '..');
    const uploadDir = path.join(projectRoot, 'store-dwg-files');
    const inputPath = path.join(uploadDir, filename);
    const baseName = filename.replace('.raw.geojson', '');
    const outputFile = `${baseName}.optimized.geojson`;
    const outputPath = path.join(uploadDir, outputFile);
    const scriptPath = path.join(projectRoot, 'scripts', 'optimize-store-shape.js');

    // Run optimization script
    const command = `node "${scriptPath}" "${inputPath}" "${outputPath}"`;

    console.log('Running optimization:', command);
    const { stdout, stderr } = await execAsync(command, {
      maxBuffer: 50 * 1024 * 1024, // 50MB buffer
    });

    // Parse output to extract stats
    const sizeMatch = stdout.match(/Reduction: ([\d.]+)%/);
    const reductionPercent = sizeMatch ? parseFloat(sizeMatch[1]) : 0;

    // Read metadata file
    const metadataFile = `${baseName}.optimized.metadata.json`;
    const metadataPath = path.join(uploadDir, metadataFile);
    let metadata = null;

    try {
      const metadataContent = await readFile(metadataPath, 'utf-8');
      metadata = JSON.parse(metadataContent);
    } catch (e) {
      console.warn('Could not read metadata file:', e);
    }

    return NextResponse.json({
      success: true,
      optimizedFile: outputFile,
      metadataFile,
      reductionPercent,
      featureCount: metadata?.optimized_feature_count || 0,
      output: stdout,
    });

  } catch (error: any) {
    console.error('Optimization error:', error);
    return NextResponse.json(
      { error: error.message || 'Optimization failed', details: error.stderr },
      { status: 500 }
    );
  }
}

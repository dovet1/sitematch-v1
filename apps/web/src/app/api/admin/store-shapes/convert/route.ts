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
    const dxfPath = path.join(uploadDir, filename);
    const scriptPath = path.join(projectRoot, 'scripts', 'convert-dwg-to-geojson.py');

    // Run conversion script (automatically uses real-world dimensions from DXF)
    // Use full path to python3 to ensure correct environment
    const command = `/usr/bin/python3 "${scriptPath}" "${dxfPath}"`;

    console.log('Running conversion:', command);
    console.log('DXF path exists:', require('fs').existsSync(dxfPath));
    console.log('Script path exists:', require('fs').existsSync(scriptPath));

    const { stdout, stderr } = await execAsync(command, {
      maxBuffer: 50 * 1024 * 1024, // 50MB buffer for large outputs
    });

    console.log('Conversion stdout length:', stdout.length);
    console.log('Conversion stderr length:', stderr.length);
    if (stderr) console.log('Conversion stderr:', stderr);

    // Parse output to extract filenames
    const baseName = filename.replace('.dxf', '');
    const geojsonFile = `${baseName}.raw.geojson`;
    const metadataFile = `${baseName}.raw.metadata.json`;

    // Read metadata to get feature count
    const metadataPath = path.join(uploadDir, metadataFile);
    console.log('Reading metadata from:', metadataPath);
    const metadataContent = await readFile(metadataPath, 'utf-8');
    const metadata = JSON.parse(metadataContent);
    console.log('Metadata parsed successfully:', metadata.geojson_feature_count, 'features');

    return NextResponse.json({
      success: true,
      geojsonFile,
      metadataFile,
      featureCount: metadata.geojson_feature_count || 0,
      scaleFactor: metadata.scale_factor,
      sourceUnits: metadata.source_units,
      output: stdout,
    });

  } catch (error: any) {
    console.error('Conversion error:', error);

    // Provide detailed error information
    const errorDetails = {
      message: error.message || 'Conversion failed',
      stderr: error.stderr || '',
      stdout: error.stdout || '',
      code: error.code,
      killed: error.killed,
    };

    return NextResponse.json(
      { error: errorDetails.message, details: errorDetails },
      { status: 500 }
    );
  }
}

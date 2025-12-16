#!/usr/bin/env python3
"""
Insert store shape into Supabase database with metadata support
This script reads the optimized GeoJSON and metadata, then inserts via the Supabase API

Usage:
    python3 scripts/insert-store-shape-with-metadata.py \
        store-dwg-files/lidl_site.optimized.geojson \
        --name "Lidl Site Plan" \
        --company "Lidl" \
        --description "Full site plan with parking and landscaping" \
        --metadata store-dwg-files/lidl_site.optimized.metadata.json
"""

import argparse
import json
import os
import sys
from pathlib import Path

# Add parent directory to path to access .env.local
parent_dir = Path(__file__).parent.parent
env_file = parent_dir / 'apps' / 'web' / '.env.local'

# Read environment variables
env_vars = {}
if env_file.exists():
    with open(env_file, 'r') as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, value = line.split('=', 1)
                # Remove quotes if present
                value = value.strip('"').strip("'")
                env_vars[key] = value

supabase_url = env_vars.get('NEXT_PUBLIC_SUPABASE_URL')
service_key = env_vars.get('SUPABASE_SERVICE_ROLE_KEY')

if not supabase_url or not service_key:
    print("Error: Missing required environment variables in apps/web/.env.local")
    print(f"NEXT_PUBLIC_SUPABASE_URL: {'✓' if supabase_url else '✗'}")
    print(f"SUPABASE_SERVICE_ROLE_KEY: {'✓' if service_key else '✗'}")
    sys.exit(1)

# Try to import required libraries
try:
    import requests
except ImportError:
    print("Installing requests library...")
    os.system(f"{sys.executable} -m pip install requests")
    import requests


def main():
    parser = argparse.ArgumentParser(
        description='Insert store shape with metadata into Supabase',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Basic usage
  python3 scripts/insert-store-shape-with-metadata.py \\
    store-dwg-files/lidl_site.optimized.geojson \\
    --name "Lidl Site Plan" \\
    --company "Lidl"

  # With metadata
  python3 scripts/insert-store-shape-with-metadata.py \\
    store-dwg-files/lidl_site.optimized.geojson \\
    --name "Lidl Site Plan" \\
    --company "Lidl" \\
    --metadata store-dwg-files/lidl_site.optimized.metadata.json

  # With all options
  python3 scripts/insert-store-shape-with-metadata.py \\
    store-dwg-files/lidl_site.optimized.geojson \\
    --name "Lidl Store #123" \\
    --company "Lidl" \\
    --description "Complete site plan including parking" \\
    --metadata store-dwg-files/lidl_site.optimized.metadata.json \\
    --order 10
        """
    )

    parser.add_argument('geojson', type=Path, help='Path to optimized GeoJSON file')
    parser.add_argument('--name', required=True, help='Display name for the store shape')
    parser.add_argument('--company', required=True, help='Company name (e.g., "Lidl", "Tesco")')
    parser.add_argument('--description', help='Optional description')
    parser.add_argument('--metadata', type=Path, help='Path to metadata JSON file')
    parser.add_argument('--order', type=int, default=100, help='Display order (default: 100)')
    parser.add_argument('--inactive', action='store_true', help='Mark as inactive (hidden)')

    args = parser.parse_args()

    # Validate GeoJSON file
    if not args.geojson.exists():
        print(f"Error: GeoJSON file not found: {args.geojson}")
        sys.exit(1)

    # Read GeoJSON
    print(f"Reading GeoJSON from {args.geojson}")
    with open(args.geojson, 'r') as f:
        geojson_data = json.load(f)

    print(f"  Type: {geojson_data.get('type')}")
    if geojson_data.get('type') == 'FeatureCollection':
        print(f"  Features: {len(geojson_data.get('features', []))}")

    # Read metadata if provided
    metadata = None
    if args.metadata:
        if not args.metadata.exists():
            print(f"Warning: Metadata file not found: {args.metadata}")
            print("Continuing without metadata...")
        else:
            print(f"\nReading metadata from {args.metadata}")
            with open(args.metadata, 'r') as f:
                metadata = json.load(f)

            # Display key metadata
            if metadata:
                print(f"  Source units: {metadata.get('source_units', 'unknown')}")
                print(f"  Scale factor: {metadata.get('scale_factor', 'unknown')}")
                if metadata.get('bbox'):
                    bbox = metadata['bbox']
                    print(f"  Dimensions: {bbox.get('width_meters', 0):.1f}m × {bbox.get('height_meters', 0):.1f}m")
                print(f"  Conversion method: {metadata.get('conversion_method', 'unknown')}")

    # Prepare insert data
    insert_data = {
        "name": args.name,
        "description": args.description,
        "company_name": args.company,
        "geojson": geojson_data,
        "is_active": not args.inactive,
        "display_order": args.order
    }

    # Add metadata if available
    if metadata:
        insert_data["metadata"] = metadata

    # Calculate approximate size
    data_size = len(json.dumps(geojson_data))
    print(f"\nGeoJSON size: {data_size / 1024:.1f} KB")

    # Insert via Supabase REST API
    api_url = f"{supabase_url}/rest/v1/store_shapes"
    headers = {
        "apikey": service_key,
        "Authorization": f"Bearer {service_key}",
        "Content-Type": "application/json",
        "Prefer": "return=representation"
    }

    print(f"\nInserting store shape into Supabase...")
    print(f"  Name: {args.name}")
    print(f"  Company: {args.company}")
    print(f"  Active: {not args.inactive}")
    print(f"  With metadata: {'Yes' if metadata else 'No'}")

    try:
        response = requests.post(api_url, json=insert_data, headers=headers)

        if response.status_code in [200, 201]:
            result = response.json()
            if isinstance(result, list) and len(result) > 0:
                record = result[0]
                print("\n✓ Successfully inserted store shape!")
                print(f"  ID: {record.get('id')}")
                print(f"  Name: {record.get('name')}")
                print(f"  Company: {record.get('company_name')}")
                print(f"  Active: {record.get('is_active')}")
                print(f"  Created: {record.get('created_at')}")

                # Verify metadata was stored
                if metadata and record.get('metadata'):
                    print(f"  ✓ Metadata stored successfully")
                elif metadata:
                    print(f"  ⚠ Warning: Metadata not returned (may need to check database)")

            else:
                print("\n✓ Insert completed")
                print(f"Response: {result}")
        else:
            print(f"\n✗ Error inserting store shape")
            print(f"Status code: {response.status_code}")
            print(f"Response: {response.text}")

            # Helpful error messages
            if response.status_code == 400:
                print("\nPossible issues:")
                print("  - Invalid GeoJSON format")
                print("  - Missing required fields")
                print("  - Metadata column doesn't exist (run migration first)")
            elif response.status_code == 401:
                print("\nAuthentication failed - check SUPABASE_SERVICE_ROLE_KEY")
            elif response.status_code == 413:
                print("\nPayload too large - GeoJSON file may need further optimization")

            sys.exit(1)

    except Exception as e:
        print(f"\n✗ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    main()

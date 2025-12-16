#!/usr/bin/env python3
"""
Insert store shape into Supabase database
This script reads the optimized GeoJSON and inserts it via the Supabase API
"""

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
    print("Error: Missing required environment variables")
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

# Read the GeoJSON file
geojson_file = parent_dir / 'optimized-store-shape.geojson'
if not geojson_file.exists():
    print(f"Error: GeoJSON file not found at {geojson_file}")
    sys.exit(1)

print(f"Reading GeoJSON from {geojson_file}")
with open(geojson_file, 'r') as f:
    geojson_data = json.load(f)

print(f"GeoJSON type: {geojson_data.get('type')}")
print(f"Number of features: {len(geojson_data.get('features', []))}")

# Prepare the data to insert
insert_data = {
    "name": "LD(15)-PL-06 - Proposed Building Plan",
    "description": "Detailed architectural floor plan with internal walls, rooms, and fixtures. Optimized from 8MB to 3.8MB (70% coordinate reduction).",
    "company_name": "Custom Store",
    "geojson": geojson_data,
    "is_active": True,
    "display_order": 1
}

# Insert via Supabase REST API
api_url = f"{supabase_url}/rest/v1/store_shapes"
headers = {
    "apikey": service_key,
    "Authorization": f"Bearer {service_key}",
    "Content-Type": "application/json",
    "Prefer": "return=representation"
}

print(f"\nInserting store shape into Supabase...")
print(f"API URL: {api_url}")

try:
    response = requests.post(api_url, json=insert_data, headers=headers)

    if response.status_code in [200, 201]:
        result = response.json()
        if isinstance(result, list) and len(result) > 0:
            print("\n✓ Successfully inserted store shape!")
            print(f"  ID: {result[0].get('id')}")
            print(f"  Name: {result[0].get('name')}")
            print(f"  Active: {result[0].get('is_active')}")
        else:
            print("\n✓ Insert completed")
            print(f"Response: {result}")
    else:
        print(f"\n✗ Error inserting store shape")
        print(f"Status code: {response.status_code}")
        print(f"Response: {response.text}")
        sys.exit(1)

except Exception as e:
    print(f"\n✗ Error: {e}")
    sys.exit(1)

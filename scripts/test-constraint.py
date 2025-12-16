#!/usr/bin/env python3
"""Test the GeoJSON constraint with a simple FeatureCollection"""

import json
import os
import sys
from pathlib import Path

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
                value = value.strip('"').strip("'")
                env_vars[key] = value

supabase_url = env_vars.get('NEXT_PUBLIC_SUPABASE_URL')
service_key = env_vars.get('SUPABASE_SERVICE_ROLE_KEY')

import requests

# Test with minimal FeatureCollection
test_data = {
    "name": "Test Constraint",
    "description": "Testing constraint",
    "company_name": "Test",
    "geojson": {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "geometry": {
                    "type": "Point",
                    "coordinates": [0, 0]
                },
                "properties": {}
            }
        ]
    },
    "is_active": True,
    "display_order": 999
}

api_url = f"{supabase_url}/rest/v1/store_shapes"
headers = {
    "apikey": service_key,
    "Authorization": f"Bearer {service_key}",
    "Content-Type": "application/json",
    "Prefer": "return=representation"
}

print("Testing constraint with minimal FeatureCollection...")
response = requests.post(api_url, json=test_data, headers=headers)

if response.status_code in [200, 201]:
    print("✓ Constraint works! Simple FeatureCollection inserted successfully")
    result = response.json()
    if isinstance(result, list) and len(result) > 0:
        print(f"  Inserted ID: {result[0].get('id')}")
        # Clean up - delete the test record
        delete_url = f"{api_url}?id=eq.{result[0].get('id')}"
        requests.delete(delete_url, headers=headers)
        print("  Test record deleted")
else:
    print(f"✗ Constraint failed even with simple data")
    print(f"Status: {response.status_code}")
    print(f"Response: {response.text}")

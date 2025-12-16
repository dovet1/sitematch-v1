#!/usr/bin/env python3
"""
Convert DWG/DXF architectural files to GeoJSON with proper scaling.

This script:
1. Reads DXF files (convert DWG to DXF using ODA File Converter first)
2. Extracts unit metadata ($INSUNITS) to determine scale
3. Converts geometry to GeoJSON with proper coordinate scaling
4. Outputs scaled GeoJSON + metadata JSON for database storage

Usage:
    python3 convert-dwg-to-geojson.py input.dxf
    python3 convert-dwg-to-geojson.py input.dxf --output custom.geojson
"""

import argparse
import json
import sys
from pathlib import Path
from typing import Dict, List, Tuple, Any, Optional

try:
    import ezdxf
    from ezdxf.addons import geo
except ImportError:
    print("Error: ezdxf library not installed")
    print("Install with: pip3 install ezdxf")
    sys.exit(1)

# DXF unit codes from $INSUNITS header variable
# https://ezdxf.readthedocs.io/en/stable/dxfinternals/header_section.html
INSUNITS_TO_METERS = {
    0: None,           # Unitless
    1: 0.0254,         # Inches
    2: 0.3048,         # Feet
    3: 1609.344,       # Miles
    4: 0.001,          # Millimeters
    5: 0.01,           # Centimeters
    6: 1.0,            # Meters
    7: 1000.0,         # Kilometers
    8: 0.0000254,      # Microinches
    9: 0.001,          # Mils (1/1000 inch)
    10: 0.9144,        # Yards
    11: 1e-10,         # Angstroms
    12: 1e-9,          # Nanometers
    13: 1e-6,          # Microns
    14: 0.1,           # Decimeters
    15: 10.0,          # Decameters
    16: 100.0,         # Hectometers
    17: 1e9,           # Gigameters
    18: 149597870700,  # Astronomical units
    19: 9.461e15,      # Light years
    20: 3.086e16,      # Parsecs
}

INSUNITS_NAMES = {
    0: "Unitless",
    1: "Inches",
    2: "Feet",
    3: "Miles",
    4: "Millimeters",
    5: "Centimeters",
    6: "Meters",
    7: "Kilometers",
    8: "Microinches",
    9: "Mils",
    10: "Yards",
    11: "Angstroms",
    12: "Nanometers",
    13: "Microns",
    14: "Decimeters",
    15: "Decameters",
    16: "Hectometers",
    17: "Gigameters",
    18: "Astronomical Units",
    19: "Light Years",
    20: "Parsecs",
}


def extract_dxf_metadata(dxf_path: Path) -> Dict[str, Any]:
    """Extract metadata from DXF file including units and bounding box."""
    print(f"Reading DXF file: {dxf_path}")

    try:
        doc = ezdxf.readfile(str(dxf_path))
    except Exception as e:
        print(f"Error reading DXF file: {e}")
        sys.exit(1)

    # Extract units from header
    insunits = doc.header.get('$INSUNITS', 0)
    units_to_meters = INSUNITS_TO_METERS.get(insunits)
    units_name = INSUNITS_NAMES.get(insunits, "Unknown")

    print(f"  DXF Units: {units_name} (code: {insunits})")

    if units_to_meters is None:
        print(f"  ⚠️  Warning: Unitless drawing - will require manual scale calibration")
    else:
        print(f"  Conversion factor: 1 DXF unit = {units_to_meters}m")

    # Get bounding box from EXTMIN/EXTMAX
    extmin = doc.header.get('$EXTMIN', (0, 0, 0))
    extmax = doc.header.get('$EXTMAX', (0, 0, 0))

    bbox_width = abs(extmax[0] - extmin[0])
    bbox_height = abs(extmax[1] - extmin[1])

    print(f"  Bounding box: {bbox_width:.2f} × {bbox_height:.2f} DXF units")

    if units_to_meters:
        bbox_width_m = bbox_width * units_to_meters
        bbox_height_m = bbox_height * units_to_meters
        print(f"  Real-world size: {bbox_width_m:.2f}m × {bbox_height_m:.2f}m")

    # Count entities by layer
    layer_counts = {}
    for entity in doc.modelspace():
        layer = entity.dxf.layer
        layer_counts[layer] = layer_counts.get(layer, 0) + 1

    print(f"  Total layers: {len(layer_counts)}")
    print(f"  Total entities: {sum(layer_counts.values())}")

    metadata = {
        'source_filename': dxf_path.name,
        'insunits_code': insunits,
        'source_units': units_name,
        'units_to_meters': units_to_meters,
        'bbox': {
            'width': bbox_width,
            'height': bbox_height,
            'width_meters': bbox_width * units_to_meters if units_to_meters else None,
            'height_meters': bbox_height * units_to_meters if units_to_meters else None,
        },
        'layer_counts': layer_counts,
        'total_entities': sum(layer_counts.values()),
    }

    return metadata, doc


def calculate_scale_factor(metadata: Dict[str, Any]) -> Tuple[float, str]:
    """
    Calculate scale factor to convert DXF coordinates to geographic degrees.
    Uses the actual real-world dimensions from DXF metadata.

    Returns:
        (scale_factor, method) where method is 'metadata', 'heuristic', or 'manual'
    """
    units_to_meters = metadata.get('units_to_meters')
    bbox_width = metadata['bbox']['width']

    if units_to_meters is not None and bbox_width > 0:
        # We know real-world size from DXF metadata - use actual dimensions
        actual_width_m = bbox_width * units_to_meters
        actual_height_m = metadata['bbox']['height'] * units_to_meters

        # Convert actual size in meters to degrees
        # 1 degree ≈ 111,320 meters at equator
        meters_per_degree = 111320
        actual_width_degrees = actual_width_m / meters_per_degree

        # scale_factor = actual_width_degrees / bbox_width
        scale_factor = actual_width_degrees / bbox_width

        print(f"\n✓ Scale calculation (from metadata):")
        print(f"  DXF dimensions: {bbox_width:.2f} × {metadata['bbox']['height']:.2f} {metadata['source_units']}")
        print(f"  Real-world size: {actual_width_m:.2f}m × {actual_height_m:.2f}m")
        print(f"  Scale factor: {scale_factor:.10f}")
        print(f"  (Building will appear at actual size on map)")

        return scale_factor, 'metadata'

    elif bbox_width > 0:
        # No unit metadata - use heuristic
        # Assume DXF units are millimeters (common for architectural drawings)
        print(f"\n⚠️  No unit metadata - assuming millimeters")

        assumed_width_m = bbox_width * 0.001  # mm to meters
        assumed_height_m = metadata['bbox']['height'] * 0.001

        meters_per_degree = 111320
        actual_width_degrees = assumed_width_m / meters_per_degree
        scale_factor = actual_width_degrees / bbox_width

        print(f"  DXF dimensions: {bbox_width:.2f} × {metadata['bbox']['height']:.2f} units")
        print(f"  Assumed size: {assumed_width_m:.2f}m × {assumed_height_m:.2f}m (if millimeters)")
        print(f"  Scale factor: {scale_factor:.10f}")
        print(f"  ⚠️  Verify output - may need manual adjustment")

        return scale_factor, 'heuristic'

    else:
        print(f"\n❌ Cannot calculate scale - no bounding box data")
        print(f"   Using default scale factor (will likely be incorrect)")
        return 0.0001, 'manual'


def dxf_to_geojson(doc, scale_factor: float = 1.0) -> Dict[str, Any]:
    """
    Convert DXF entities to GeoJSON FeatureCollection.

    Args:
        doc: ezdxf document
        scale_factor: Scale to apply to coordinates

    Returns:
        GeoJSON FeatureCollection dict
    """
    features = []

    print(f"\nConverting entities to GeoJSON...")

    # Track entity types for reporting
    entity_types = {}
    skipped_types = set()

    # Process all entities including exploded block references (INSERT entities)
    # This ensures we capture detailed internal layouts stored as blocks
    # We recursively explode nested INSERTs until we get to basic geometry
    def explode_entity(entity, depth=0, max_depth=10):
        """Recursively explode INSERT entities to get basic geometry."""
        if depth > max_depth:
            return []

        if entity.dxftype() == 'INSERT':
            try:
                sub_entities = []
                for sub_entity in entity.virtual_entities():
                    # Recursively explode nested INSERTs
                    sub_entities.extend(explode_entity(sub_entity, depth + 1, max_depth))
                return sub_entities
            except Exception as e:
                # If we can't explode, return empty (will be tracked as skipped)
                return []
        else:
            # Base geometry - return as-is
            return [entity]

    all_entities = []
    insert_count = 0
    total_inserts_exploded = 0

    for entity in doc.modelspace():
        original_type = entity.dxftype()
        entity_types[original_type] = entity_types.get(original_type, 0) + 1

        # Recursively explode INSERT entities
        if original_type == 'INSERT':
            insert_count += 1
            exploded = explode_entity(entity)
            total_inserts_exploded += len(exploded)
            all_entities.extend(exploded)
        else:
            all_entities.append(entity)

    print(f"  Original entities in modelspace: {len(list(doc.modelspace()))}")
    print(f"  INSERT blocks exploded: {insert_count}")
    print(f"  Entities after recursive explosion: {total_inserts_exploded}")
    print(f"  Total entities to convert: {len(all_entities)}")

    # Track converted entity types from exploded entities
    converted_types = {}

    for entity in all_entities:
        entity_type = entity.dxftype()
        converted_types[entity_type] = converted_types.get(entity_type, 0) + 1

        feature = None

        try:
            if entity_type == 'LINE':
                start = entity.dxf.start
                end = entity.dxf.end
                feature = {
                    'type': 'Feature',
                    'geometry': {
                        'type': 'LineString',
                        'coordinates': [
                            [start.x * scale_factor, start.y * scale_factor],
                            [end.x * scale_factor, end.y * scale_factor]
                        ]
                    },
                    'properties': {
                        'layer': entity.dxf.layer,
                        'type': 'LINE'
                    }
                }

            elif entity_type == 'LWPOLYLINE':
                coords = [[p[0] * scale_factor, p[1] * scale_factor] for p in entity.get_points('xy')]

                # Check if closed
                is_closed = entity.closed or (coords[0] == coords[-1])

                if is_closed and len(coords) >= 3:
                    # Ensure closed ring
                    if coords[0] != coords[-1]:
                        coords.append(coords[0])

                    feature = {
                        'type': 'Feature',
                        'geometry': {
                            'type': 'Polygon',
                            'coordinates': [coords]
                        },
                        'properties': {
                            'layer': entity.dxf.layer,
                            'type': 'LWPOLYLINE'
                        }
                    }
                else:
                    feature = {
                        'type': 'Feature',
                        'geometry': {
                            'type': 'LineString',
                            'coordinates': coords
                        },
                        'properties': {
                            'layer': entity.dxf.layer,
                            'type': 'LWPOLYLINE'
                        }
                    }

            elif entity_type == 'POLYLINE':
                coords = [[p.dxf.location.x * scale_factor, p.dxf.location.y * scale_factor]
                         for p in entity.vertices]

                is_closed = entity.is_closed or (coords[0] == coords[-1])

                if is_closed and len(coords) >= 3:
                    if coords[0] != coords[-1]:
                        coords.append(coords[0])

                    feature = {
                        'type': 'Feature',
                        'geometry': {
                            'type': 'Polygon',
                            'coordinates': [coords]
                        },
                        'properties': {
                            'layer': entity.dxf.layer,
                            'type': 'POLYLINE'
                        }
                    }
                else:
                    feature = {
                        'type': 'Feature',
                        'geometry': {
                            'type': 'LineString',
                            'coordinates': coords
                        },
                        'properties': {
                            'layer': entity.dxf.layer,
                            'type': 'POLYLINE'
                        }
                    }

            elif entity_type == 'CIRCLE':
                center = entity.dxf.center
                radius = entity.dxf.radius * scale_factor

                # Approximate circle as polygon with 32 segments
                import math
                segments = 32
                coords = []
                for i in range(segments + 1):
                    angle = (2 * math.pi * i) / segments
                    x = center.x * scale_factor + radius * math.cos(angle)
                    y = center.y * scale_factor + radius * math.sin(angle)
                    coords.append([x, y])

                feature = {
                    'type': 'Feature',
                    'geometry': {
                        'type': 'Polygon',
                        'coordinates': [coords]
                    },
                    'properties': {
                        'layer': entity.dxf.layer,
                        'type': 'CIRCLE',
                        'radius': radius
                    }
                }

            elif entity_type == 'ARC':
                center = entity.dxf.center
                radius = entity.dxf.radius * scale_factor
                start_angle = entity.dxf.start_angle
                end_angle = entity.dxf.end_angle

                # Convert arc to polyline with 16 segments
                import math
                segments = 16

                # Handle angle wrap-around
                if end_angle < start_angle:
                    end_angle += 360

                angle_range = end_angle - start_angle
                coords = []

                for i in range(segments + 1):
                    angle_deg = start_angle + (angle_range * i / segments)
                    angle_rad = math.radians(angle_deg)
                    x = center.x * scale_factor + radius * math.cos(angle_rad)
                    y = center.y * scale_factor + radius * math.sin(angle_rad)
                    coords.append([x, y])

                feature = {
                    'type': 'Feature',
                    'geometry': {
                        'type': 'LineString',
                        'coordinates': coords
                    },
                    'properties': {
                        'layer': entity.dxf.layer,
                        'type': 'ARC'
                    }
                }

            elif entity_type == 'POINT':
                point = entity.dxf.location
                feature = {
                    'type': 'Feature',
                    'geometry': {
                        'type': 'Point',
                        'coordinates': [point.x * scale_factor, point.y * scale_factor]
                    },
                    'properties': {
                        'layer': entity.dxf.layer,
                        'type': 'POINT'
                    }
                }

            elif entity_type in ['TEXT', 'MTEXT']:
                # Store text entities as points with text property
                insert = entity.dxf.insert if hasattr(entity.dxf, 'insert') else (0, 0, 0)
                text_content = entity.dxf.text if hasattr(entity.dxf, 'text') else ''

                feature = {
                    'type': 'Feature',
                    'geometry': {
                        'type': 'Point',
                        'coordinates': [insert[0] * scale_factor, insert[1] * scale_factor]
                    },
                    'properties': {
                        'layer': entity.dxf.layer,
                        'type': entity_type,
                        'text': text_content
                    }
                }

            elif entity_type == 'HATCH':
                # HATCH entities represent filled areas with patterns
                # Convert boundary paths to polygons
                try:
                    # Get boundary paths (outer boundaries of hatch)
                    paths = entity.paths
                    if paths:
                        # Process each boundary path
                        for path in paths:
                            if hasattr(path, 'vertices') and len(path.vertices) >= 3:
                                coords = [[v[0] * scale_factor, v[1] * scale_factor] for v in path.vertices]

                                # Ensure closed polygon
                                if coords[0] != coords[-1]:
                                    coords.append(coords[0])

                                feature = {
                                    'type': 'Feature',
                                    'geometry': {
                                        'type': 'Polygon',
                                        'coordinates': [coords]
                                    },
                                    'properties': {
                                        'layer': entity.dxf.layer,
                                        'type': 'HATCH',
                                        'pattern': entity.dxf.pattern_name if hasattr(entity.dxf, 'pattern_name') else None
                                    }
                                }
                                features.append(feature)
                        # Don't add to features again below since we already added
                        feature = None
                except Exception as e:
                    # HATCH entities can be complex, skip if conversion fails
                    if entity_type not in skipped_types:
                        skipped_types.add(entity_type)
                    feature = None

            elif entity_type == 'ELLIPSE':
                # Approximate ellipse as polygon with segments
                try:
                    center = entity.dxf.center
                    major_axis = entity.dxf.major_axis
                    ratio = entity.dxf.ratio  # minor/major axis ratio

                    import math
                    segments = 32
                    coords = []

                    # Calculate major and minor axis lengths
                    major_length = math.sqrt(major_axis.x**2 + major_axis.y**2)
                    minor_length = major_length * ratio

                    # Calculate rotation angle
                    angle = math.atan2(major_axis.y, major_axis.x)

                    for i in range(segments + 1):
                        t = (2 * math.pi * i) / segments
                        # Ellipse in local coordinates
                        local_x = major_length * math.cos(t)
                        local_y = minor_length * math.sin(t)
                        # Rotate and translate to world coordinates
                        x = (center.x + local_x * math.cos(angle) - local_y * math.sin(angle)) * scale_factor
                        y = (center.y + local_x * math.sin(angle) + local_y * math.cos(angle)) * scale_factor
                        coords.append([x, y])

                    feature = {
                        'type': 'Feature',
                        'geometry': {
                            'type': 'Polygon',
                            'coordinates': [coords]
                        },
                        'properties': {
                            'layer': entity.dxf.layer,
                            'type': 'ELLIPSE'
                        }
                    }
                except Exception as e:
                    if entity_type not in skipped_types:
                        skipped_types.add(entity_type)
                    feature = None

            elif entity_type == 'SPLINE':
                # Approximate spline as polyline
                try:
                    # Use flattening to convert spline to polyline
                    coords = [[p[0] * scale_factor, p[1] * scale_factor]
                             for p in entity.flattening(0.01)]

                    if len(coords) >= 2:
                        feature = {
                            'type': 'Feature',
                            'geometry': {
                                'type': 'LineString',
                                'coordinates': coords
                            },
                            'properties': {
                                'layer': entity.dxf.layer,
                                'type': 'SPLINE'
                            }
                        }
                except Exception as e:
                    if entity_type not in skipped_types:
                        skipped_types.add(entity_type)
                    feature = None

            else:
                # Skip unsupported entity types
                if entity_type not in skipped_types:
                    skipped_types.add(entity_type)

        except Exception as e:
            print(f"  ⚠️  Error converting {entity_type}: {e}")
            continue

        if feature:
            features.append(feature)

    # Report conversion stats
    print(f"\n  Original entity types in modelspace:")
    for etype, count in sorted(entity_types.items()):
        if etype == 'INSERT':
            print(f"    ✓ {etype}: {count} (exploded into constituent geometry)")
        else:
            print(f"    ✓ {etype}: {count}")

    print(f"\n  Converted entity types after exploding blocks:")
    for etype, count in sorted(converted_types.items()):
        status = "✓" if etype not in skipped_types else "⊘"
        print(f"    {status} {etype}: {count}")

    if skipped_types:
        print(f"\n  ⊘ Skipped entity types: {', '.join(sorted(skipped_types))}")

    print(f"\n  Total features in GeoJSON: {len(features)}")

    return {
        'type': 'FeatureCollection',
        'features': features
    }


def main():
    parser = argparse.ArgumentParser(
        description='Convert DXF to GeoJSON with automatic scaling based on real-world dimensions',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Convert using actual dimensions from DXF
  python3 convert-dwg-to-geojson.py building.dxf

  # Specify custom output path
  python3 convert-dwg-to-geojson.py building.dxf --output building.geojson

Note:
  The script automatically extracts real-world dimensions from the DXF file's
  $INSUNITS header and calculates the correct scale factor. No manual sizing needed!
        """
    )

    parser.add_argument('input', type=Path, help='Input DXF file path')
    parser.add_argument('--output', type=Path,
                       help='Output GeoJSON file path (default: input.raw.geojson)')

    args = parser.parse_args()

    # Validate input
    if not args.input.exists():
        print(f"Error: Input file not found: {args.input}")
        sys.exit(1)

    if args.input.suffix.lower() not in ['.dxf']:
        print(f"Error: Input must be a DXF file (got: {args.input.suffix})")
        print(f"Tip: Convert DWG to DXF using ODA File Converter first")
        sys.exit(1)

    # Set output paths
    if args.output:
        geojson_output = args.output
    else:
        geojson_output = args.input.with_suffix('.raw.geojson')

    metadata_output = geojson_output.with_suffix('.metadata.json')

    print(f"=" * 60)
    print(f"DXF to GeoJSON Converter")
    print(f"=" * 60)

    # Extract metadata
    metadata, doc = extract_dxf_metadata(args.input)

    # Calculate scale factor using actual dimensions
    scale_factor, method = calculate_scale_factor(metadata)

    # Add scale info to metadata
    metadata['scale_factor'] = scale_factor
    metadata['conversion_method'] = method

    # Convert to GeoJSON
    geojson = dxf_to_geojson(doc, scale_factor)

    # Update metadata with final feature count
    metadata['geojson_feature_count'] = len(geojson['features'])

    # Write outputs
    print(f"\n" + "=" * 60)
    print(f"Writing outputs...")
    print(f"=" * 60)

    with open(geojson_output, 'w') as f:
        json.dump(geojson, f, indent=2)
    print(f"✓ GeoJSON: {geojson_output}")

    with open(metadata_output, 'w') as f:
        json.dump(metadata, f, indent=2)
    print(f"✓ Metadata: {metadata_output}")

    print(f"\n" + "=" * 60)
    print(f"Conversion complete!")
    print(f"=" * 60)
    print(f"\nNext steps:")
    print(f"1. Inspect the GeoJSON file to verify scale")
    print(f"2. Optimize with: node scripts/optimize-store-shape.js {geojson_output}")
    print(f"3. Insert into database with metadata")

    if method != 'metadata':
        print(f"\n⚠️  Warning: Scale factor calculated using {method} method")
        print(f"   Please verify the output size matches expectations")


if __name__ == '__main__':
    main()

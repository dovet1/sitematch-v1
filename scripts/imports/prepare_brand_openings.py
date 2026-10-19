"""Prepare an additive opening import from the reviewed CSV and approved brand map.

This script never connects to a database. The plan retains source values and IDs
and must be checked against the target database before applying.
"""
import argparse
import calendar
import collections
import csv
import datetime as dt
import hashlib
import json
from pathlib import Path
import re
import uuid
from urllib.parse import urlparse


def parse_opening_date(value):
    value = value.strip()
    if re.fullmatch(r'\d{1,2}/\d{1,2}/\d{2}(?:\d{2})?', value):
        day, month, year = map(int, value.split('/'))
        if year < 100:
            year += 2000
        return dt.date(year, month, day), 'day'
    months = {name.lower(): n for n, name in enumerate(calendar.month_name) if name}
    match = re.fullmatch(r'([A-Za-z]+)\s+(\d{4})', value)
    if match and match[1].lower() in months:
        return dt.date(int(match[2]), months[match[1].lower()], 1), 'month'
    match = re.fullmatch(r'Q([1-4])\s+(\d{4})', value, re.IGNORECASE)
    if match:
        return dt.date(int(match[2]), 3 * int(match[1]) - 1, 15), 'quarter'
    match = re.fullmatch(r'(Spring|Summer|Autumn|Winter)\s+(\d{4})', value, re.IGNORECASE)
    if match:
        # UK meteorological seasons; winter YEAR begins in December of YEAR.
        season, year = match[1].lower(), int(match[2])
        month = {'spring': 4, 'summer': 7, 'autumn': 10, 'winter': 1}[season]
        return dt.date(year + (season == 'winter'), month, 15), 'season'
    raise ValueError(f'Unrecognised opening date: {value!r}')


def prepare(csv_path, mapping_path):
    source_hash = hashlib.sha256(csv_path.read_bytes()).hexdigest()
    mapping = json.loads(mapping_path.read_text())
    if source_hash != mapping['source_sha256']:
        raise ValueError('CSV changed since the approved brand mapping')
    by_row = {r['source_row']: r for r in mapping['rows']}
    records, held, seen, blank = [], [], {}, 0
    batch = f'bulk-openings-{source_hash[:16]}'
    with csv_path.open(encoding='utf-8-sig', newline='') as file:
        rows = list(csv.DictReader(file))
    for row_number, row in enumerate(rows, 2):
        date_text, location, source_url = (row[k].strip() for k in ('Open date 1', 'Location 1', 'Article URL 1'))
        if not any((date_text, location, source_url)):
            blank += 1
            continue
        identity = by_row[row_number]
        if identity['source_brand'] != row['Brand']:
            raise ValueError(f'Brand mapping mismatch at row {row_number}')
        context = {'source_row': row_number, 'source_brand': row['Brand']}
        if not identity.get('approved') or not identity.get('target_brand_id'):
            held.append({**context, 'reason': 'Brand identity remains on hold'})
            continue
        try:
            date, precision = parse_opening_date(date_text)
            url = urlparse(source_url)
            if not location or url.scheme not in ('http', 'https') or not url.netloc or any(c.isspace() for c in source_url):
                raise ValueError('Missing location or invalid source article URL')
        except ValueError as error:
            held.append({**context, 'reason': str(error)})
            continue
        brand_id = identity['target_brand_id']
        duplicate_key = (brand_id, location.casefold(), date.isoformat())
        if duplicate_key in seen:
            held.append({**context, 'reason': f'Possible repeated opening: row {seen[duplicate_key]}'})
            continue
        seen[duplicate_key] = row_number
        records.append({
            'id': str(uuid.uuid5(uuid.NAMESPACE_URL, f'{batch}:{row_number}')),
            'brand_id': brand_id, 'location': location, 'opening_date': date.isoformat(),
            'opening_date_original': date_text, 'date_precision': precision,
            'is_date_estimated': precision != 'day', 'status': 'confirmed',
            'source_url': source_url, 'source_file': csv_path.name,
            'source_file_sha256': source_hash, 'source_row': row_number,
            'import_batch_id': batch,
        })
    return {
        'prepared_at': dt.datetime.now(dt.timezone.utc).isoformat(),
        'source_path': str(csv_path), 'source_sha256': source_hash, 'import_batch_id': batch,
        'rules': ['Exact dates use UK day/month/year.', 'Month dates use the first day.',
                  'Quarters and UK meteorological seasons use day 15 of the middle month.',
                  'All entries marked confirmed by explicit user instruction; articles not independently verified.',
                  'Only approved brand links; no updates to existing brand, store or contact records.'],
        'summary': {'source_rows': len(rows), 'rows_without_openings': blank, 'insert_count': len(records),
                    'brand_count': len({r['brand_id'] for r in records}), 'held_count': len(held),
                    'date_precision': dict(collections.Counter(r['date_precision'] for r in records))},
        'records': records, 'held': held,
    }


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--csv', type=Path, required=True)
    parser.add_argument('--mapping', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    plan = prepare(args.csv, args.mapping)
    args.output.write_text(json.dumps(plan, indent=2) + '\n')
    print(json.dumps(plan['summary']))

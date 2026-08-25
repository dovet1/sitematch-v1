/**
 * Import an extracted ONS Postcode Directory CSV into Supabase.
 *
 * Run from apps/web:
 *   npm run import:onspd -- /absolute/path/to/ONSPD_....csv 2026-05
 *
 * The ONS download is a zip containing several files. Use the large UK CSV in
 * its Data/CSV directory. Re-running this command is safe: postcodes are upserted.
 */

import fs from 'node:fs'
import path from 'node:path'
import { loadEnvConfig } from '@next/env'
import { createClient } from '@supabase/supabase-js'
import { parse } from 'csv-parse'

loadEnvConfig(process.cwd())

const requestedCsvPath = process.argv[2]
const csvPath = requestedCsvPath ? path.resolve(requestedCsvPath) : ''
const sourceRelease = process.argv[3] ?? path.basename(csvPath || 'unknown')
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!csvPath || !fs.existsSync(csvPath)) {
  console.error('Provide the path to the extracted ONSPD UK CSV.')
  process.exit(1)
}
if (!supabaseUrl || !serviceKey) {
  console.error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})
const BATCH_SIZE = 1000

type CsvRow = Record<string, string | undefined>
type PostcodeRow = {
  postcode: string
  outward_code: string
  latitude: number
  longitude: number
  is_live: boolean
  source_release: string
  imported_at: string
}
type OutcodeBoundsRow = {
  outward_code: string
  min_latitude: number
  min_longitude: number
  max_latitude: number
  max_longitude: number
  source_release: string
  imported_at: string
}

function field(row: CsvRow, ...names: string[]): string {
  for (const name of names) {
    const value = row[name]
    if (value?.trim()) return value.trim()
  }
  return ''
}

export function normalisePostcode(value: string): { postcode: string; outwardCode: string } | null {
  const compact = value.toUpperCase().replace(/\s+/g, '')
  if (!/^[A-Z]{1,2}\d[A-Z\d]?\d[A-Z]{2}$/.test(compact) && compact !== 'GIR0AA') return null
  const outwardCode = compact.slice(0, -3)
  return {
    postcode: `${outwardCode} ${compact.slice(-3)}`,
    outwardCode,
  }
}

function mapRow(row: CsvRow, importedAt: string): PostcodeRow | null {
  const normalised = normalisePostcode(field(row, 'pcds', 'pcd', 'postcode'))
  const latitude = Number(field(row, 'lat', 'latitude'))
  const longitude = Number(field(row, 'long', 'longitude', 'lng'))
  if (!normalised || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return null
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null

  return {
    postcode: normalised.postcode,
    outward_code: normalised.outwardCode,
    latitude,
    longitude,
    is_live: field(row, 'doterm', 'date_of_termination') === '',
    source_release: sourceRelease,
    imported_at: importedAt,
  }
}

async function upsertBatch(rows: PostcodeRow[]): Promise<void> {
  const { error } = await supabase
    .from('uk_postcode_centroids')
    .upsert(rows, { onConflict: 'postcode' })
  if (error) throw new Error(error.message)
}

async function upsertOutcodeBounds(rows: OutcodeBoundsRow[]): Promise<void> {
  for (let offset = 0; offset < rows.length; offset += BATCH_SIZE) {
    const { error } = await supabase
      .from('uk_postcode_outcode_bounds')
      .upsert(rows.slice(offset, offset + BATCH_SIZE), { onConflict: 'outward_code' })
    if (error) throw new Error(error.message)
  }
}

async function main() {
  const importedAt = new Date().toISOString()
  const parser = fs.createReadStream(csvPath).pipe(parse({
    bom: true,
    columns: (headers: string[]) => headers.map((header) => header.trim().toLowerCase()),
    relax_column_count: true,
    skip_empty_lines: true,
    trim: true,
  }))

  let batch: PostcodeRow[] = []
  let read = 0
  let imported = 0
  let skipped = 0
  const outcodeBounds = new Map<string, OutcodeBoundsRow>()

  for await (const raw of parser) {
    read += 1
    const postcode = mapRow(raw as CsvRow, importedAt)
    if (!postcode) {
      skipped += 1
      continue
    }
    if (postcode.is_live) {
      const existing = outcodeBounds.get(postcode.outward_code)
      if (existing) {
        existing.min_latitude = Math.min(existing.min_latitude, postcode.latitude)
        existing.min_longitude = Math.min(existing.min_longitude, postcode.longitude)
        existing.max_latitude = Math.max(existing.max_latitude, postcode.latitude)
        existing.max_longitude = Math.max(existing.max_longitude, postcode.longitude)
      } else {
        outcodeBounds.set(postcode.outward_code, {
          outward_code: postcode.outward_code,
          min_latitude: postcode.latitude,
          min_longitude: postcode.longitude,
          max_latitude: postcode.latitude,
          max_longitude: postcode.longitude,
          source_release: sourceRelease,
          imported_at: importedAt,
        })
      }
    }
    batch.push(postcode)
    if (batch.length < BATCH_SIZE) continue
    await upsertBatch(batch)
    imported += batch.length
    batch = []
    if (imported % 50000 === 0) console.info(`Imported ${imported.toLocaleString()} postcodes…`)
  }

  if (batch.length > 0) {
    await upsertBatch(batch)
    imported += batch.length
  }

  await upsertOutcodeBounds(Array.from(outcodeBounds.values()))

  console.info(`ONSPD import complete: ${imported.toLocaleString()} postcodes and ${outcodeBounds.size.toLocaleString()} outward-code bounds imported; ${skipped.toLocaleString()} rows skipped, ${read.toLocaleString()} read.`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})

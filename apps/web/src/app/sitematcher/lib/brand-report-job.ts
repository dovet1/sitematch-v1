'use client'

import { parseReportMeta, EMPTY_REPORT_META } from './brand-report'
import type { BrandMatcherQuery, BrandReportMeta } from '../types/brand-matcher'

// Browser storage for the brand report (docs/design_handoff_brand_report_export). The dialog
// writes the job and the report page (/sitematcher/brand-report) reads it; the dialog's
// fields are remembered per user. Storage can be missing or full: every read and write tolerates it.

export interface BrandReportJob {
  query: BrandMatcherQuery
  brandIds: string[]
  meta: BrandReportMeta
  createdAt: string
}

const JOB_KEY = 'sm-brand-report-job'
const metaKey = (userId: string) => `sm-brand-report-meta:${userId}`

// The message the report page posts to the window that embedded it.
export const REPORT_MESSAGE = 'sm-brand-report'
export type BrandReportMessage =
  | { type: typeof REPORT_MESSAGE; status: 'ready'; title: string }
  | { type: typeof REPORT_MESSAGE; status: 'error'; message: string }

export function writeReportJob(job: BrandReportJob): boolean {
  try {
    localStorage.setItem(JOB_KEY, JSON.stringify(job))
    return true
  } catch {
    return false
  }
}

export function readReportJob(): BrandReportJob | null {
  try {
    const raw = JSON.parse(localStorage.getItem(JOB_KEY) ?? 'null') as Partial<BrandReportJob> | null
    if (!raw || !raw.query || !Array.isArray(raw.brandIds)) return null
    return {
      query: raw.query,
      brandIds: raw.brandIds.filter((x): x is string => typeof x === 'string'),
      meta: { ...EMPTY_REPORT_META, ...parseReportMeta(raw.meta) },
      createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : new Date().toISOString(),
    }
  } catch {
    return null
  }
}

export function readSavedMeta(userId: string | null): Partial<BrandReportMeta> {
  if (!userId) return {}
  try {
    return parseReportMeta(JSON.parse(localStorage.getItem(metaKey(userId)) ?? 'null')) ?? {}
  } catch {
    return {}
  }
}

export function saveMeta(userId: string | null, meta: BrandReportMeta): void {
  if (!userId) return
  try {
    localStorage.setItem(metaKey(userId), JSON.stringify(meta))
  } catch {
    // Remembering the fields is a convenience; the report still builds.
  }
}

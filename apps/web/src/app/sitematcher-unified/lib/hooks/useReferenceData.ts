'use client'

import { useEffect, useState } from 'react'
import { fetchReferenceData } from '../services/gaps-service'
import type { ReferenceData } from '../../types/unified-workspace'

const EMPTY: ReferenceData = { categories: [], brands: [] }

// Loads the category/brand/fascia taxonomy once for the rule builder.
export function useReferenceData(): { data: ReferenceData; loading: boolean } {
  const [data, setData] = useState<ReferenceData>(EMPTY)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const controller = new AbortController()
    fetchReferenceData(controller.signal)
      .then((d) => setData(d))
      .catch((err) => {
        if (err?.name !== 'AbortError') console.error('Reference data error', err)
      })
      .finally(() => setLoading(false))
    return () => controller.abort()
  }, [])

  return { data, loading }
}

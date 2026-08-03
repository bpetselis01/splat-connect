'use client'
import { useEffect, useState } from 'react'
import { formatRelativeTime } from '@/lib/relative-time'

// The interval only forces a re-render; formatRelativeTime does the actual
// (already-tested) math each tick, so this hook has no logic of its own
// worth a separate test beyond what SaveStatusLine's test exercises.
export function useLiveRelativeTime(iso: string | null): string | null {
  const [, forceTick] = useState(0)

  useEffect(() => {
    if (!iso) return
    const id = setInterval(() => forceTick((t) => t + 1), 30_000)
    return () => clearInterval(id)
  }, [iso])

  return iso ? formatRelativeTime(iso) : null
}

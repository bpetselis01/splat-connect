'use client'
import { useEffect, useState } from 'react'
import { formatRelativeTime } from '@/lib/relative-time'

export function SaveStatusLine({ savedAt }: { savedAt: string | null }) {
  // The interval only forces a re-render; formatRelativeTime does the actual
  // (already-tested) math each tick, so there is no logic here worth a test
  // beyond what this component's own test exercises.
  const [, forceTick] = useState(0)

  useEffect(() => {
    if (!savedAt) return
    const id = setInterval(() => forceTick((t) => t + 1), 30_000)
    return () => clearInterval(id)
  }, [savedAt])

  if (!savedAt) return null
  return <p className="text-xs text-muted">Last saved {formatRelativeTime(savedAt)}</p>
}

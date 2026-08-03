'use client'
import { useLiveRelativeTime } from '@/lib/use-live-relative-time'

export function SaveStatusLine({ savedAt }: { savedAt: string | null }) {
  const label = useLiveRelativeTime(savedAt)
  if (!label) return null
  return <p className="text-xs text-muted">Last saved {label}</p>
}

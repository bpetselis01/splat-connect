/**
 * Clears one My SPLAT card's unread badge when its destination page opens.
 *
 * A bucket rather than a list of ids because the page does not know its
 * notifications — it knows which card sent the visitor here. See
 * lib/notification-bucket via @splat-connect/types for the mapping.
 *
 * Renders nothing. The badge this clears is on /dashboard, not here.
 *
 * The accepted consequence: opening /dashboard/tutorials also marks those rows
 * read in /notifications. That is the decision recorded in the spec — the badge
 * counts what you have not seen, and you have now seen it.
 */
'use client'

import { useEffect, useRef } from 'react'
import { browserApiClient } from '@/lib/browser-api-client'
import type { NotificationBucket } from '@splat-connect/types'

export function MarkNotificationsRead({ bucket }: { bucket: NotificationBucket }) {
  // Track which bucket we've already sent, not a boolean. StrictMode mounts twice
  // in development and any remount re-runs the effect. When the bucket changes,
  // we send again. The endpoint is idempotent.
  const sent = useRef<NotificationBucket | null>(null)

  useEffect(() => {
    if (sent.current === bucket) return
    sent.current = bucket
    // Swallowed: the page loaded fine, and a badge that lingers one more visit
    // is not worth an error state.
    browserApiClient.post('/api/notifications/me/read', { bucket }).catch(() => {})
  }, [bucket])

  return null
}

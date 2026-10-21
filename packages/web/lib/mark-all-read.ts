import { apiClient } from '@/lib/api-client'
import type { Notification } from '@splat-connect/types'

/** Marks every unread notification read; returns how many PATCHes failed. */
export async function markAllRead(): Promise<number> {
  const rows = await apiClient.get<Notification[]>('/api/notifications/me')
  const results = await Promise.allSettled(
    rows.filter((n) => !n.read_at).map((n) => apiClient.patch(`/api/notifications/${n.id}`, { read: true })),
  )
  return results.filter((r) => r.status === 'rejected').length
}

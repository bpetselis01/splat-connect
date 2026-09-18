/**
 * Site content — the pages with no other owner.
 *
 * Guides, toys, events and stories are written by the people who made them.
 * These four sections are SPLAT's own.
 */
import { apiClient } from '@/lib/api-client'
import { SiteContentEditor, type ContentRow } from '@/components/site-content-editor'

export const metadata = { title: 'Site content — SPLAT Connect' }

export default async function AdminContentPage() {
  const rows = await apiClient
    .get<ContentRow[]>('/api/admin/content')
    .catch(() => [] as ContentRow[])

  return (
    <div>
      <h1 className="title-hub">Site content</h1>
      <p className="mb-6 mt-2 max-w-prose text-sm leading-relaxed text-muted">
        The pages with no other owner. Guides, toys, events and stories are written by the people
        who made them — these are ours.
      </p>
      <SiteContentEditor rows={rows} />
    </div>
  )
}

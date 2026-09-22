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
    <div className="max-w-[1000px]">
      <h1 className="title-hub">Site content</h1>
      <p className="mt-2.5 max-w-[62ch] text-[17px] leading-[1.55] text-muted">
        The pages with no other owner. Guides, toys, events and stories are written by the people
        who made them — these four are ours.
      </p>
      <SiteContentEditor rows={rows} />
    </div>
  )
}

import { BackLink } from '@/components/back-link'
import { notFound } from 'next/navigation'
import { apiClient } from '@/lib/api-client'
import { requireCapabilities } from '@/lib/require-capabilities'
import { ChildEditor } from '@/components/child-editor'
import type { ChildProfile } from '@splat-connect/types'

export default async function EditChildPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const caps = await requireCapabilities()

  // Reads the collection rather than one row: the heading labels an unnamed
  // child by its position among its siblings, which a single-row fetch cannot
  // tell us. RLS scopes the list to the caller, so a child missing from it is
  // either gone or someone else's — 404 either way.
  const children = await apiClient.get<ChildProfile[]>('/api/child-profiles')
  const index = children.findIndex((c) => c.id === id)
  if (index === -1) notFound()
  const child = children[index]
  // `name` is optional: an unnamed child is identified by its position in the
  // list, computed rather than stored so a delete leaves no gap in the numbering.
  const label = child.name?.trim() || `Child ${index + 1}`

  return (
    <div>
      <BackLink href="/dashboard/profile" label="Account" />
      <ChildEditor child={child} label={label} />
    </div>
  )
}

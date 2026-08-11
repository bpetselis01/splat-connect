import Link from 'next/link'
import { redirect, notFound } from 'next/navigation'
import { apiClient } from '@/lib/api-client'
import { getCapabilities } from '@/lib/capabilities'
import { childLabel } from '@/lib/child-label'
import { EditChildForm } from '@/components/edit-child-form'
import { DeleteChildButton } from '@/components/delete-child-button'
import type { ChildProfile } from '@splat-connect/types'

export default async function EditChildPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const caps = await getCapabilities()
  if (!caps) redirect('/login')

  // Reads the collection rather than one row: the heading labels an unnamed
  // child by its position among its siblings, which a single-row fetch cannot
  // tell us. RLS scopes the list to the caller, so a child missing from it is
  // either gone or someone else's — 404 either way.
  const children = await apiClient.get<ChildProfile[]>('/api/child-profiles')
  const index = children.findIndex((c) => c.id === id)
  if (index === -1) notFound()
  const child = children[index]
  const label = childLabel(child, index)

  return (
    <div>
      <Link href="/dashboard/child" className="mb-4 inline-block text-sm text-muted">
        ← Child profiles
      </Link>
      <h1 className="mb-6 text-2xl font-bold text-ink">{label}</h1>
      <EditChildForm child={child} />
      <div className="mt-8">
        {/* The heading's label doubles as the delete confirmation phrase, so the
            user reads the same identifier twice before the profile is gone. */}
        <DeleteChildButton id={child.id} label={label} />
      </div>
    </div>
  )
}

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { apiClient } from '@/lib/api-client'
import { getCapabilities } from '@/lib/capabilities'
import { childLabel } from '@/lib/child-label'
import type { ChildProfile } from '@splat-connect/types'

export default async function ChildListPage() {
  const caps = await getCapabilities()
  if (!caps) redirect('/login')

  // No .catch() here: an empty array is already the legitimate "no children yet"
  // value, so swallowing a fetch failure into the same empty array would tell a
  // parent their children are gone. Let a failed fetch throw into error.tsx.
  const children = await apiClient.get<ChildProfile[]>('/api/child-profiles')

  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold text-ink">Child profiles</h1>
      <p className="mb-6 max-w-prose text-sm leading-relaxed text-muted">
        This helps us suggest tutorials that suit your child. Everything is optional
        and only you can see it.
      </p>

      <ul className="mb-6 flex max-w-5xl flex-col gap-3">
        {children.map((child, i) => (
          <li key={child.id}>
            <Link href={`/dashboard/child/${child.id}`} className="card flex items-center justify-between p-4">
              <span className="font-bold text-ink">{childLabel(child, i)}</span>
              <span className="text-sm text-muted">
                {[child.age !== null ? `Age ${child.age}` : null, child.primary_diagnosis]
                  .filter(Boolean)
                  .join(' · ')}
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <Link href="/dashboard/child/new" className="btn btn-primary btn-sm">
        Add child
      </Link>
    </div>
  )
}

/**
 * Organisations directory.
 *
 * Exists so "Riverside Therapy backed this" is a name with something behind it —
 * for a contributor deciding who to ask, and for a parent reading a badge.
 *
 * Suspended organisations are listed and marked rather than hidden: one vanishing
 * from a directory is unexplainable to someone who expected to find it, and their
 * name is still on work they already backed.
 *
 * Related files:
 * - packages/api/src/routes/public.ts: GET /api/public/organizations
 * - app/organizations/[id]/page.tsx: one organisation, plus its leader's workspace
 * - components/edit-backing-section.tsx: where a contributor acts on this
 */
import Link from 'next/link'
import type { Organization } from '@splat-connect/types'

export default async function OrganizationsPage() {
  let orgs: Organization[] = []
  try {
    const res = await fetch(`${process.env.API_URL}/api/public/organizations`, {
      cache: 'no-store',
    })
    if (res.ok) orgs = await res.json()
  } catch {
    orgs = []
  }

  if (orgs.length === 0) {
    return (
      <div>
        <h1 className="mb-4 text-2xl font-bold text-ink">Organisations</h1>
        <div className="flex flex-col items-center px-6 py-16 text-center">
          <span aria-hidden="true" className="empty-badge">
            🏢
          </span>
          <p className="mt-4 font-bold text-ink">No organisations yet.</p>
          <p className="mt-1 max-w-xs text-sm leading-relaxed text-muted">
            Organisations are set up by SPLAT. Once one exists, you can ask it to
            back a project when you submit.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold text-ink">Organisations</h1>
      <p className="mb-6 max-w-prose text-sm leading-relaxed text-muted">
        Organisations review tutorials from contributors who ask them to. Their name
        on a tutorial means one of their leaders read it and stood behind it.
      </p>
      <div className="flex flex-col gap-3">
        {orgs.map((org) => (
          <Link
            key={org.id}
            href={`/organizations/${org.id}`}
            className="card card-link p-4"
          >
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <p className="text-sm font-bold text-ink">{org.name}</p>
              {org.status === 'suspended' && (
                <span className="badge bg-sunken text-muted">SUSPENDED</span>
              )}
            </div>
            {org.description && (
              <p className="mt-1 max-w-prose text-xs leading-relaxed text-muted">
                {org.description}
              </p>
            )}
          </Link>
        ))}
      </div>
    </div>
  )
}

/**
 * Dashboard Page — Account tab
 *
 * Body of the shared dashboard (app/dashboard/layout.tsx renders the tab strip
 * around it). Lets a signed-in account change its display name and manage its
 * child profiles; email and role are frozen at the database layer (see
 * components/profile-form.tsx).
 *
 * Child profiles moved in here from app/dashboard/child/page.tsx on
 * 2026-08-25: it isn't one of the rail's three pillars (a tutorial, a toy
 * exchange, a design challenge), it's account-level data, the same as the
 * notifications row already living in this group. The per-child routes
 * (/dashboard/child/[id], /dashboard/child/new) stay where they are — only
 * the list moved.
 */
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { apiClient } from '@/lib/api-client'
import { getCapabilities } from '@/lib/capabilities'
import { childLabel } from '@/lib/child-label'
import { ProfileForm } from '@/components/profile-form'
import { Child } from '@/components/icons'
import type { ChildProfile } from '@splat-connect/types'

export default async function ProfileTabPage() {
  const caps = await getCapabilities()
  if (!caps) redirect('/login')

  // No .catch() here: an empty array is already the legitimate "no children yet"
  // value, so swallowing a fetch failure into the same empty array would tell a
  // parent their children are gone. Let a failed fetch throw into error.tsx.
  const children = await apiClient.get<ChildProfile[]>('/api/child-profiles')

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-ink">Account</h1>
      <ProfileForm profile={caps.profile} />

      <div className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-line pt-8">
        <div>
          <h2 className="text-xl font-bold text-ink">Child profiles</h2>
          <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted">
            This helps us suggest tutorials that suit your children. Everything is
            optional and only you can see it.
          </p>
        </div>
        <Link href="/dashboard/child/new" className="btn btn-accent">
          + Add child
        </Link>
      </div>

      {children.length === 0 ? (
        <div className="mt-6 flex flex-col items-center px-6 py-12 text-center">
          <span aria-hidden="true" className="empty-badge text-brand-dark">
            <Child className="h-8 w-8" />
          </span>
          <p className="mt-4 font-bold text-ink">
            You haven&apos;t added any child profiles yet.
          </p>
          <p className="mt-1 max-w-xs text-sm leading-relaxed text-muted">
            A profile can include age, diagnosis and grip details — all optional, all
            private to you.
          </p>
          <Link href="/dashboard/child/new" className="btn btn-accent mt-6">
            Add your first child
          </Link>
        </div>
      ) : (
        <ul className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
          {children.map((child, i) => (
            <li key={child.id}>
              <Link
                href={`/dashboard/child/${child.id}`}
                className="card card-link flex h-full flex-col overflow-hidden"
              >
                {/* No CardPhoto: ChildProfile carries no photo field, and its
                    null-src fallback is a toy emoji, wrong here. */}
                <div className="flex flex-1 flex-col gap-1 p-4">
                  <p className="truncate text-sm font-bold text-ink">
                    {childLabel(child, i)}
                  </p>
                  {/* Clamped so one long diagnosis cannot stretch its row of cards,
                      same fix as the rejection note in dashboard-tutorial-card.tsx. Falls
                      back to a non-breaking space: an empty text node collapses to 0
                      height, squishing the card whenever no taller sibling shares its row. */}
                  <p className="truncate text-xs leading-relaxed text-muted">
                    {[child.age !== null ? `Age ${child.age}` : null, child.primary_diagnosis]
                      .filter(Boolean)
                      .join(' · ') || ' '}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

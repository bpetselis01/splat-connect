/**
 * Dashboard Page — Tutorials tab
 *
 * This is the Tutorials tab body of the shared dashboard (app/dashboard/layout.tsx
 * renders the tab strip around it). Accessible to any signed-in account.
 * Capability is derived rather than read from the role column — see lib/capabilities.ts.
 *
 * Features:
 * - Stats: Count of draft, pending, approved, rejected tutorials
 * - Recent tutorials list: Show status and links
 * - Quick links: Create new tutorial, view full list, etc.
 *
 * Data fetched:
 * 1. User profile (via apiClient.get('/api/contributors/me'))
 *    - Redirects to /login if the fetch fails (no valid session)
 * 2. User's tutorials (via apiClient.get('/api/tutorials/mine'))
 *    - Only tutorials user owns
 *    - All statuses (draft, pending, approved, rejected)
 *
 * Middleware protection (middleware.ts):
 * - Requires only a signed-in account, no particular role.
 * - If not authenticated → redirect to /login
 *
 * Tutorial status meanings:
 * - draft: Incomplete, can still edit
 * - pending: Submitted for review, awaiting admin decision
 * - approved: Admin approved, visible in public library
 * - rejected: Admin rejected, user can edit and resubmit
 *
 * The organisations a contributor leads used to be linked from a block at the
 * bottom of this page. That is now the Organisation tab (app/dashboard/organisation),
 * which shows the review queue itself rather than a link out to it.
 *
 * Related files:
 * - routes/tutorials.ts: Fetch /api/tutorials/mine
 * - routes/contributors.ts: Fetch /api/contributors/me
 * - app/my-tutorials: Full list of tutorials
 * - app/upload: Create new tutorial
 * - app/admin: Admin dashboard (for admins)
 */
import { apiClient } from '@/lib/api-client'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { DifficultyBadge } from '@/components/difficulty-badge'
import { StatusBadge } from '@/components/status-badge'
import { BackingSummary } from '@/components/backing-state'
import { BookOpen } from '@/components/icons'
import type { Tutorial, Difficulty, Profile, TutorialOrg } from '@splat-connect/types'

export default async function DashboardPage() {
  try {
    await apiClient.get<Profile>('/api/contributors/me')
  } catch {
    redirect('/login')
  }

  const tutorials = await apiClient.get<(Tutorial & { tutorial_orgs?: TutorialOrg[] })[]>(
    '/api/tutorials/mine'
  )

  const pendingCount = tutorials.filter((t) => t.status === 'pending').length
  const approvedCount = tutorials.filter((t) => t.status === 'approved').length
  const rejectedCount = tutorials.filter((t) => t.status === 'rejected').length
  const recentTutorials = tutorials.slice(0, 5)

  const stats = [
    { label: 'Pending', count: pendingCount, tone: 'text-honey-deep' },
    { label: 'Approved', count: approvedCount, tone: 'text-mint-deep' },
    { label: 'Rejected', count: rejectedCount, tone: 'text-apricot-deep' },
  ]

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-ink">Dashboard</h1>
        <Link href="/upload" className="btn btn-accent">
          + New tutorial
        </Link>
      </div>

      {/* One strip rather than three big-number cards — these counts are a
          summary of the list below, not the point of the page. */}
      <div className="card mb-8 grid grid-cols-3 divide-x divide-line">
        {stats.map((s) => (
          <div
            key={s.label}
            data-testid={`stat-${s.label.toLowerCase()}`}
            className="px-4 py-5 text-center"
          >
            <p className={`text-2xl font-bold ${s.tone}`}>{s.count}</p>
            <p className="mt-1 text-sm font-semibold text-muted">{s.label}</p>
          </div>
        ))}
      </div>

      <h2 className="mb-3 text-lg font-bold text-ink">Recent tutorials</h2>

      {recentTutorials.length === 0 ? (
        <div className="flex flex-col items-center px-6 py-12 text-center">
          <span aria-hidden="true" className="empty-badge text-brand-dark">
            <BookOpen className="h-8 w-8" />
          </span>
          <p className="mt-4 font-bold text-ink">
            You haven&apos;t submitted any tutorials yet.
          </p>
          <p className="mt-1 max-w-xs text-sm leading-relaxed text-muted">
            A tutorial is a PDF guide plus the parts and tools a parent needs to
            adapt one toy.
          </p>
          <Link href="/upload" className="btn btn-accent mt-6">
            Upload your first tutorial
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {recentTutorials.map((t) => (
            <div
              key={t.id}
              className="card flex flex-wrap items-center justify-between gap-4 p-4"
            >
              <div className="flex min-w-0 items-center gap-3">
                <DifficultyBadge difficulty={t.difficulty as Difficulty} />
                <div className="min-w-0">
                  <p className="text-sm font-bold text-ink">{t.title}</p>
                  {t.status === 'rejected' && (
                    <p className="mt-0.5 text-xs leading-relaxed text-danger">
                      {t.rejection_note ?? 'No feedback was provided.'}
                    </p>
                  )}
                  <BackingSummary backing={t.tutorial_orgs ?? []} />
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <Link
                  href={`/tutorials/${t.id}/edit`}
                  className="btn btn-soft btn-sm"
                >
                  Edit
                </Link>
                <StatusBadge status={t.status} />
              </div>
            </div>
          ))}
          {/* WHY: since the nav dropped its /my-tutorials link, this is the only click
              path left to that page — gate on >0, not >5, or a small account has no
              way to get there at all. */}
          {tutorials.length > 0 && (
            <Link
              href="/my-tutorials"
              className="pt-1 text-center text-sm font-semibold text-brand-dark hover:underline"
            >
              View all {tutorials.length} tutorials →
            </Link>
          )}
        </div>
      )}
    </div>
  )
}

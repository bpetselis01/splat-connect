/**
 * Contributor Dashboard Page
 * 
 * Hub for contributors to manage their tutorials.
 * Only accessible to signed-in contributors (role='contributor').
 * 
 * Features:
 * - Stats: Count of draft, pending, approved, rejected tutorials
 * - Recent tutorials list: Show status and links
 * - Quick links: Create new tutorial, view full list, etc.
 * 
 * Data fetched:
 * 1. User profile (via apiClient.get('/api/contributors/me'))
 *    - Validates user is contributor role
 *    - Redirects to home if not contributor
 * 2. User's tutorials (via apiClient.get('/api/tutorials/mine'))
 *    - Only tutorials user owns
 *    - All statuses (draft, pending, approved, rejected)
 * 
 * Middleware protection (middleware.ts):
 * - Requires authenticated user (role='contributor')
 * - If not authenticated → redirect to /login
 * 
 * Tutorial status meanings:
 * - draft: Incomplete, can still edit
 * - pending: Submitted for review, awaiting admin decision
 * - approved: Admin approved, visible in public library
 * - rejected: Admin rejected, user can edit and resubmit
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
import type { Tutorial, Difficulty, Profile, Organization } from '@splat-connect/types'

export default async function DashboardPage() {
  let profile: Profile
  try {
    profile = await apiClient.get<Profile>('/api/contributors/me')
  } catch {
    redirect('/login')
  }

  if (profile!.role !== 'contributor') redirect('/')

  const tutorials = await apiClient.get<Tutorial[]>('/api/tutorials/mine')

  // Organisations the caller LEADS, not ones they belong to — there is no
  // membership in this model. Most contributors lead none, so the section below
  // renders nothing at all rather than an empty box.
  const ledOrgs = await apiClient
    .get<Organization[]>('/api/organizations/mine')
    .catch(() => [] as Organization[])

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
          <span aria-hidden="true" className="empty-badge">
            📘
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
          {tutorials.length > 5 && (
            <Link
              href="/my-tutorials"
              className="pt-1 text-center text-sm font-semibold text-brand-dark hover:underline"
            >
              View all {tutorials.length} tutorials →
            </Link>
          )}
        </div>
      )}

      {ledOrgs.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-3 text-lg font-semibold text-ink">Organisations you lead</h2>
          <div className="flex flex-col gap-2">
            {ledOrgs.map((org) => (
              <Link key={org.id} href={`/org/${org.id}`} className="card card-link p-4">
                <p className="text-sm font-bold text-ink">{org.name}</p>
                <p className="text-xs text-muted">
                  {org.status === 'active'
                    ? 'Review projects offered to this organisation'
                    : 'Suspended — you can look, but not approve'}
                </p>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

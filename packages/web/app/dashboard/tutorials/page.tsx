import Link from 'next/link'
import { apiClient } from '@/lib/api-client'
import { redirect } from 'next/navigation'
import { DashboardTutorialCard } from '@/components/dashboard-tutorial-card'
import { BookOpen } from '@/components/icons'
import { BoundaryLink } from '@/components/boundary-link'
import { MarkNotificationsRead } from '@/components/mark-notifications-read'
import type { Tutorial, Profile, TutorialOrg } from '@splat-connect/types'

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

  const stats = [
    { label: 'Pending', count: pendingCount, tone: 'text-honey-deep' },
    { label: 'Approved', count: approvedCount, tone: 'text-mint-deep' },
    { label: 'Rejected', count: rejectedCount, tone: 'text-apricot-deep' },
  ]

  return (
    <div>
      <MarkNotificationsRead bucket="tutorials" />

      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="title-hub">My tutorials</h1>
          <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted">
            Your adaptation guides. Each one is reviewed — by an organisation you ask, or by
            SPLAT — before it reaches the library.
          </p>
        </div>
        {/* The My SPLAT card promises three things here. Two of them exist;
            "Saved tutorials" waits on the saves subsystem, and an absent
            button beats one that leads nowhere. */}
        <div className="flex flex-wrap gap-3">
          <BoundaryLink href="/upload" className="btn btn-accent">
            + New tutorial
          </BoundaryLink>
          <BoundaryLink href="/library" className="btn btn-quiet">
            Browse the library
          </BoundaryLink>
          {/* The tag on this page's My SPLAT card names "saved tutorials";
              this is where that tag leads. It skips the saved hub on purpose —
              the label names a destination, so it lands on the destination. */}
          <Link href="/dashboard/saved/tutorials" className="btn btn-quiet">
            Saved tutorials
          </Link>
        </div>
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

      {tutorials.length === 0 ? (
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
          <BoundaryLink href="/upload" className="btn btn-accent mt-6">
            Upload your first tutorial
          </BoundaryLink>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
          {tutorials.map((t) => (
            <li key={t.id}>
              <DashboardTutorialCard tutorial={t} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

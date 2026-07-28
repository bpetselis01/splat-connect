import { apiClient } from '@/lib/api-client'
import Link from 'next/link'
import { DifficultyBadge } from '@/components/difficulty-badge'
import { StatusBadge } from '@/components/status-badge'
import { BackingSummary } from '@/components/backing-state'
import type { Tutorial, TutorialOrg, Difficulty } from '@splat-connect/types'

/** GET /api/tutorials/mine embeds the backing rows. */
type Backed = Tutorial & { tutorial_orgs?: TutorialOrg[] }

export default async function MyTutorialsPage() {
  const tutorials = await apiClient.get<Backed[]>('/api/tutorials/mine')

  if (tutorials.length === 0) {
    return (
      <div className="flex flex-col items-center px-6 py-16 text-center">
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
    )
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-ink">My tutorials</h1>
        <Link href="/upload" className="btn btn-accent">
          + New tutorial
        </Link>
      </div>
      <div className="flex flex-col gap-3">
        {tutorials.map((t) => (
          <div
            key={t.id}
            data-testid="tutorial-row"
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
              <Link href={`/tutorials/${t.id}/edit`} className="btn btn-soft btn-sm">
                Edit
              </Link>
              <StatusBadge status={t.status} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

import Link from 'next/link'
import { apiClient } from '@/lib/api-client'
import { DifficultyBadge } from '@/components/difficulty-badge'
import type { Tutorial, Difficulty } from '@splat-connect/types'

export default async function ReviewListPage() {
  const tutorials = await apiClient.get<Tutorial[]>('/api/admin/tutorials?status=pending')

  if (tutorials.length === 0) {
    return (
      <div>
        <h1 className="mb-4 text-2xl font-bold text-ink">Tutorial review queue</h1>
        <div className="flex flex-col items-center px-6 py-16 text-center">
          <span aria-hidden="true" className="empty-badge">
            ☕
          </span>
          <p className="mt-4 font-bold text-ink">No tutorials pending review.</p>
          <p className="mt-1 max-w-xs text-sm leading-relaxed text-muted">
            Submissions land here the moment a contributor sends one for review.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-ink">Tutorial review queue</h1>
      <div className="flex flex-col gap-3">
        {tutorials.map((t) => (
          <Link
            key={t.id}
            href={`/admin/review/${t.id}`}
            className="card card-link flex items-center justify-between gap-4 p-4"
          >
            <div className="flex items-center gap-3">
              <DifficultyBadge difficulty={t.difficulty as Difficulty} />
              <div>
                <p className="text-sm font-bold text-ink">{t.title}</p>
                <p className="text-xs text-muted">
                  Submitted {new Date(t.created_at).toLocaleDateString()}
                </p>
              </div>
            </div>
            <span className="shrink-0 text-sm font-semibold text-brand-dark">Review →</span>
          </Link>
        ))}
      </div>
    </div>
  )
}

import Link from 'next/link'
import { apiClient } from '@/lib/api-client'
import { DifficultyBadge } from '@/components/difficulty-badge'
import type { Tutorial, Difficulty } from '@splat-connect/types'

export default async function ReviewListPage() {
  const tutorials = await apiClient.get<Tutorial[]>('/api/admin/tutorials?status=pending')

  if (tutorials.length === 0) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-4">Tutorial review queue</h1>
        <p className="text-gray-400">No tutorials pending review.</p>
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Tutorial review queue</h1>
      <div className="flex flex-col gap-3">
        {tutorials.map((t) => (
          <Link
            key={t.id}
            href={`/admin/review/${t.id}`}
            className="bg-white border rounded-xl p-4 flex items-center justify-between hover:shadow-md transition-shadow"
          >
            <div className="flex items-center gap-3">
              <DifficultyBadge difficulty={t.difficulty as Difficulty} />
              <div>
                <p className="font-semibold text-sm">{t.title}</p>
                <p className="text-xs text-gray-400">
                  Submitted {new Date(t.created_at).toLocaleDateString()}
                </p>
              </div>
            </div>
            <span className="text-xs text-gray-400">Review →</span>
          </Link>
        ))}
      </div>
    </div>
  )
}

import { apiClient } from '@/lib/api-client'
import Link from 'next/link'
import { DifficultyBadge } from '@/components/difficulty-badge'
import type { Tutorial, TutorialStatus, Difficulty } from '@splat-connect/types'

const statusStyles: Record<TutorialStatus, string> = {
  draft: 'bg-gray-100 text-gray-600',
  pending: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
}

export default async function MyTutorialsPage() {
  const tutorials = await apiClient.get<Tutorial[]>('/api/tutorials/mine')

  if (tutorials.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-400 mb-4">You haven&apos;t submitted any tutorials yet.</p>
        <Link
          href="/upload"
          className="inline-block bg-orange-500 text-white px-6 py-2 rounded-lg text-sm font-semibold hover:bg-orange-600"
        >
          Upload your first tutorial
        </Link>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">My tutorials</h1>
        <Link
          href="/upload"
          className="bg-orange-500 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-orange-600"
        >
          + New tutorial
        </Link>
      </div>
      <div className="flex flex-col gap-3">
        {tutorials.map((t) => (
          <div
            key={t.id}
            className="bg-white border rounded-xl p-4 flex items-center justify-between gap-4"
          >
            <div className="flex items-center gap-3">
              <DifficultyBadge difficulty={t.difficulty as Difficulty} />
              <div>
                <p className="font-semibold text-sm">{t.title}</p>
                {t.rejection_note && (
                  <p className="text-xs text-red-600 mt-0.5">
                    Feedback: {t.rejection_note}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Link
                href={`/tutorials/${t.id}/edit`}
                className="text-xs font-semibold text-blue-600 hover:underline"
              >
                Edit
              </Link>
              <span
                className={`text-xs font-bold px-2 py-1 rounded-full ${statusStyles[t.status]}`}
              >
                {t.status.toUpperCase()}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

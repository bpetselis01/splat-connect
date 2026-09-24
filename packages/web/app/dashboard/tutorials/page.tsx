import Link from 'next/link'
import { BookOpen, Plus } from '@phosphor-icons/react/dist/ssr'
import { apiClient } from '@/lib/api-client'
import { requireCapabilities } from '@/lib/require-capabilities'
import { DashboardTutorialCard, TUTORIAL_STAGE } from '@/components/dashboard-tutorial-card'
import { StageFilter, StageNone, STAGE } from '@/components/stage'
import { BoundaryLink } from '@/components/boundary-link'
import { MarkNotificationsRead } from '@/components/mark-notifications-read'
import type { Tutorial, TutorialOrg } from '@splat-connect/types'

const BASE = '/dashboard/tutorials'

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ stage?: string }>
} = {}) {
  await requireCapabilities()
  const stage = (await searchParams)?.stage ?? 'all'

  const tutorials = await apiClient.get<(Tutorial & { tutorial_orgs?: TutorialOrg[] })[]>(
    '/api/tutorials/mine'
  )

  // The board's stage track, in its order. "Draft" rather than "Hidden" for a
  // guide: the editor calls it a draft, and so does everything a contributor reads.
  const count = (id: string) => tutorials.filter((t) => TUTORIAL_STAGE[t.status] === id).length
  const options = [
    { id: 'all', label: 'All', n: tutorials.length },
    { id: 'needsyou', label: STAGE.needsyou.label, n: count('needsyou') },
    { id: 'live', label: STAGE.live.label, n: count('live') },
    { id: 'waiting', label: STAGE.waiting.label, n: count('waiting') },
    { id: 'hidden', label: 'Draft', n: count('hidden') },
  ]
  const current = options.some((o) => o.id === stage) ? stage : 'all'
  const shown =
    current === 'all' ? tutorials : tutorials.filter((t) => TUTORIAL_STAGE[t.status] === current)

  return (
    <div>
      <MarkNotificationsRead bucket="tutorials" />

      <div className="mb-[26px] flex flex-wrap items-end justify-between gap-5">
        <div>
          <h1 className="title-hub">My tutorials</h1>
          <p className="mt-2 max-w-[58ch] text-[15px] text-muted">
            Guides you have written, at every stage from draft to published.
          </p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <BoundaryLink href="/upload" className="btn btn-coral">
            <Plus size={16} weight="bold" aria-hidden="true" />
            Add a tutorial
          </BoundaryLink>
          {/* Skips the saved hub on purpose — the label names a destination,
              so it lands on the destination. */}
          <Link href="/dashboard/saved/tutorials" className="btn btn-quiet">
            Saved tutorials
          </Link>
        </div>
      </div>

      {tutorials.length === 0 ? (
        <div className="flex flex-col items-center px-6 py-12 text-center">
          <span aria-hidden="true" className="empty-badge text-brand-dark">
            <BookOpen className="h-8 w-8" weight="bold" aria-hidden="true" />
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
        <>
          <div className="mb-[22px]">
            <StageFilter
              label="Filter tutorials by stage"
              basePath={BASE}
              current={current}
              options={options}
            />
          </div>
          {shown.length === 0 ? (
            <StageNone basePath={BASE} note="None of your guides are at that stage right now." />
          ) : (
            <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
              {shown.map((t) => (
                <li key={t.id}>
                  <DashboardTutorialCard tutorial={t} />
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  )
}

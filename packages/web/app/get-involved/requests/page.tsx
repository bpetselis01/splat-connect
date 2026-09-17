/**
 * Adaptation requests — the door into asking somebody to build a guide for you.
 *
 * Was a ComingSoon placeholder. 057 makes the thing real, so the placeholder
 * goes: a signed-in visitor sees their own open build requests and a way to
 * start another; a signed-out one sees what it is and how to begin.
 *
 * Deliberately not a public board of every open request: that is
 * /get-involved/makers-wanted, which 064 unblocked by making a request with no
 * maker on it legal. This page is the ADDRESSED half — the requests you sent to
 * one person or one organisation, and the way to send another.
 */
import Link from 'next/link'
import { Hammer } from '@phosphor-icons/react/dist/ssr'
import { getCapabilities } from '@/lib/capabilities'
import { apiClient } from '@/lib/api-client'
import { RecordCard } from '@/components/record-card'
import { Badge } from '@/components/badge'
import { buildStages } from '@/lib/build-stages'
import { subjectName } from '@splat-connect/types'
import type { ToyTransactionSummary } from '@splat-connect/types'

export const metadata = { title: 'Adaptation requests — SPLAT Connect' }

export default async function AdaptationRequestsPage() {
  const caps = await getCapabilities()

  let mine: ToyTransactionSummary[] = []
  if (caps) {
    const all = await apiClient
      .get<ToyTransactionSummary[]>('/api/toy-transactions')
      .catch(() => [] as ToyTransactionSummary[])
    mine = all.filter((tx) => tx.type === 'build')
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="title-detail">Adaptation requests</h1>
      <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted">
        Ask a maker to build one of our guides for your child.
      </p>

      <div className="mt-6 flex flex-wrap gap-3">
        {caps ? (
          <Link href="/get-involved/requests/new" className="btn btn-primary no-underline">
            <Hammer size={18} weight="bold" aria-hidden="true" />
            Ask for a build
          </Link>
        ) : (
          <Link href="/signup" className="btn btn-primary no-underline">
            Create an account to ask
          </Link>
        )}
        <Link href="/get-involved/makers-wanted" className="btn btn-quiet no-underline">
          The open board
        </Link>
        <Link href="/library" className="btn btn-quiet no-underline">
          Browse the guides
        </Link>
      </div>

      <ol className="mt-8 flex list-none flex-col gap-3">
        {/* One clause each, per §6. */}
        {[
          'Pick a guide and say who it is for',
          'A maker takes it on, or declines',
          'They post a photo of it working, and you approve it',
          'You meet, read out your codes, and it is done',
        ].map((step, i) => (
          <li key={step} className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-tint text-sm font-bold text-brand-deep"
            >
              {i + 1}
            </span>
            <span className="text-sm leading-relaxed text-ink">{step}</span>
          </li>
        ))}
      </ol>

      {mine.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-3 text-lg font-bold text-ink">Your build requests</h2>
          <ul className="flex flex-col gap-3">
            {mine.map((tx) => (
              <li key={tx.id}>
                <RecordCard
                  icon={<Hammer size={22} weight="duotone" />}
                  tint="var(--tamber)"
                  title={subjectName(tx)}
                  meta={`Build with ${tx.other_party_name} · ${new Date(
                    tx.created_at
                  ).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}`}
                  pill={<Badge status={tx.status} />}
                  stages={buildStages(tx)}
                  primary={
                    <Link
                      href={`/dashboard/exchanges/build/${tx.id}`}
                      className="btn btn-primary no-underline"
                    >
                      Thread
                    </Link>
                  }
                />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

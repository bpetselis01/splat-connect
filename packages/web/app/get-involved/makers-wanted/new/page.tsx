/**
 * Ask for a build — the open version.
 *
 * Mirrors /toy-library/[id]/request in shape: pick the guide, say who it is
 * for, agree how far you can travel. The note is the only free text.
 *
 * What it does NOT ask for is a maker. That is the whole difference between
 * this and /get-involved/requests/new, which addresses one person or one
 * organisation: this posts to the board and waits. 064 is what makes a request
 * with nobody on the other end of it legal.
 *
 * Related files:
 * - components/ask-openly-form.tsx: the form
 * - packages/api/src/routes/toy-transactions.ts: POST /build with no maker
 */
import { requireCapabilities } from '@/lib/require-capabilities'
import { apiClient } from '@/lib/api-client'
import { AskOpenlyForm } from '@/components/ask-openly-form'
import type { Tutorial } from '@splat-connect/types'

export const metadata = { title: 'Ask for a build — SPLAT Connect' }

export default async function AskOpenlyPage({
  searchParams,
}: {
  searchParams: Promise<{ guide?: string }>
}) {
  await requireCapabilities()
  const { guide } = await searchParams
  const tutorials = await apiClient
    .get<Tutorial[]>('/api/public/tutorials')
    .catch(() => [] as Tutorial[])

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="title-article">Ask a maker nearby to build it</h1>
      <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted">
        Pick the guide, say who it is for, and agree how far you can travel. A maker nearby
        claims it — you do not have to find one yourself.
      </p>
      <AskOpenlyForm
        tutorials={tutorials.map((t) => ({ id: t.id, title: t.title }))}
        initialGuide={guide}
      />
    </div>
  )
}

import { LibraryClient, type LibraryStats } from './library-client'
import { getSavedIds } from '@/lib/saves'
import type { Tutorial } from '@splat-connect/types'

/** A failed fetch is an empty answer, never a 500 — see the guard below. */
async function get<T>(path: string, fallback: T): Promise<T> {
  try {
    const res = await fetch(`${process.env.API_URL}${path}`, { cache: 'no-store' })
    return res.ok ? ((await res.json()) as T) : fallback
  } catch {
    return fallback
  }
}

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>
}) {
  // The header's search box submits here as ?q=.
  const { q } = await searchParams

  // Same connection-failure guard as app/page.tsx: an unreachable API degrades
  // to the library's empty state rather than a 500. The stats degrade to the
  // one number the page can count for itself (see LibraryClient).
  const [tutorials, stats, saved] = await Promise.all([
    get<Tutorial[]>('/api/public/tutorials', []),
    get<LibraryStats | null>('/api/public/tutorials/stats', null),
    // null means signed out, which is what the cards pass on as signedIn — the
    // button still renders, it just routes to /signup instead of saving.
    getSavedIds(),
  ])

  return (
    <LibraryClient
      tutorials={tutorials}
      stats={stats}
      savedIds={saved?.tutorials ?? []}
      signedIn={saved !== null}
      initialSearch={typeof q === 'string' ? q : ''}
    />
  )
}

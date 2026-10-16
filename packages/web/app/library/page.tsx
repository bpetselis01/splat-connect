import { LibraryClient, type LibraryStats } from './library-client'
import { getSavedIds } from '@/lib/saves'
import { getMyChildren } from '@/lib/my-children'
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

  // Recommended puts the first child's matches first (guide-tags spec); only
  // their answers reach the client, not the whole profile.
  const first = saved ? (await getMyChildren())[0] : undefined
  const child = first
    ? {
        helps_with: first.helps_with,
        access: first.access,
        one_hand: first.one_hand,
        press_force: first.press_force,
        enjoys: first.enjoys,
      }
    : null

  return (
    <LibraryClient
      child={child}
      tutorials={tutorials}
      stats={stats}
      savedIds={saved?.tutorials ?? []}
      signedIn={saved !== null}
      initialSearch={typeof q === 'string' ? q : ''}
    />
  )
}

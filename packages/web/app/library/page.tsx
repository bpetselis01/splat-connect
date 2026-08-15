import { LibraryClient } from './library-client'
import type { Tutorial } from '@splat-connect/types'

export default async function LibraryPage() {
  // Same connection-failure guard as app/page.tsx: an unreachable API degrades
  // to the library's empty state rather than a 500.
  let tutorials: Tutorial[] = []
  try {
    const res = await fetch(`${process.env.API_URL}/api/public/tutorials`, { cache: 'no-store' })
    if (res.ok) tutorials = await res.json()
  } catch {
    tutorials = []
  }

  return <LibraryClient tutorials={tutorials} />
}

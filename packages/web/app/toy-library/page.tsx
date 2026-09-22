import { ToyLibraryClient } from './toy-library-client'
import { getSavedIds } from '@/lib/saves'
import type { ImpactSummary, ToyWithOwner } from '@splat-connect/types'

export default async function ToyLibraryPage() {
  let toys: ToyWithOwner[] = []
  try {
    const res = await fetch(`${process.env.API_URL}/api/public/toys`, { cache: 'no-store' })
    if (res.ok) toys = await res.json()
  } catch {
    toys = []
  }

  const [saved, delivered] = await Promise.all([
    getSavedIds(),
    // The hero's first figure, as the board has it. Unreachable degrades to
    // null and the hero falls back to a count it can make itself.
    fetch(`${process.env.API_URL}/api/public/impact`, { cache: 'no-store' })
      .then((r) => (r.ok ? (r.json() as Promise<ImpactSummary>) : null))
      .then((i) => i?.totals.toysDelivered ?? null)
      .catch(() => null),
  ])

  return (
    <ToyLibraryClient
      toys={toys}
      delivered={delivered}
      savedIds={saved?.toys ?? []}
      signedIn={saved !== null}
    />
  )
}

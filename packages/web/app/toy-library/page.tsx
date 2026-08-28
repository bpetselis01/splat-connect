import { ToyLibraryClient } from './toy-library-client'
import { getSavedIds } from '@/lib/saves'
import type { ToyWithOwner } from '@splat-connect/types'

export default async function ToyLibraryPage() {
  let toys: ToyWithOwner[] = []
  try {
    const res = await fetch(`${process.env.API_URL}/api/public/toys`, { cache: 'no-store' })
    if (res.ok) toys = await res.json()
  } catch {
    toys = []
  }

  const saved = await getSavedIds()

  return (
    <ToyLibraryClient toys={toys} savedIds={saved?.toys ?? []} signedIn={saved !== null} />
  )
}

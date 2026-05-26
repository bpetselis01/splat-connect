import { LibraryClient } from './library-client'
import type { Tutorial } from '@splat-connect/types'

export default async function LibraryPage() {
  const res = await fetch(`${process.env.API_URL}/api/public/tutorials`, { cache: 'no-store' })
  const tutorials: Tutorial[] = res.ok ? await res.json() : []

  return <LibraryClient tutorials={tutorials} />
}

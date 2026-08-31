/**
 * getCapabilities(), narrowed to non-null.
 *
 * Every /dashboard page opened with `const caps = await getCapabilities(); if
 * (!caps) redirect('/login')`. That guard is not the access control —
 * middleware.ts bounces a sessionless /dashboard request before the page ever
 * runs — it only narrows the type, and it was copied into a dozen files. The
 * redirect stays because a signed-in session whose profile fetch fails still
 * reaches here, and an empty dashboard is worse than a login page.
 *
 * Deliberately not in lib/capabilities.ts: that module is pure data fetching
 * with no next/navigation import, and a dozen page tests replace it wholesale
 * with a two-line vi.mock.
 */
import { redirect } from 'next/navigation'
import { getCapabilities, type Capabilities } from '@/lib/capabilities'

export async function requireCapabilities(): Promise<Capabilities> {
  const caps = await getCapabilities()
  if (!caps) redirect('/login')
  return caps
}

/**
 * The child profile wizard.
 *
 * Under /onboarding rather than /dashboard, and that placement is load-bearing:
 * app/layout.tsx's BARE_PREFIXES strips the header and footer from everything
 * there, which is what makes this five questions on a page rather than five
 * questions inside a site.
 *
 * Reachable at any time, not only at signup — a parent who skipped it can come
 * back, and one who has a profile already gets it loaded rather than a second
 * blank one.
 */
import { redirect } from 'next/navigation'
import { apiClient } from '@/lib/api-client'
import { getCapabilities } from '@/lib/capabilities'
import { ChildWizard } from '@/components/child-wizard'
import type { ChildProfile } from '@splat-connect/types'

export const metadata = { title: 'Child profile — SPLAT Connect' }

export default async function ChildWizardPage() {
  const caps = await getCapabilities()
  if (!caps) redirect(`/login?next=${encodeURIComponent('/onboarding/child')}`)

  const children = await apiClient
    .get<ChildProfile[]>('/api/child-profiles')
    .catch(() => [] as ChildProfile[])

  return (
    <div className="mx-auto max-w-4xl">
      <ChildWizard child={children[0] ?? null} />
    </div>
  )
}

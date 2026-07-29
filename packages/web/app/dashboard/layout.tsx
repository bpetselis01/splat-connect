/**
 * Shared shell for every dashboard tab. One dashboard serves every non-admin
 * account; which tabs appear is derived from what the user can do rather
 * than from a role — see lib/capabilities.ts.
 *
 * The strip is an affordance, not a control: hiding a tab here only saves a
 * pointless click. Each tab's own page re-checks its own access — see
 * lib/org-access.ts for the same rule stated about organisations.
 *
 * Related files:
 * - components/dashboard-tabs.tsx: the presentational strip
 * - components/dashboard-nav.tsx: client wrapper supplying the pathname
 * - app/dashboard/organisation: the only tab that is conditionally shown
 */
import { redirect } from 'next/navigation'
import { getCapabilities } from '@/lib/capabilities'
import { DashboardNav } from '@/components/dashboard-nav'
import type { DashboardTab } from '@/components/dashboard-tabs'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const caps = await getCapabilities()
  if (!caps) {
    redirect('/login')
  }

  const tabs: DashboardTab[] = [
    // Every signed-in account may author (009 widened is_approved_contributor).
    { href: '/dashboard', label: 'Tutorials' },
    // Leadership cannot be self-started — an admin grants it — so an empty
    // state here would offer something the visitor cannot obtain.
    ...(caps.ledOrgs.length > 0
      ? [{ href: '/dashboard/organisation', label: 'Organisation' }]
      : []),
    // Shown even to non-parents: gating on isParent would mean the only way
    // to create a child profile is to already have one.
    { href: '/dashboard/child', label: 'Child profile' },
    { href: '/dashboard/profile', label: 'Profile' },
  ]

  return (
    <div>
      <DashboardNav tabs={tabs} />
      {children}
    </div>
  )
}

/**
 * Thin client wrapper around DashboardTabs. app/dashboard/layout.tsx is a
 * server component (it awaits getCapabilities()) and cannot call
 * usePathname() itself, so this component — the established pattern in
 * components/nav.tsx — supplies the real pathname at the client boundary.
 * DashboardTabs stays pure and testable with an injected pathname prop.
 */
'use client'
import { usePathname } from 'next/navigation'
import { DashboardTabs, type DashboardTab } from '@/components/dashboard-tabs'

export function DashboardNav({ tabs }: { tabs: DashboardTab[] }) {
  // Null outside an App Router context, same as nav.tsx.
  const pathname = usePathname() ?? ''
  return <DashboardTabs tabs={tabs} pathname={pathname} />
}

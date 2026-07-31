/**
 * The signed-in app shell. Renders nothing for a signed-out visitor, who keeps
 * the top bar (components/nav.tsx) instead.
 *
 * getCapabilities() is wrapped in React cache(), so calling it here and again
 * inside a page costs one round of fetches.
 *
 * ponytail: every signed-in page now pays for /api/child-profile and
 * /api/organizations/mine, and the rail reads neither isParent nor the org
 * bodies — only ledOrgs.length. If it measures, add a narrower
 * getNavCapabilities() that fetches just what the rail branches on.
 */
import { cookies } from 'next/headers'
import { getCapabilities } from '@/lib/capabilities'
import { buildNav } from '@/lib/nav-model'
import { ShellFrame } from '@/components/shell-frame'
import { RAIL_COOKIE } from '@/lib/rail-cookie'

export async function AppShell({ children }: { children: React.ReactNode }) {
  const caps = await getCapabilities()
  if (!caps) return null

  const store = await cookies()
  const collapsed = store.get(RAIL_COOKIE)?.value === '1'

  return (
    <ShellFrame groups={buildNav(caps)} collapsed={collapsed}>
      {children}
    </ShellFrame>
  )
}

/**
 * The signed-in app shell. Renders nothing for a signed-out visitor, who keeps
 * the top bar (components/nav.tsx) instead.
 *
 * getCapabilities() is wrapped in React cache(), so calling it here and again
 * inside a page costs one round of fetches.
 *
 * ponytail: every signed-in page pays for the one remaining sub-fetch,
 * /api/organizations/mine, and the rail reads only ledOrgs.length from it.
 * Narrowing that to a count endpoint would need an API change; the unread
 * /api/child-profile fetch that used to sit beside it is gone.
 */
import { cookies } from 'next/headers'
import { getCapabilities } from '@/lib/capabilities'
import { buildNav } from '@/lib/nav-model'
import { ShellFrame } from '@/components/shell-frame'
import { RAIL_COOKIE } from '@/lib/rail-cookie'

export async function AppShell({
  children,
  footer,
}: {
  children: React.ReactNode
  footer?: React.ReactNode
}) {
  const caps = await getCapabilities()
  if (!caps) return null

  const store = await cookies()
  const collapsed = store.get(RAIL_COOKIE)?.value === '1'

  return (
    <ShellFrame
      groups={buildNav(caps, caps.unreadNotifications)}
      collapsed={collapsed}
      footer={footer}
    >
      {children}
    </ShellFrame>
  )
}

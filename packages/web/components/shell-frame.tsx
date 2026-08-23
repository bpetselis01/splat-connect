/**
 * Owns the two pieces of shell state the server cannot: whether the desktop
 * rail is collapsed, and whether the mobile drawer is open.
 *
 * The collapsed flag arrives as a prop read from a cookie on the server, so the
 * first paint is already correct. Reading it from localStorage in an effect
 * would render expanded and then snap — the class of bug fixed on mobile in
 * 11d1bb1 ("stop the contributor-terms gate flashing").
 */
'use client'
import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Rail } from '@/components/rail'
import { Breadcrumb } from '@/components/breadcrumb'
import { useDrawer } from '@/components/drawer-context'
import type { NavGroup } from '@/lib/nav-model'
// Re-exported (not defined here): a plain constant exported straight from a
// 'use client' file is unreadable from server code — see lib/rail-cookie.ts.
import { RAIL_COOKIE } from '@/lib/rail-cookie'

export function ShellFrame({
  groups,
  collapsed: initialCollapsed,
  footer,
  children,
}: {
  groups: NavGroup[]
  collapsed: boolean
  /** Rendered inside .shell-main, below <main>, so it picks up the same
      margin-inline-start offset that keeps main content clear of the rail —
      rendering it outside .shell-main (as app/layout.tsx does for a
      signed-out visitor) leaves its leftmost column under the fixed rail. */
  footer?: React.ReactNode
  children: React.ReactNode
}) {
  const [collapsed, setCollapsed] = useState(initialCollapsed)
  const { isOpen: drawerOpen, close: closeDrawer } = useDrawer()
  const drawerRef = useRef<HTMLDialogElement>(null)
  // Null outside an App Router context (the unit tests render this directly).
  const pathname = usePathname() ?? ''

  function toggle() {
    const next = !collapsed
    setCollapsed(next)
    // One year. Written here rather than on the server so the rail moves on
    // click instead of waiting for a round trip.
    document.cookie = `${RAIL_COOKIE}=${next ? '1' : '0'}; path=/; max-age=31536000; samesite=lax`
  }

  useEffect(() => {
    const dialog = drawerRef.current
    if (!dialog) return
    if (drawerOpen && !dialog.open) dialog.showModal()
    if (!drawerOpen && dialog.open) dialog.close()
  }, [drawerOpen])

  return (
    <div className="shell" data-collapsed={collapsed ? 'true' : 'false'}>
      {/* Desktop rail. Hidden below lg, where the drawer takes over. */}
      <div className="shell-rail hidden lg:block">
        <Rail groups={groups} pathname={pathname} collapsed={collapsed} onToggle={toggle} />
      </div>

      <dialog
        ref={drawerRef}
        className="shell-drawer lg:hidden"
        aria-label="Navigation"
        onClose={() => closeDrawer()}
        // The backdrop is part of the dialog's box, so a click lands here when
        // it misses the rail.
        onClick={(e) => {
          if (e.target === drawerRef.current) closeDrawer()
        }}
      >
        <div className="h-full">
          <Rail
            groups={groups}
            pathname={pathname}
            collapsed={false}
            onToggle={() => closeDrawer()}
            onNavigate={() => closeDrawer()}
          />
        </div>
      </dialog>

      <div className="shell-main">
        {/* Left-aligned against the rail rather than mx-auto max-w-6xl:
            centring a fixed width inside the space left after the rail pushes
            content visibly off-centre. Still capped, though — this is the root
            layout, so an uncapped <main> stretches every page in the app on an
            ultrawide display (library grids, prose, admin tables), while a
            signed-out visitor on the same URL gets the layout's 72rem column.
            tabIndex={-1} makes it a valid target for the skip link above. */}
        <main
          id="main"
          tabIndex={-1}
          className="w-full max-w-[100rem] px-4 py-8 sm:px-6 sm:py-10"
        >
          <Breadcrumb pathname={pathname} />
          {children}
        </main>
        {footer}
      </div>
    </div>
  )
}

/**
 * The signed-in navigation rail — every destination on one axis.
 *
 * Presentational: it receives the groups it should show rather than deriving
 * them, so it is tested without mocking any capability fetch. The decision
 * about who sees which row lives in lib/nav-model.ts.
 *
 * `pathname` is an injectable prop rather than read via usePathname() here, so
 * this component stays free of Next runtime mocking in its unit test — the same
 * arrangement the tab strip it replaces used. components/shell-frame.tsx
 * supplies the real value.
 *
 * An affordance, not a control. Every page re-checks its own access.
 */
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { IconName, NavGroup } from '@/lib/nav-model'
import {
  BookOpen,
  FileText,
  Toy,
  Printer,
  Building,
  Box,
  Clipboard,
  Child,
  Inbox,
  Shelf,
  Orders,
  User,
  Shield,
  ChevronsLeft,
  ChevronsRight,
  LogOut,
} from '@/components/icons'

// `typeof BookOpen` rather than a hand-written signature: every icon shares the
// same (props: SVGProps<SVGSVGElement>) shape, so borrowing one keeps the
// registry honest if that primitive ever changes.
const ICONS: Record<IconName, typeof BookOpen> = {
  book: BookOpen,
  toy: Toy,
  printer: Printer,
  building: Building,
  file: FileText,
  box: Box,
  clipboard: Clipboard,
  child: Child,
  inbox: Inbox,
  shelf: Shelf,
  orders: Orders,
  user: User,
  shield: Shield,
}

export type RailProps = {
  groups: NavGroup[]
  pathname: string
  collapsed: boolean
  onToggle: () => void
  /** Closes the mobile drawer after a row is chosen. */
  onNavigate?: () => void
}

export function Rail({ groups, pathname, collapsed, onToggle, onNavigate }: RailProps) {
  const supabase = createClient()

  async function signOut() {
    await supabase.auth.signOut()
    // Hard reload, not router.push: a client navigation can leave the server
    // layout still rendering the signed-in shell until a full refresh.
    window.location.href = '/'
  }

  return (
    <div className="flex h-full flex-col bg-brand-deep text-brand-soft">
      <div className="flex items-center gap-2 px-3 py-4">
        <Link
          href="/"
          className="flex min-w-0 items-center gap-2 rounded-field px-1 py-1 font-bold text-white"
        >
          <span
            aria-hidden="true"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/10"
          >
            <BookOpen className="h-5 w-5" />
          </span>
          {!collapsed && <span className="truncate">SPLAT Connect</span>}
        </Link>
        <button
          type="button"
          onClick={onToggle}
          aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
          className="ml-auto hidden shrink-0 rounded-field p-2 text-brand-soft transition-colors hover:bg-white/10 lg:block"
        >
          {collapsed ? (
            <ChevronsRight className="h-5 w-5" />
          ) : (
            <ChevronsLeft className="h-5 w-5" />
          )}
        </button>
      </div>

      {/* Only this band scrolls, so the footer below stays pinned once the
          fourteen rows exceed a short viewport. margin-top:auto would not:
          past the fold there is no slack left to distribute. */}
      <nav className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {groups.map((group) => (
          <div key={group.heading} className="mb-1">
            {collapsed ? (
              // Text stays in the DOM (not aria-hidden) so the group is still
              // announced to assistive tech — only the divider is decorative.
              <>
                <span className="sr-only">{group.heading}</span>
                <div aria-hidden="true" className="mx-3 my-2 border-t border-white/15" />
              </>
            ) : (
              <p className="px-3 pb-1 pt-4 text-xs font-bold uppercase tracking-wider text-brand-soft/60">
                {group.heading}
              </p>
            )}
            <ul>
              {group.rows.map((row) => {
                // Exact match, not startsWith: /dashboard prefixes every other
                // row in its group.
                const active = pathname === row.href
                const IconComponent = ICONS[row.icon]
                return (
                  <li key={row.href}>
                    <Link
                      href={row.href as never}
                      onClick={onNavigate}
                      aria-current={active ? 'page' : undefined}
                      title={collapsed ? row.label : undefined}
                      // Collapsed, the visible "Soon" chip disappears, so the
                      // accessible name has to carry both the destination and
                      // its unbuilt status in one string — an aria-label wins
                      // over text content, so this is the only accessible
                      // name once collapsed.
                      aria-label={
                        collapsed ? (row.soon ? `${row.label} (Soon)` : row.label) : undefined
                      }
                      className={`flex items-center gap-3 rounded-field px-3 py-2 text-sm font-semibold transition-colors ${
                        active
                          ? 'bg-white/15 text-white'
                          : 'text-brand-soft hover:bg-white/10 hover:text-white'
                      } ${row.soon ? 'opacity-60' : ''}`}
                    >
                      <IconComponent className="h-5 w-5 shrink-0" />
                      {!collapsed && <span className="truncate">{row.label}</span>}
                      {!collapsed && row.soon && (
                        <span className="ml-auto shrink-0 rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand-soft/80">
                          Soon
                        </span>
                      )}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-white/15 p-2">
        <button
          type="button"
          onClick={signOut}
          title={collapsed ? 'Sign out' : undefined}
          className="flex w-full items-center gap-3 rounded-field px-3 py-2 text-sm font-semibold text-brand-soft transition-colors hover:bg-white/10 hover:text-white"
        >
          <LogOut className="h-5 w-5 shrink-0" />
          {collapsed ? <span className="sr-only">Sign out</span> : <span>Sign out</span>}
        </button>
      </div>
    </div>
  )
}

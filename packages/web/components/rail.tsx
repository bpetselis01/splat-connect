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
import { BoundaryLink } from '@/components/boundary-link'
import { createClient } from '@/lib/supabase/client'
import { ACCOUNT_NAV } from '@/lib/public-nav'
import type { IconName, NavGroup } from '@/lib/nav-model'
import {
  BookOpen,
  FileText,
  Toy,
  Printer,
  Building,
  Box,
  Clipboard,
  Inbox,
  Shelf,
  Orders,
  User,
  Shield,
  Bell,
  Handshake,
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
  inbox: Inbox,
  shelf: Shelf,
  orders: Orders,
  user: User,
  shield: Shield,
  bell: Bell,
  handshake: Handshake,
}

export type RailProps = {
  groups: NavGroup[]
  pathname: string
  /** Closes the mobile drawer after a row is chosen. */
  onNavigate?: () => void
}

export function Rail({ groups, pathname, onNavigate }: RailProps) {
  const supabase = createClient()

  async function signOut() {
    await supabase.auth.signOut()
    // Hard reload, not router.push: a client navigation can leave the server
    // layout still rendering the signed-in shell until a full refresh.
    window.location.href = '/'
  }

  return (
    <div className="flex h-full flex-col bg-brand-deep text-brand-soft">
      <div className="border-b border-white/15 p-2">
        {/* Always a plain anchor, not next/link: every page that renders this
            rail has nestsRail(pathname) === true, and /dashboard always has
            nestsRail === false, so this is always a boundary crossing — see
            lib/public-nav.ts's crossesAccountBoundary. A soft transition here
            would leave the rail on screen with no header, the exact bug this
            link exists to fix.

            A filled pill rather than a plain row: this is the rail's one way
            out, not another destination in the list below it, so it carries
            its own background at rest instead of only lighting up on hover. */}
        <a
          href={ACCOUNT_NAV.href}
          className="flex items-center gap-2 rounded-field bg-white/10 px-3 py-2.5 text-sm font-bold text-white transition-colors hover:bg-white/20"
        >
          <span aria-hidden="true" className="text-base leading-none">
            ←
          </span>
          <span className="truncate">Back to {ACCOUNT_NAV.label}</span>
        </a>
      </div>

      {/* Only this band scrolls, so the footer below stays pinned once the
          fourteen rows exceed a short viewport. margin-top:auto would not:
          past the fold there is no slack left to distribute. */}
      <nav className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {groups.map((group) => (
          <div key={group.heading} className="mb-1">
            <p className="px-3 pb-1 pt-4 text-xs font-bold uppercase tracking-wider text-brand-soft/60">
              {group.heading}
            </p>
            <ul>
              {group.rows.map((row) => {
                // Exact match, not startsWith: /dashboard prefixes every other
                // row in its group.
                const active = pathname === row.href
                const IconComponent = ICONS[row.icon]
                return (
                  <li key={row.href}>
                    <BoundaryLink
                      href={row.href}
                      onClick={onNavigate}
                      aria-current={active ? 'page' : undefined}
                      className={`flex items-center gap-3 rounded-field px-3 py-2 text-sm font-semibold transition-colors ${
                        active
                          ? 'bg-white/15 text-white'
                          : 'text-brand-soft hover:bg-white/10 hover:text-white'
                      } ${row.soon ? 'opacity-60' : ''}`}
                    >
                      <IconComponent className="h-5 w-5 shrink-0" />
                      <span className="truncate">{row.label}</span>
                      {row.soon && (
                        <span className="ml-auto shrink-0 rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand-soft/80">
                          Soon
                        </span>
                      )}
                      {row.count !== undefined && (
                        <span className="ml-auto shrink-0 rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-bold text-white">
                          {row.count}
                        </span>
                      )}
                    </BoundaryLink>
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
          className="flex w-full items-center gap-3 rounded-field px-3 py-2 text-sm font-semibold text-brand-soft transition-colors hover:bg-white/10 hover:text-white"
        >
          <LogOut className="h-5 w-5 shrink-0" />
          <span>Sign out</span>
        </button>
      </div>
    </div>
  )
}

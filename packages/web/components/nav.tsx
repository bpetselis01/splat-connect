'use client'
import { useEffect, useId, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  CaretDown,
  MagnifyingGlass,
  BookOpen,
  ChartLineUp,
  Lightbulb,
  Buildings,
  CalendarDots,
  Newspaper,
  Swatches,
  ChatCircleDots,
} from '@phosphor-icons/react/dist/ssr'
import { BoundaryLink } from '@/components/boundary-link'
import { BrandMark } from '@/components/auth-wordmark'
import { DisplayToggles } from '@/components/display-toggles'
import { ACCOUNT_NAV, sectionFor } from '@/lib/public-nav'
import type { Capabilities } from '@/lib/capabilities'
import type { Mode, Motion } from '@/lib/display-prefs'

/** Two letters from a display name, for the avatar. Falls back to one. */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase()
}

/** Five primary tabs, everything else behind More — the board's NAV5. */
const TABS = [
  { href: '/library', label: 'Guides' },
  { href: '/toy-library', label: 'Toy Library' },
  { href: '/printing', label: '3D Printing' },
  { href: '/get-involved', label: 'Get Involved' },
  { href: '/about', label: 'About' },
]

/** The board's MORE list, in its order, with its blurbs, icons and tints. */
const MORE = [
  { href: '/learn', label: 'Learn', blurb: 'Switches, tools, safety — from first switch to safe finish.', Icon: BookOpen, tint: 'var(--tamber)' },
  { href: '/impact', label: 'Impact', blurb: 'What this community has made, given and delivered.', Icon: ChartLineUp, tint: 'var(--tmint)' },
  { href: '/get-involved/design-challenges', label: 'Design challenges', blurb: 'Problems nobody has solved yet, open to anyone.', Icon: Lightbulb, tint: 'var(--tviolet)' },
  { href: '/organizations', label: 'Organisations', blurb: 'Therapy centres, schools and services behind the work.', Icon: Buildings, tint: 'var(--b100)' },
  { href: '/get-involved/events', label: 'Events', blurb: 'Build days, workshops and where to find us in person.', Icon: CalendarDots, tint: 'var(--tok)' },
  { href: '/about/stories', label: 'Stories', blurb: 'What families and makers have done with SPLAT.', Icon: Newspaper, tint: 'var(--tcoral)' },
  { href: '/design-system', label: 'Design system', blurb: 'Soft Pop components and every interaction state.', Icon: Swatches, tint: 'var(--surface2)' },
  { href: '/contact', label: 'Contact', blurb: 'A guide, a toy or a partnership — get in touch.', Icon: ChatCircleDots, tint: 'var(--surface2)' },
]

const under = (pathname: string, href: string) => pathname === href || pathname.startsWith(`${href}/`)

interface NavProps {
  /** Null when signed out. Non-null is the whole signed-in test. */
  caps: Capabilities | null
  /** Colour mode and motion as the server rendered them, from the cookies. */
  mode?: Mode
  motion?: Motion
}

export function Nav({ caps, mode = 'light', motion = 'full' }: NavProps) {
  // Null outside an App Router context (e.g. the unit tests render Nav directly).
  const pathname = usePathname() ?? ''
  const activeSection = sectionFor(pathname)
  const [moreOpen, setMoreOpen] = useState(false)
  const moreRef = useRef<HTMLDivElement>(null)
  const moreButton = useRef<HTMLButtonElement>(null)
  const menuId = useId()

  // A disclosure, not an ARIA menu: its contents are ordinary links, which a
  // menu role would take out of Tab order and demand arrow keys for. Closes on
  // choosing an item, Escape and any press outside it.
  useEffect(() => {
    if (!moreOpen) return
    const onPointer = (e: PointerEvent) => {
      if (!moreRef.current?.contains(e.target as Node)) setMoreOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setMoreOpen(false)
      moreButton.current?.focus()
    }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [moreOpen])

  // The bar's height, for anything that pins under it (the home page's
  // scroll-world stage). It wraps to two rows between lg and ~1330px, so a
  // constant would be wrong across that whole range.
  const header = useRef<HTMLElement>(null)
  useEffect(() => {
    const el = header.current
    if (!el) return
    const publish = () =>
      document.documentElement.style.setProperty('--header-h', `${el.offsetHeight}px`)
    const watch = new ResizeObserver(publish)
    watch.observe(el)
    return () => watch.disconnect()
  }, [])

  const moreCurrent = MORE.some((m) => under(pathname, m.href))

  return (
    <header ref={header} className="site-header">
      <nav aria-label="Main" className="site-nav">
        <BoundaryLink href="/" aria-label="SPLAT Connect home" className="brand-link">
          <BrandMark />
          <span className="brand-word">
            SPLAT <span>Connect</span>
          </span>
        </BoundaryLink>

        <div className="nav-tabs">
          {TABS.map((t) => (
            <BoundaryLink
              key={t.href}
              href={t.href}
              aria-current={activeSection?.href === t.href ? 'page' : undefined}
              className="nav-tab"
            >
              {t.label}
            </BoundaryLink>
          ))}

          <div ref={moreRef} className="nav-more">
            <button
              ref={moreButton}
              type="button"
              className="nav-tab"
              aria-expanded={moreOpen}
              aria-controls={menuId}
              data-current={moreCurrent || undefined}
              onClick={() => setMoreOpen((o) => !o)}
            >
              More <CaretDown aria-hidden="true" />
            </button>
            {moreOpen && (
              <div id={menuId} className="nav-more__menu">
                {MORE.map(({ href, label, blurb, Icon, tint }) => (
                  <BoundaryLink
                    key={href}
                    href={href}
                    aria-current={under(pathname, href) ? 'page' : undefined}
                    className="nav-more__item"
                    onClick={() => setMoreOpen(false)}
                  >
                    <span aria-hidden="true" className="nav-more__icon" style={{ background: tint }}>
                      <Icon weight="duotone" />
                    </span>
                    <span>
                      <span className="nav-more__label">{label}</span>
                      <span className="nav-more__blurb">{blurb}</span>
                    </span>
                  </BoundaryLink>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="nav-tools">
          {/* A plain GET form: works before hydration, and the library reads
              ?q= into its own search box. */}
          <form action="/library" role="search" className="nav-search">
            <MagnifyingGlass aria-hidden="true" />
            <input type="search" name="q" placeholder="Search guides, toys, parts" aria-label="Search" />
          </form>

          <DisplayToggles mode={mode} motion={motion} />

          {caps ? (
            <BoundaryLink
              href={ACCOUNT_NAV.href}
              // BoundaryLink, not <Link>: crossing into or out of the account
              // section needs a full load — see crossesAccountBoundary.
              aria-current={pathname === ACCOUNT_NAV.href ? 'page' : undefined}
              className="nav-account"
            >
              {ACCOUNT_NAV.label}
              {caps.unread.total > 0 && (
                <>
                  <span aria-hidden="true" className="nav-account__badge">
                    {caps.unread.total}
                  </span>
                  {/* The number alone is not self-describing to a screen reader. */}
                  <span className="sr-only">{caps.unread.total} unread</span>
                </>
              )}
              <span aria-hidden="true" title={caps.profile.name} className="nav-account__avatar">
                {initials(caps.profile.name)}
              </span>
            </BoundaryLink>
          ) : (
            <Link href="/login" className="nav-signin">
              Sign in
            </Link>
          )}
        </div>
      </nav>
    </header>
  )
}

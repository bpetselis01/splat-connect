'use client'
/**
 * The row of pills at the foot of every policy page: its siblings, with the
 * one you are on filled. Client-side only for usePathname — the pages
 * themselves stay server components and do not have to name themselves.
 */
import Link from 'next/link'
import type { Route } from 'next'
import { usePathname } from 'next/navigation'
import { FOOTER_LEGAL } from '@/lib/public-nav'

// The board's order: Safety leads, then the footer's own order.
const SIBLINGS = [
  ...FOOTER_LEGAL.filter((l) => l.href === '/safety'),
  ...FOOTER_LEGAL.filter((l) => l.href !== '/safety'),
]

export function LegalSiblings() {
  const pathname = usePathname()
  return (
    <nav
      aria-label="Policies"
      className="mt-10 flex flex-wrap gap-2.5 border-t border-line pt-[26px]"
    >
      {SIBLINGS.map((s) => {
        const on = pathname === s.href
        return (
          <Link
            key={s.href}
            href={s.href as Route}
            aria-current={on ? 'page' : undefined}
            className={`inline-flex min-h-11 items-center rounded-pill border border-line px-4 text-sm font-bold text-ink ${
              on ? 'bg-[var(--b100)]' : 'bg-surface'
            }`}
          >
            {s.label}
          </Link>
        )
      })}
    </nav>
  )
}

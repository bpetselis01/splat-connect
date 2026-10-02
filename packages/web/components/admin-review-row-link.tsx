'use client'
/**
 * A review-queue row's link. It is a real link to the full review page, so
 * with no JavaScript — or a middle-click, or cmd-click — it goes there. With
 * JavaScript an ordinary click opens the side pane on the queue instead,
 * which is the board's behaviour. Below lg the pane stacks under the whole
 * table, out of sight, so a narrow screen follows the link instead.
 */
import Link from 'next/link'
import type { Route } from 'next'
import { useRouter } from 'next/navigation'
import type { ReactNode } from 'react'

export function ReviewRowLink({
  href,
  paneHref,
  className,
  children,
}: {
  href: string
  paneHref: string
  className?: string
  children: ReactNode
}) {
  const router = useRouter()
  return (
    <Link
      href={href as Route}
      className={className}
      onClick={(e) => {
        if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
        if (!window.matchMedia('(min-width: 1024px)').matches) return
        e.preventDefault()
        router.push(paneHref as Route, { scroll: false })
      }}
    >
      {children}
    </Link>
  )
}

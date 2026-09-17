/**
 * Secondary detail, behind a caret.
 *
 * The rule it exists to enforce is editorial rather than visual: keep the
 * *decision* visible — the total, the next action — and hide the *evidence*.
 * Cost breakdowns, build and exchange detail tables, anything a reader needs
 * once and then never again.
 *
 * Native `<details>`, so it works with no JavaScript, is findable by in-page
 * search when open, and announces its own expanded state. The caret rotates via
 * a CSS sibling rule rather than React state for the same reason.
 */
import { CaretRight } from '@phosphor-icons/react/dist/ssr'
import type { ReactNode } from 'react'

export function Disclosure({
  summary,
  children,
  defaultOpen = false,
}: {
  summary: ReactNode
  children: ReactNode
  defaultOpen?: boolean
}) {
  return (
    <details open={defaultOpen} className="disclosure group">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-5 py-3.5 text-sm font-extrabold text-brand-deep [&::-webkit-details-marker]:hidden [&::marker]:content-['']">
        <CaretRight
          size={14}
          weight="bold"
          aria-hidden="true"
          className="transition-transform duration-200 group-open:rotate-90"
        />
        {summary}
      </summary>
      <div className="px-5 pb-4">{children}</div>
    </details>
  )
}

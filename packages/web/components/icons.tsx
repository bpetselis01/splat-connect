/**
 * Inline icon set — no dependency, drawn on a 24px grid with a currentColor
 * stroke so each icon inherits its container's text colour and scales with its
 * font-size (width/height default to 1em; pass `className` to override either).
 *
 * These replace the emoji that were standing in as functional icons across the
 * web app: emoji render differently per OS, and 🧩 specifically is a contested
 * symbol in the disability community and the wrong mark for this audience. Logo
 * is a neutral "connect" glyph — a placeholder for a real brand mark, not a
 * finished identity.
 */
import type { SVGProps, ReactNode } from 'react'

function Icon({ children, ...props }: SVGProps<SVGSVGElement> & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  )
}

/** Two nodes joined — "Connect". Neutral placeholder brand mark. */
export function Logo(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="12" r="3" />
      <line x1="9" y1="12" x2="15" y2="12" />
    </Icon>
  )
}

export function BookOpen(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M2 4h6a3 3 0 0 1 3 3v13a2.5 2.5 0 0 0-2.5-2.5H2z" />
      <path d="M22 4h-6a3 3 0 0 0-3 3v13a2.5 2.5 0 0 1 2.5-2.5H22z" />
    </Icon>
  )
}

export function FileText(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
      <line x1="8" y1="13" x2="16" y2="13" />
      <line x1="8" y1="17" x2="14" y2="17" />
    </Icon>
  )
}

export function Download(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M12 3v12" />
      <path d="M7 10l5 5 5-5" />
      <path d="M5 21h14" />
    </Icon>
  )
}

export function Check(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M20 6L9 17l-5-5" />
    </Icon>
  )
}

export function X(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M18 6L6 18" />
      <path d="M6 6l12 12" />
    </Icon>
  )
}

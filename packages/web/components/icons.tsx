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

export function Toy(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="8" r="4" />
      <path d="M5 21v-3a7 7 0 0 1 14 0v3" />
      <line x1="9" y1="8" x2="9.01" y2="8" />
      <line x1="15" y1="8" x2="15.01" y2="8" />
    </Icon>
  )
}

export function Printer(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M6 9V3h12v6" />
      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
      <rect x="6" y="14" width="12" height="8" rx="1" />
    </Icon>
  )
}

export function Building(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <line x1="9" y1="8" x2="9.01" y2="8" />
      <line x1="15" y1="8" x2="15.01" y2="8" />
      <line x1="9" y1="12" x2="9.01" y2="12" />
      <line x1="15" y1="12" x2="15.01" y2="12" />
      <path d="M10 21v-4h4v4" />
    </Icon>
  )
}

export function Box(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M21 8l-9-5-9 5v8l9 5 9-5z" />
      <path d="M3 8l9 5 9-5" />
      <line x1="12" y1="13" x2="12" y2="21" />
    </Icon>
  )
}

export function Clipboard(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <rect x="8" y="3" width="8" height="4" rx="1" />
      <path d="M16 5h2a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2" />
    </Icon>
  )
}

export function Child(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="6" r="3" />
      <path d="M12 9v6" />
      <path d="M8 12h8" />
      <path d="M9 21l3-6 3 6" />
    </Icon>
  )
}

export function Inbox(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M3 13h5l1 3h6l1-3h5" />
      <path d="M5 4h14l3 9v5a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-5z" />
    </Icon>
  )
}

export function Shelf(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="8" y1="4" x2="8" y2="12" />
      <line x1="15" y1="12" x2="15" y2="20" />
    </Icon>
  )
}

export function Orders(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M4 4h2l2 12h10l2-8H7" />
      <circle cx="10" cy="20" r="1" />
      <circle cx="18" cy="20" r="1" />
    </Icon>
  )
}

export function User(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1" />
    </Icon>
  )
}

export function Shield(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" />
    </Icon>
  )
}

/** Rail collapse control. Chevrons point the way the rail will move. */
export function ChevronsLeft(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M11 17l-5-5 5-5" />
      <path d="M18 17l-5-5 5-5" />
    </Icon>
  )
}

export function ChevronsRight(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M13 17l5-5-5-5" />
      <path d="M6 17l5-5-5-5" />
    </Icon>
  )
}

/** Mobile drawer trigger. */
export function Menu(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <line x1="4" y1="6" x2="20" y2="6" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="18" x2="20" y2="18" />
    </Icon>
  )
}

export function LogOut(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </Icon>
  )
}

export function Bell(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M6 8a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6" />
      <path d="M10 21a2 2 0 0 0 4 0" />
    </Icon>
  )
}

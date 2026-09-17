/**
 * The nav model's icon names, drawn in Phosphor.
 *
 * The model names icons semantically — 'shelf', 'orders', 'handshake' — rather
 * than naming a glyph, so the icon set can change without touching a shared
 * type that both platforms read. This is the one place that mapping lives.
 *
 * Duotone, because these are decorative tiles: the card's title carries the
 * meaning and the tile is a colour cue you learn once. The brief reserves bold
 * for inline and button icons and fill for status pills.
 *
 * Note what the React package buys here over the webfont the prototype uses: a
 * name that does not exist is a missing export and fails the build. The brief
 * has to warn that `ph-archive-box` does not exist and to check every glyph
 * renders non-zero, because with a webfont a wrong name is an invisible box.
 */
import {
  Archive,
  Bell,
  Book,
  Bookmark,
  Buildings,
  CalendarDots,
  ClipboardText,
  Handshake,
  Package,
  Printer,
  PuzzlePiece,
  Recycle,
  Receipt,
  ShieldCheck,
  TextAlignLeft,
  Tray,
  User,
} from '@phosphor-icons/react/dist/ssr'
import type { IconName } from '@splat-connect/types'

const GLYPH: Record<IconName, typeof Bell> = {
  bell: Bell,
  book: Book,
  bookmark: Bookmark,
  box: Package,
  building: Buildings,
  calendar: CalendarDots,
  clipboard: ClipboardText,
  file: TextAlignLeft,
  handshake: Handshake,
  // Phosphor has no Inbox; Tray is the same idea and does exist.
  inbox: Tray,
  orders: Receipt,
  printer: Printer,
  recycle: Recycle,
  shelf: Archive,
  shield: ShieldCheck,
  toy: PuzzlePiece,
  user: User,
}

export function NavIcon({ name, size = 22 }: { name?: IconName; size?: number }) {
  if (!name) return null
  const Glyph = GLYPH[name]
  if (!Glyph) return null
  return <Glyph size={size} weight="duotone" />
}

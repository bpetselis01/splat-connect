/**
 * The header's colour-mode and motion toggles, persisted in cookies rather than
 * localStorage so the root layout can stamp them on <body> during the server
 * render. A localStorage value is only readable after hydration, which paints
 * every dark-mode page white first.
 */
export type Mode = 'light' | 'dark' | 'hc'
export type Motion = 'full' | 'reduced'

export const MODE_COOKIE = 'splat-mode'
export const MOTION_COOKIE = 'splat-motion'

/** Anything unrecognised is light — a stale or hand-edited cookie must not
    reach the page as an attribute value no stylesheet rule matches. */
export function parseMode(v: string | undefined): Mode {
  return v === 'dark' || v === 'hc' ? v : 'light'
}

export function parseMotion(v: string | undefined): Motion {
  return v === 'reduced' ? 'reduced' : 'full'
}

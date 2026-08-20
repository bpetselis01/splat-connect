/**
 * Decorative rotation, cycled deterministically by position.
 *
 * Not a client component, and deliberately not animated in JavaScript: the
 * rotation is a CSS class (see `.tilt-1..4` in globals.css), so it is present in
 * the server-rendered HTML and correct before any script runs.
 *
 * Determinism matters more than it looks. A random angle per card would change
 * between the server render and the client render, so React would either warn
 * about the mismatch or visibly re-tilt the whole grid on hydration. Index-based
 * cycling gives the same card the same angle every time.
 *
 * The rotation is applied here, to the card. The grid that positions the cards
 * is never rotated — strip every transform and the layout is an ordinary upright
 * grid that still reads in order, which is what keeps this safe at high browser
 * zoom and with long translated strings.
 */
const ANGLES = ['tilt-1', 'tilt-2', 'tilt-3', 'tilt-4'] as const

export function tiltClass(index: number): string {
  return ANGLES[((index % ANGLES.length) + ANGLES.length) % ANGLES.length]
}

export function Tilt({
  index,
  className = '',
  children,
}: {
  index: number
  className?: string
  children: React.ReactNode
}) {
  // h-full: Tilt is the grid item, so the card inside can only stretch to a
  // row's height if this wrapper does too. Without it, siblings end up ragged.
  return <div className={`h-full ${tiltClass(index)} ${className}`.trim()}>{children}</div>
}

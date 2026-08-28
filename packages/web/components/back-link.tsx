/**
 * The one way back, on every page inside the account section.
 *
 * There were six hand-rolled copies of this before, in three different
 * treatments — four at `text-sm text-muted`, one semibold brand, one bold
 * brand — and two of them pointed somewhere their own label denied. A shared
 * component is what stops both halves of that recurring: the style is decided
 * once, and a wrong destination now has one place to be wrong rather than six.
 *
 * `lg:hidden`, which is the whole shape of this component. Every destination a
 * back link points at — My tutorials, My toys, My exchanges, Account — is
 * already a row in the rail, and the rail is on screen on all seven of these
 * pages. At desktop width the control is therefore a second copy of a link
 * sitting two inches to its left, which is what made it read as clutter rather
 * than as help. Below lg the rail is `hidden lg:block` (components/shell-frame.tsx)
 * and collapses into a hamburger drawer, and this becomes the only one-tap way
 * up — so it renders exactly where it is the only answer, and nowhere else.
 *
 * Drawn as `.btn-quiet`, the same control the header's "Sign out" uses. As a
 * bare tinted label it was the quietest thing on a page whose every other
 * control is a button or a pill; on a phone, where it is the sole way back,
 * quietest was the wrong place for it to be. `.btn-sm` still clears a 36px
 * target.
 *
 * BoundaryLink, not next/link: `/dashboard` keeps the header while every other
 * account page takes the rail, so a back link is exactly the kind of hop that
 * crosses that split. See components/boundary-link.tsx.
 *
 * Related files:
 * - components/breadcrumb.tsx: the public-page equivalent, deliberately a
 *   different register — an eyebrow over a hub, not a control over a form
 */
import { BoundaryLink } from '@/components/boundary-link'

export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    // `.btn` already supplies inline-flex and the 0.5rem gap, so the arrow
    // needs no layout of its own. It is decorative: `label` is the whole
    // accessible name, and "← My tutorials" read aloud is not an improvement.
    <BoundaryLink href={href} className="btn btn-quiet btn-sm mb-4 lg:hidden">
      <span aria-hidden="true">←</span>
      {label}
    </BoundaryLink>
  )
}

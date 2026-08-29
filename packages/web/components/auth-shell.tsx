import Link from 'next/link'
import { Logo } from '@/components/icons'

/**
 * The chrome for /login and /signup.
 *
 * These are the only routes with no header (app/layout.tsx's BARE_PREFIXES —
 * a nav on an auth gate is an escape hatch out of the gate), which left them
 * with no branding and no way home at all: a visitor landing on /login found
 * the word "SPLAT Connect" nowhere on the page. The board replaces the header
 * with exactly two things, and this is them — the wordmark, and a segmented
 * switch between the two screens.
 *
 * The switch is two <Link>s rather than one screen with a view flag. The board
 * models it as local state because an artboard has no router; here /login and
 * /signup are real routes carrying ?next= and their own tests, and collapsing
 * them would cost all of that to gain nothing a visitor can see.
 */
export function AuthShell({
  current,
  children,
}: {
  /** Which tab is filled. Also what the link's aria-current announces. */
  current: 'login' | 'signup'
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center px-5 pb-14 pt-8 sm:pt-14">
      <Link href="/" className="mb-[30px] flex items-center gap-2.5">
        <span
          aria-hidden="true"
          className="pixel-avatar grid h-[34px] w-[34px] place-items-center bg-brand-tint text-brand-dark"
        >
          <Logo className="h-5 w-5" />
        </span>
        <span className="text-[18px] font-black tracking-tight text-ink">SPLAT Connect</span>
      </Link>

      {/* One border and one shadow around the pair, not one each — the divider
          between them is a border on the second tab. That is what makes it read
          as a single switch rather than two adjacent buttons. */}
      <div className="auth-switch">
        <Link href="/login" aria-current={current === 'login' ? 'page' : undefined}>
          Sign in
        </Link>
        <Link href="/signup" aria-current={current === 'signup' ? 'page' : undefined}>
          Create account
        </Link>
      </div>

      {children}
    </div>
  )
}

/**
 * The card both auth screens sit in. Separate from AuthShell because the signup
 * page renders a different one on success ("Check your email") that still needs
 * the same box.
 */
export function AuthCard({ children }: { children: React.ReactNode }) {
  // No shadow of its own, so .card's rung-3 rule in globals.css draws it.
  //
  // This carried a literal shadow-[6px_6px_0_var(--color-ink)] — the launcher
  // pillar's depth — on the argument that the card is the only object on the
  // screen and has no siblings to sit level with. Depth is not what says that:
  // being alone on the page already does. What the literal actually bought was
  // a form box shouting louder than the Sign in button inside it, and because
  // a Tailwind utility beats the stylesheet it was the one surface the
  // 2026-08-29 hierarchy pass could not reach from CSS.
  return (
    <div className="card mt-[22px] w-full max-w-[380px] p-[30px]">{children}</div>
  )
}

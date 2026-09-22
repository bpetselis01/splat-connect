import Link from 'next/link'
import type { Route } from 'next'
import { ShieldCheck, SealCheck, Heart } from '@phosphor-icons/react/dist/ssr'
import { AuthWordmark } from '@/components/auth-wordmark'
import { SplatMascot } from '@/components/splat-mascot'

/**
 * The centred auth stage the board draws for Sign in, Check your email, Email
 * confirmed and the contributor-terms gate: two drifting blobs behind a 440px
 * column — the bear waving, the brand lockup, the card, and a one-line
 * footnote under it.
 *
 * Create account is the one auth screen NOT on this stage: the board gives it
 * a two-column page of its own (AuthSplit).
 *
 * These routes carry the site header now, as every board screen does. They
 * were bare on the argument that a nav on an auth gate is an escape hatch out
 * of the gate — which is true of the contributor-terms gate, where every link
 * bounces straight back, and not of a sign-in page anyone may leave.
 */
export function AuthStage({ children }: { children: React.ReactNode }) {
  return (
    <div className="auth-stage">
      <div aria-hidden="true" className="auth-stage__blobs">
        <span />
        <span />
      </div>
      <div className="auth-stage__column">
        <div className="auth-stage__mascot">
          <SplatMascot width={78} />
        </div>
        <AuthWordmark className="auth-stage__lockup" />
        <div className="auth-card">{children}</div>
        <p className="auth-stage__foot">No paid tier. Not a medical device.</p>
      </div>
    </div>
  )
}

/**
 * The board's Create account page: the welcome and its three promises on the
 * left, the form card (children) on the right.
 */
export function AuthSplit({ children }: { children: React.ReactNode }) {
  return (
    <section className="signup">
      <div className="signup__welcome">
        <div className="signup__mascot">
          <SplatMascot width={140} />
        </div>
        <h1 className="signup__title">Welcome to SPLAT Connect</h1>
        <p className="signup__lede">
          One account for browsing, saving, requesting toys and — if you make things — writing
          guides. The account is free, always. We never sell data.
        </p>
        <ul className="signup__promises">
          <li>
            <ShieldCheck weight="fill" aria-hidden="true" style={{ color: 'var(--ok)' }} />
            Child profiles stay private to you
          </li>
          <li>
            <SealCheck weight="fill" aria-hidden="true" style={{ color: 'var(--ok)' }} />
            Every guide is reviewed before it&apos;s published
          </li>
          <li>
            <Heart weight="fill" aria-hidden="true" style={{ color: 'var(--coral)' }} />
            Run by volunteers in Australia
          </li>
        </ul>
      </div>
      {children}
    </section>
  )
}

/**
 * The board's segmented switch at the top of the auth form card. Two <Link>s
 * rather than one screen with a view flag: /login and /signup are real routes
 * carrying ?next= and their own tests, so the "tabs" navigate — and carry the
 * query across, so a visitor sent to signup to save something who switches to
 * Sign in still comes back to it.
 */
export function AuthTabs({ current, search = '' }: { current: 'login' | 'signup'; search?: string }) {
  const query = search ? `?${search}` : ''
  return (
    <nav aria-label="Account" className="auth-tabs">
      <Link href={`/signup${query}` as Route} aria-current={current === 'signup' ? 'page' : undefined}>
        Create account
      </Link>
      <Link href={`/login${query}` as Route} aria-current={current === 'login' ? 'page' : undefined}>
        Sign in
      </Link>
    </nav>
  )
}

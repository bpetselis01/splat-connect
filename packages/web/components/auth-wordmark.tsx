import Link from 'next/link'
import { Logo } from '@/components/icons'

/**
 * The wordmark the board puts at the top of every signed-out screen.
 *
 * Its own component because three of those screens are not the sign-in pair:
 * /auth/confirmed and /onboarding/contributor-terms have their own layouts, and
 * AuthShell carries the sign-in / create-account tab switch, which would be
 * wrong on a terms gate. Both of them showed no wordmark at all until now.
 *
 * Two words, two colours: SPLAT in ink and Connect in brand, Baloo 2 at
 * 22px/800.
 */
export function AuthWordmark({ className = '' }: { className?: string }) {
  return (
    <Link href="/" className={`flex items-center gap-2.5 ${className}`.trim()}>
      <span
        aria-hidden="true"
        className="pixel-avatar grid h-[34px] w-[34px] place-items-center bg-brand-tint text-brand-dark"
      >
        <Logo className="h-5 w-5" />
      </span>
      {/* "SPLAT" stays as this element's own text rather than going into a
          third span, so the wordmark reads as one label with a coloured second
          word — which is how the board marks it up, and what a screen reader
          and the parity fingerprint both see. */}
      <span className="font-display text-[22px] font-extrabold tracking-tight text-ink">
        SPLAT <span className="text-brand-dark">Connect</span>
      </span>
    </Link>
  )
}

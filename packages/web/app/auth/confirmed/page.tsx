'use client'
/**
 * Landing page for the link in Supabase's signup confirmation email
 * (see EXPO_PUBLIC_WEB_URL/auth/confirmed passed as emailRedirectTo in
 * packages/mobile/lib/auth-context.tsx, and app/signup/page.tsx's signUp()
 * call for the web equivalent). Supabase already verifies the token before
 * redirecting here.
 *
 * Shared between platforms — a mobile-app signup also lands here, since
 * deep-linking straight back into a mobile app from an email client isn't
 * reliable. The auto-redirect below sends them into a web sign-in flow they
 * may not want; the manual "Continue" link exists for web users who don't
 * want to wait, and doubles as an escape hatch for anyone who'd rather just
 * close the tab.
 */
import { SealCheck } from '@phosphor-icons/react/dist/ssr'
import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import type { Route } from 'next'
import { AuthStage } from '@/components/auth-shell'

const REDIRECT_SECONDS = 3

function EmailConfirmed() {
  const router = useRouter()
  // Passed through from /signup. /login already honours ?next=, so handing it
  // on is the whole of getting someone back to the page they started on.
  const next = useSearchParams().get('next')
  const [secondsLeft, setSecondsLeft] = useState(REDIRECT_SECONDS)
  // The button and the countdown go to the same place — the button used to
  // drop ?next=, so not waiting cost you the page you started on.
  const loginHref = (next ? `/login?next=${encodeURIComponent(next)}` : '/login') as Route

  useEffect(() => {
    const interval = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(interval)
          router.replace(loginHref)
          return 0
        }
        return s - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [router, loginHref])

  return (
    <AuthStage>
      <div className="flex flex-col items-center text-center">
        <span aria-hidden="true" className="auth-sent__badge">
          <SealCheck weight="fill" />
        </span>
        <h1 className="auth-sent__title">Email confirmed</h1>
        <p className="auth-sent__body">
          Your email has been confirmed. Sign in to your account to continue.
        </p>
        <Link href={loginHref} className="auth-submit auth-submit--inline">
          Continue
        </Link>
        <p className="mt-4 text-xs text-muted" role="status">
          Redirecting you to sign in in {secondsLeft}…
        </p>
      </div>
    </AuthStage>
  )
}

// useSearchParams() requires a Suspense boundary, or `next build` fails to
// prerender this page — same reasoning as app/login/page.tsx.
export default function EmailConfirmedPage() {
  return (
    <Suspense>
      <EmailConfirmed />
    </Suspense>
  )
}

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
 * may not want; the manual "Sign in now" link exists for web users who don't
 * want to wait, and doubles as an escape hatch for anyone who'd rather just
 * close the tab.
 */
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

const REDIRECT_SECONDS = 3

export default function EmailConfirmedPage() {
  const router = useRouter()
  const [secondsLeft, setSecondsLeft] = useState(REDIRECT_SECONDS)

  useEffect(() => {
    const interval = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(interval)
          router.replace('/login')
          return 0
        }
        return s - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [router])

  return (
    <div className="mx-auto mt-8 max-w-sm sm:mt-16">
      <div className="card flex flex-col items-center p-6 text-center sm:p-8">
        <span aria-hidden="true" className="empty-badge">
          ✅
        </span>
        <h1 className="mt-4 text-2xl font-bold text-ink">Email confirmed</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Your email has been confirmed. Sign in to your account to continue.
        </p>
        <p className="mt-4 text-xs text-muted" role="status">
          Redirecting you to sign in in {secondsLeft}…
        </p>
        <Link href="/login" className="btn btn-soft mt-4">
          Sign in now
        </Link>
      </div>
    </div>
  )
}

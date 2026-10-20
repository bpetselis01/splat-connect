/**
 * The public page Google Play's account deletion policy requires: anyone can
 * read how to delete an account and what happens to the data, then sign in to
 * do it. Linked from the Play Console listing and the privacy page.
 */
import Link from 'next/link'
import type { Metadata } from 'next'
import type { Route } from 'next'
import { authUrl } from '@/lib/safe-next-path'

export const metadata: Metadata = { title: 'Delete your account · SPLAT Connect' }

export default function DeleteAccountInfoPage() {
  return (
    <main className="mx-auto max-w-[680px] px-4 py-12 sm:px-8">
      <h1 className="title-hub">Delete your SPLAT Connect account</h1>
      <p className="mt-3 text-lg leading-relaxed text-muted">
        You can delete your account yourself, in the app or here. It takes effect straight away.
      </p>
      <ol className="mt-6 list-decimal pl-6 leading-loose text-ink">
        <li>Sign in.</li>
        <li>Go to Account, then Delete account.</li>
        <li>Type DELETE, then enter the 6-digit code we email you.</li>
      </ol>
      <h2 className="mt-8 text-xl font-extrabold text-ink">Deleted</h2>
      <p className="mt-2 text-muted">
        Your profile, email and sign-in; child profiles; drafts, saved items and photos; your pickup address.
      </p>
      <h2 className="mt-6 text-xl font-extrabold text-ink">Kept, without your name</h2>
      <p className="mt-2 text-muted">
        Published guides stay up for the families using them, credited to &ldquo;A former contributor&rdquo;
        unless you choose to keep your name. Other members keep their record of exchanges and messages with you,
        shown as &ldquo;Deleted member&rdquo;. Exchange cost records are kept for 7 years because the law
        requires it, also without your name.
      </p>
      <p className="mt-6 text-muted">
        Can&apos;t sign in? <Link href="/contact" className="font-extrabold text-[var(--b700)] underline">Contact us</Link> and
        we&apos;ll delete it for you.
      </p>
      <Link href={authUrl('login', '/dashboard/profile/delete') as Route} className="auth-submit mt-8 px-8">Sign in to delete</Link>
    </main>
  )
}

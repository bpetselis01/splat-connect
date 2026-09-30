'use client'
/**
 * Deleting your own account on the web — the same steps as the phone
 * (docs/superpowers/specs/2026-09-30-account-deletion-design.md): what will
 * happen, type DELETE, the emailed code, done. Verifying the code is what makes
 * the session fresh enough for DELETE /api/me to accept.
 */
import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { browserApiClient } from '@/lib/browser-api-client'

export type DeletionPreview = {
  open: { id: string; type: string }[]
  childProfiles: number
  publishedGuides: number
  soleLedOrgs: { id: string; name: string }[]
}

const WORD: Record<string, [string, string]> = {
  donation: ['exchange', 'exchanges'],
  exchange: ['exchange', 'exchanges'],
  build: ['build', 'builds'],
  print: ['print job', 'print jobs'],
}
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

export function openSummary(open: DeletionPreview['open']): string {
  const counts = new Map<string, [string, string, number]>()
  for (const o of open) {
    const [one, many] = WORD[o.type] ?? ['request', 'requests']
    const prev = counts.get(one)
    counts.set(one, [one, many, (prev?.[2] ?? 0) + 1])
  }
  return [...counts.values()].map(([one, many, n]) => plural(n, one, many)).join(', ')
}

function Group({ title, rows, tone }: { title: string; rows: string[]; tone: 'warn' | 'gone' | 'stays' }) {
  const mark = tone === 'gone' ? '✕' : tone === 'stays' ? '✓' : '!'
  const color = tone === 'gone' ? 'text-[var(--color-danger)]' : tone === 'stays' ? 'text-[var(--color-success-deep)]' : 'text-[var(--color-warning)]'
  return (
    <div className="rounded-[18px] border border-line bg-surface p-4">
      <p className="text-xs font-extrabold uppercase tracking-[0.1em] text-muted">{title}</p>
      <ul className="mt-2 flex flex-col gap-1.5">
        {rows.map((r) => (
          <li key={r} className="flex gap-2 text-sm font-semibold text-ink">
            <span aria-hidden="true" className={`font-extrabold ${color}`}>{mark}</span>
            {r}
          </li>
        ))}
      </ul>
    </div>
  )
}

export function DeleteAccountForm({ preview, email }: { preview: DeletionPreview; email: string }) {
  const [keepName, setKeepName] = useState(false)
  const [typed, setTyped] = useState('')
  const [step, setStep] = useState<'review' | 'code' | 'done'>('review')
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [emailed, setEmailed] = useState(false)

  if (preview.soleLedOrgs.length) {
    return (
      <div className="flex flex-col gap-4">
        <p role="alert" className="alert alert-danger">
          You&apos;re the only leader of {preview.soleLedOrgs.map((o) => o.name).join(', ')}. Invite another
          leader first, so the organisation can still answer families.
        </p>
        <Link href="/dashboard/organisation/profile#leaders" className="btn btn-accent self-start">Manage leaders</Link>
      </div>
    )
  }

  async function sendCode() {
    setError(null)
    setBusy(true)
    const { error: e } = await createClient().auth.signInWithOtp({ email, options: { shouldCreateUser: false } })
    setBusy(false)
    if (e) return setError(e.message)
    setStep('code')
  }

  async function confirm(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    const { error: bad } = await createClient().auth.verifyOtp({ email, token: code, type: 'email' })
    if (bad) {
      setBusy(false)
      setCode('')
      return setError("That code didn't work. Check the latest email, or send a new one.")
    }
    try {
      const res = await browserApiClient.delete<{ emailed?: boolean }>('/api/me', { confirm: 'DELETE', keepCredit: keepName })
      setEmailed(Boolean(res?.emailed))
      setStep('done')
    } catch {
      setError('Your account was not deleted. Try again in a moment.')
    } finally {
      setBusy(false)
    }
  }

  async function finish() {
    await createClient().auth.signOut()
    window.location.href = '/'
  }

  if (step === 'done') {
    return (
      <div className="flex flex-col items-start gap-4">
        <h2 className="text-2xl font-extrabold text-ink">Your account is deleted</h2>
        <p className="text-muted">Everything listed is gone now. Guides you published stay up for the families using them.</p>
        {emailed && <p className="text-muted">We emailed a confirmation to {email}.</p>}
        <button type="button" onClick={finish} className="auth-submit px-8" data-testid="deleted-done">Done</button>
      </div>
    )
  }

  if (step === 'code') {
    return (
      <form onSubmit={confirm} className="flex max-w-sm flex-col gap-4">
        <p className="text-muted">
          We sent a 6-digit code to <strong className="text-ink">{email}</strong>. Entering it deletes the account.
          This can&apos;t be undone.
        </p>
        <label htmlFor="delete-code" className="auth-label">6-digit code</label>
        <input
          id="delete-code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          className="auth-input font-mono tracking-[0.4em]"
        />
        {error && <p role="alert" className="alert alert-danger">{error}</p>}
        <button type="submit" disabled={code.length !== 6 || busy} className="btn btn-danger">
          {busy ? 'Deleting…' : 'Delete my account'}
        </button>
        <Link href="/dashboard/profile" className="btn btn-quiet">Keep my account</Link>
      </form>
    )
  }

  const deleted = [
    'Your profile, email and sign-in',
    ...(preview.childProfiles ? [plural(preview.childProfiles, 'child profile', 'child profiles')] : []),
    'Drafts, saves, photos and pickup address',
  ]
  const stays = [
    ...(preview.publishedGuides ? [plural(preview.publishedGuides, 'published guide', 'published guides')] : []),
    "Other people's exchanges and messages with you",
  ]

  return (
    <div className="flex flex-col gap-4">
      {preview.open.length > 0 && (
        <Group
          tone="warn"
          title="Open right now"
          rows={[`${openSummary(preview.open)} in progress`, 'These will be cancelled and the other person told.']}
        />
      )}
      <Group tone="gone" title="Deleted now" rows={deleted} />
      <Group tone="stays" title="Stays, without your name" rows={stays} />
      {preview.publishedGuides > 0 && (
        <label className="flex items-center gap-3 font-semibold text-ink">
          <input type="checkbox" checked={keepName} onChange={(e) => setKeepName(e.target.checked)} className="h-5 w-5 accent-[var(--color-brand-dark)]" />
          Keep my name on my published guides
        </label>
      )}
      <label htmlFor="type-delete" className="auth-label">Type DELETE to continue</label>
      <input
        id="type-delete"
        autoCapitalize="characters"
        autoComplete="off"
        value={typed}
        onChange={(e) => setTyped(e.target.value)}
        className="auth-input max-w-sm font-mono"
      />
      {error && <p role="alert" className="alert alert-danger">{error}</p>}
      <button type="button" onClick={sendCode} disabled={typed.trim() !== 'DELETE' || busy} className="btn btn-danger self-start">
        {busy ? 'Sending…' : 'Email me a code'}
      </button>
    </div>
  )
}

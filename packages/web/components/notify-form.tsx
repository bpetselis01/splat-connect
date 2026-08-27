'use client'
/**
 * Email capture on a scaffold page.
 *
 * This is what makes a placeholder earn its route: nine "coming soon" pages that
 * only apologise spend goodwill, whereas nine that measure demand turn build
 * order from a guess into a ranked list.
 *
 * Posts straight to the Hono API — not through lib/browser-api-client.ts,
 * which exists to attach a Supabase session token. This endpoint is
 * deliberately unauthenticated, and a failed submit needs to keep the typed
 * address rather than throw.
 */
import { useState } from 'react'

type State = 'idle' | 'sending' | 'done' | 'error'

export function NotifyForm({ featureKey }: { featureKey: string }) {
  const [email, setEmail] = useState('')
  const [state, setState] = useState<State>('idle')

  if (state === 'done') {
    return (
      // Unmounting the form on success moves focus to <body>, so a live region
      // added in this same commit would announce unreliably — the focus move
      // onto the region itself is what makes a screen reader read it.
      <p
        role="status"
        tabIndex={-1}
        ref={(el) => el?.focus()}
        className="mt-6 text-sm font-semibold text-mint-deep"
      >
        Thanks — we&apos;ll email you when it&apos;s ready.
      </p>
    )
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setState('sending')
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/public/notify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, featureKey }),
      })
      // The typed address survives a failure — retyping it is the one thing that
      // would make someone give up.
      setState(res.ok ? 'done' : 'error')
    } catch {
      setState('error')
    }
  }

  return (
    <form onSubmit={submit} className="mt-6">
      <label htmlFor={`notify-${featureKey}`} className="block text-sm font-semibold text-ink">
        Email address
      </label>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
        <input
          id={`notify-${featureKey}`}
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          // `.field`, not a hand-rolled copy of it. This was the one input on
          // the site spelling out its own border and radius, so it kept the old
          // hairline-on-14px look after .field moved to the board's 2px ink at
          // 6px — the same drift the shared classes exist to prevent.
          className="field min-w-0 flex-1"
        />
        <button type="submit" className="btn btn-accent shrink-0" disabled={state === 'sending'}>
          {state === 'sending' ? 'Sending…' : "Tell me when it's ready"}
        </button>
      </div>
      {state === 'error' && (
        <p role="alert" className="mt-2 text-sm font-semibold text-danger">
          That didn&apos;t send. Try again in a moment.
        </p>
      )}
    </form>
  )
}

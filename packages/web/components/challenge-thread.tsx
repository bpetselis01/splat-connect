/**
 * The client half of the challenge detail page: self-serve Join for anyone
 * signed in who is neither the author nor a participant, and the live
 * thread for anyone who is.
 *
 * GET /api/public/challenges/:id (the server component's fetch) deliberately
 * never returns `messages` — the brief recruits, the conversation stays
 * private even on a public challenge — so this component fetches
 * GET /api/ideas/:id/messages itself, authenticated, through
 * lib/browser-api-client.ts (contrast components/notify-form.tsx, which posts
 * directly because its endpoint is deliberately unauthenticated; every other
 * call here needs the Supabase session token browser-api-client.ts attaches).
 * RLS returns `[]` rather than 403 to a non-participant, which is why
 * `canRead` below is computed from the author/participants the public
 * endpoint already returned, not from whether the fetch came back empty — an
 * author or participant with a genuinely empty thread (nobody has posted yet)
 * would otherwise misread as "not part of this challenge".
 *
 * `nameFor` is resolved from `authorName` and `participants`, both already
 * name-enriched server-side by the admin client (Task 8) — no `profiles` RLS
 * policy is added here for it. Migration 026 solved the equivalent problem for
 * exchanges with a `profiles` select policy ("Transaction parties can view
 * each other's name"); that would be unnecessary widening here, since the
 * detail endpoint already does the join after its own authorisation check.
 * A participant who has since left resolves to "Someone" — acceptable,
 * because their departure is recorded by name in a kind='system' message in
 * the thread itself.
 *
 * Realtime subscription pattern copied from components/live-transaction.tsx
 * (toy_transaction_messages' equivalent): migration 031's comment explains why
 * no extra policy is needed for it — postgres_changes runs each subscriber's
 * stream through the table's existing RLS — and 038 already publishes
 * toy_idea_messages the same way. Re-fetches on INSERT rather than appending
 * the payload row, same reasoning as live-transaction.tsx: one source of
 * truth for the thread, so nothing to de-duplicate against a locally-sent
 * message's own reload.
 */
'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { browserApiClient } from '@/lib/browser-api-client'
import { isApiError } from '@/lib/api-core'
import { ExchangeChat } from '@/components/exchange-chat'
import type { ToyIdeaMessage, ToyIdeaParticipant } from '@splat-connect/types'

export function ChallengeThread({
  ideaId,
  status,
  viewerId,
  authorId,
  authorName,
  participants,
}: {
  ideaId: string
  /** Only 'challenge' or 'graduated' reach here — the public endpoint 404s
   *  anything else. Join is only open on 'challenge' (038's insert policy). */
  status: 'challenge' | 'graduated'
  viewerId: string | null
  authorId: string
  authorName: string | null
  participants: ToyIdeaParticipant[]
}) {
  const router = useRouter()
  const [messages, setMessages] = useState<ToyIdeaMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isAuthor = viewerId !== null && viewerId === authorId
  const isParticipant = viewerId !== null && participants.some((p) => p.profile_id === viewerId)
  const canRead = isAuthor || isParticipant

  const nameFor = useCallback(
    (senderId: string) => {
      if (senderId === authorId) return authorName ?? 'Someone'
      return participants.find((p) => p.profile_id === senderId)?.name ?? 'Someone'
    },
    [authorId, authorName, participants]
  )

  const loadMessages = useCallback(async () => {
    try {
      const rows = await browserApiClient.get<ToyIdeaMessage[]>(`/api/ideas/${ideaId}/messages`)
      setMessages(rows)
    } catch {
      // Handled honestly rather than thrown: the thread just stays as it was.
      setError('Could not load the conversation. Try refreshing.')
    } finally {
      setLoading(false)
    }
  }, [ideaId])

  useEffect(() => {
    // `loading` is only ever read once canRead is true (see the render below),
    // so there is nothing to set here.
    if (!canRead) return

    // Promise.resolve().then(...) rather than calling the (async) loadMessages
    // directly: react-hooks/set-state-in-effect flags any state-setting call
    // that is a direct statement of the effect body, async or not, since it
    // cannot see past the `await` to know the update is not synchronous. The
    // subscribe callback below reacts to an external event and is exempt the
    // same way live-transaction.tsx's router.refresh() is; this line exists so
    // the initial load does not also depend on the socket ever connecting.
    Promise.resolve().then(() => loadMessages())

    const supabase = createClient()
    const channel = supabase
      .channel(`toy-idea:${ideaId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'toy_idea_messages',
          filter: `idea_id=eq.${ideaId}`,
        },
        () => loadMessages()
      )
      // Anything inserted while the socket was down is missed outright, so a
      // successful (re)join refetches too, closing that gap.
      .subscribe((subStatus) => {
        if (subStatus === 'SUBSCRIBED') loadMessages()
      })

    // A backgrounded tab gets its socket throttled or dropped without ever
    // reporting a rejoin, so returning to the tab is its own resync trigger.
    function resyncOnFocus() {
      if (document.visibilityState === 'visible') loadMessages()
    }
    document.addEventListener('visibilitychange', resyncOnFocus)

    return () => {
      document.removeEventListener('visibilitychange', resyncOnFocus)
      supabase.removeChannel(channel)
    }
  }, [canRead, ideaId, loadMessages])

  async function send(body: string) {
    setBusy(true)
    setError(null)
    try {
      await browserApiClient.post(`/api/ideas/${ideaId}/messages`, { body })
      await loadMessages()
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  async function join() {
    setBusy(true)
    setError(null)
    try {
      await browserApiClient.post(`/api/ideas/${ideaId}/join`, {})
      // Re-runs the server component: picks up the new participants row
      // (so canRead flips true here) and the "X joined" system message.
      router.refresh()
    } catch {
      setError('Could not join this challenge. Please try again.')
      setBusy(false)
    }
  }

  // Both leaving and removing hit the same DELETE route (toy-ideas.ts:
  // .../participants/:profileId, RLS's "Leave, or be removed by the
  // author"), so both share this one function; the two buttons below just
  // pass a different profileId. The 404 the API returns for a target who
  // was never a participant ("that person is not part of this challenge")
  // is genuinely reachable here — two admins/browsers racing a Remove — and
  // is surfaced honestly rather than folded into the generic error copy.
  async function removeParticipant(profileId: string) {
    setBusy(true)
    setError(null)
    try {
      await browserApiClient.delete(`/api/ideas/${ideaId}/participants/${profileId}`)
      router.refresh()
    } catch (err) {
      setError(
        isApiError(err) && err.status === 404
          ? 'That person is not part of this challenge.'
          : 'Something went wrong. Please try again.'
      )
      setBusy(false)
    }
  }

  if (viewerId === null) {
    return (
      <p className="text-sm text-muted">
        <Link href="/login" className="font-semibold text-brand-dark underline">
          Sign in
        </Link>{' '}
        to see the conversation and join this challenge.
      </p>
    )
  }

  if (!canRead) {
    return (
      <div className="card flex flex-col gap-3 p-4">
        {error && (
          <p role="alert" className="alert alert-danger">
            {error}
          </p>
        )}
        {status === 'challenge' ? (
          <>
            <p className="text-sm leading-relaxed text-muted">
              Join this challenge to read and take part in the conversation.
            </p>
            <button
              type="button"
              disabled={busy}
              onClick={join}
              className="btn btn-accent self-start"
            >
              {busy ? 'Joining…' : 'Join this challenge'}
            </button>
          </>
        ) : (
          <p className="text-sm leading-relaxed text-muted">
            This challenge has moved on to write-up, so joining is no longer open.
          </p>
        )}
      </div>
    )
  }

  if (loading) {
    return <p className="text-sm text-muted">Loading the conversation…</p>
  }

  return (
    <div>
      {error && (
        <p role="alert" className="alert alert-danger mb-3">
          {error}
        </p>
      )}

      {isParticipant && (
        <button
          type="button"
          disabled={busy}
          onClick={() => removeParticipant(viewerId)}
          className="btn btn-danger btn-sm mb-3"
        >
          Leave this challenge
        </button>
      )}

      {isAuthor && participants.length > 0 && (
        <div className="mb-3 flex flex-col gap-1">
          <p className="field-label">Participants</p>
          <ul className="flex flex-col gap-1">
            {participants.map((p) => (
              <li key={p.profile_id} className="flex items-center justify-between gap-2 text-sm">
                <span className="text-ink">{p.name ?? 'Someone'}</span>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => removeParticipant(p.profile_id)}
                  className="text-xs font-semibold text-apricot-deep underline"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <ExchangeChat
        messages={messages}
        viewerId={viewerId}
        otherPartyName="the group"
        nameFor={nameFor}
        canSend
        busy={busy}
        onSend={send}
      />
    </div>
  )
}

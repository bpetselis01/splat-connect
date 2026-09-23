'use client'

/**
 * Follow, Message and Say thanks — the three buttons beside an organisation's
 * name on its public page (077).
 *
 * - Follow toggles; following means a notification when they publish an event
 *   or a story, and nothing else.
 * - Message goes to the one conversation this person has with the org.
 * - Say thanks opens a short form once: an optional note, the name to sign it
 *   with (prefilled with a first name only), and whether the note may show on
 *   their page. There is no undo, as with a guide's thanks.
 *
 * Signed out, each button goes to sign-up with the way back. A leader of this
 * org sees none of them — they would be following, messaging and thanking
 * themselves — and gets the editor link instead.
 */
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import type { Route } from 'next'
import { useRouter, usePathname } from 'next/navigation'
import { BellRinging, BellSimple, ChatCircleText, HandHeart, PencilSimple } from '@phosphor-icons/react/dist/ssr'
import type { OrgRelationship } from '@splat-connect/types'
import { browserApiClient } from '@/lib/browser-api-client'
import { apiErrorDetail, isApiError } from '@/lib/api-core'
import { useToast } from '@/components/toast'

export function OrgActions({
  orgId,
  orgName,
  me,
  firstName,
}: {
  orgId: string
  orgName: string
  /** null when signed out. */
  me: OrgRelationship | null
  firstName: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const showToast = useToast()
  const [following, setFollowing] = useState(me?.following ?? false)
  const [thanked, setThanked] = useState(!!me?.thanks)
  const [asking, setAsking] = useState(false)
  const [busy, setBusy] = useState(false)

  if (me?.leads) {
    return (
      <Link href="/dashboard/organisation/profile" className="btn btn-quiet btn-sm gap-2">
        <PencilSimple weight="bold" aria-hidden="true" />
        Edit your page
      </Link>
    )
  }

  const signUp = (reason: string) => router.push(`/signup?next=${encodeURIComponent(pathname)}&reason=${reason}` as Route)

  async function toggleFollow() {
    if (!me) return signUp('follow')
    setBusy(true)
    try {
      if (following) await browserApiClient.delete(`/api/organizations/${orgId}/follow`)
      else await browserApiClient.post(`/api/organizations/${orgId}/follow`, {})
      setFollowing(!following)
      if (!following) showToast(`You will hear when ${orgName} publishes an event or a story`)
    } catch {
      showToast('That did not go through. Try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={toggleFollow}
        disabled={busy}
        aria-pressed={following}
        className="btn btn-quiet btn-sm gap-2"
      >
        {following ? <BellRinging weight="fill" aria-hidden="true" /> : <BellSimple weight="bold" aria-hidden="true" />}
        {following ? 'Following' : 'Follow'}
      </button>
      <Link
        href={me ? `/organizations/${orgId}/message` : `/signup?next=${encodeURIComponent(pathname)}&reason=message`}
        className="btn btn-primary btn-sm gap-2"
      >
        <ChatCircleText weight="fill" aria-hidden="true" />
        Message
      </Link>
      <button
        type="button"
        onClick={() => (me ? setAsking(true) : signUp('thanks'))}
        disabled={thanked}
        className="btn btn-quiet btn-sm gap-2"
      >
        <HandHeart weight="fill" className="text-apricot" aria-hidden="true" />
        {thanked ? 'Thanked' : 'Say thanks'}
      </button>
      {asking && (
        <ThanksDialog
          orgId={orgId}
          orgName={orgName}
          firstName={firstName}
          onClose={() => setAsking(false)}
          onSent={() => {
            setAsking(false)
            setThanked(true)
            showToast(`Thanks sent — ${orgName}'s leaders will see it`)
            router.refresh()
          }}
        />
      )}
    </div>
  )
}

/**
 * Mounting opens it and unmounting resets it — accept-pickup-dialog.tsx's
 * mechanics, so the focus trap and Escape come from the platform.
 */
function ThanksDialog({
  orgId,
  orgName,
  firstName,
  onClose,
  onSent,
}: {
  orgId: string
  orgName: string
  firstName: string
  onClose: () => void
  onSent: () => void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const [note, setNote] = useState('')
  const [byline, setByline] = useState(firstName)
  const [show, setShow] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    ref.current?.showModal()
  }, [])

  async function send(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await browserApiClient.post(`/api/organizations/${orgId}/thanks`, {
        note,
        byline,
        show_note: show,
      })
      onSent()
    } catch (err) {
      // 409: thanked already, from another tab — the same end state.
      if (isApiError(err) && err.status === 409) onSent()
      else setError(apiErrorDetail(err) ?? 'That did not send. Try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <dialog ref={ref} onClose={onClose} aria-labelledby="thanks-title" className="dialog-panel">
      <form onSubmit={send} className="flex flex-col gap-4">
        <h2 id="thanks-title" className="font-display text-xl font-extrabold text-ink">
          Say thanks to {orgName}
        </h2>
        <label>
          <span className="form-label">
            A note <span>(optional)</span>
          </span>
          <textarea
            className="field"
            rows={3}
            maxLength={200}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="What they did, in a sentence."
          />
          <span className="mt-1 block text-right text-xs text-muted">{note.length}/200</span>
        </label>
        <label>
          <span className="form-label">Sign it as</span>
          <input className="field" maxLength={60} value={byline} onChange={(e) => setByline(e.target.value)} />
          <span className="mt-1 block text-[13px] text-muted">
            A first name, or a first name and a town. Nothing else about you is shown.
          </span>
        </label>
        <label className="flex items-center gap-2.5 text-sm font-bold text-ink">
          <input type="checkbox" checked={show} disabled={!note.trim()} onChange={(e) => setShow(e.target.checked)} />
          Show this on their page
        </label>
        {error && (
          <p role="alert" className="alert alert-danger">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn btn-quiet" onClick={() => ref.current?.close()}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            <HandHeart weight="fill" aria-hidden="true" />
            Send thanks
          </button>
        </div>
      </form>
    </dialog>
  )
}

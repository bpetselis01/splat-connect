'use client'

/**
 * Say thanks to a person from their profile (117, POST /api/contributors/:id/thanks).
 * Once per person; an optional note that only they will see. Signed out goes to
 * /signup with the reason, like ThanksButton. The public profile carries no
 * "already thanked" flag, so a 409 is how a repeat tells you.
 */
import { useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { HandHeart } from '@phosphor-icons/react/dist/ssr'
import { browserApiClient } from '@/lib/browser-api-client'
import { isApiError } from '@splat-connect/types'

export function PersonThanksButton({ profileId, name, signedIn }: { profileId: string; name: string; signedIn: boolean }) {
  const router = useRouter()
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [note, setNote] = useState('')
  const [pending, setPending] = useState(false)
  const [thanked, setThanked] = useState(false)
  const [said, setSaid] = useState<{ ok: boolean; text: string } | null>(null)

  function start() {
    if (!signedIn) router.push(`/signup?next=${encodeURIComponent(pathname)}&reason=thanks`)
    else setOpen(true)
  }

  async function send() {
    setPending(true)
    try {
      const text = note.trim()
      await browserApiClient.post(`/api/contributors/${profileId}/thanks`, text ? { note: text } : {})
      setThanked(true)
      setOpen(false)
      setSaid({ ok: true, text: 'Thanks sent — they will see it in their notifications' })
    } catch (err) {
      if (isApiError(err) && err.status === 409) {
        setThanked(true)
        setOpen(false)
        setSaid({ ok: true, text: 'You already thanked them' })
      } else setSaid({ ok: false, text: 'Could not send that. Try again.' })
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="flex max-w-[360px] flex-col items-end gap-2">
      <button type="button" onClick={start} disabled={thanked} aria-expanded={open} className="btn btn-quiet gap-2">
        <HandHeart weight="fill" className="text-apricot" aria-hidden="true" />
        {thanked ? 'Thanked' : `Say thanks to ${name}`}
      </button>
      {open && (
        <div className="flex w-full flex-col gap-2 rounded-[18px] border border-line bg-surface p-3.5">
          <label htmlFor="person-thanks-note" className="text-sm font-bold text-ink">Add a note (optional)</label>
          <textarea
            id="person-thanks-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={200}
            rows={3}
            className="field"
          />
          <p className="m-0 text-[13px] text-muted">Only they will see this.</p>
          <button type="button" onClick={() => void send()} disabled={pending} className="btn btn-primary btn-sm self-end">
            Send thanks
          </button>
        </div>
      )}
      {said && (
        <span role={said.ok ? 'status' : 'alert'} className={`text-sm font-semibold ${said.ok ? 'text-muted' : 'text-[var(--bad)]'}`}>
          {said.text}
        </span>
      )}
    </div>
  )
}

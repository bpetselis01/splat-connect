'use client'
/**
 * Who leads the organisation, adding a co-leader by the email their SPLAT
 * account uses, and stepping down (never the last leader — the API refuses).
 * The account-deletion blocker sends a sole leader here.
 */
import { useCallback, useEffect, useState } from 'react'
import { apiMessage } from '@splat-connect/types'
import { browserApiClient } from '@/lib/browser-api-client'

type Leader = { user_id: string; name: string; email: string; you: boolean }

export function OrgLeaders({ orgId }: { orgId: string }) {
  const [leaders, setLeaders] = useState<Leader[]>([])
  const [email, setEmail] = useState('')
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => {
    browserApiClient.get<Leader[]>(`/api/organizations/${orgId}/leaders`).then(setLeaders).catch(() => setLeaders([]))
  }, [orgId])
  useEffect(load, [load])

  async function add(e: React.FormEvent) {
    e.preventDefault()
    setNote(null)
    setBusy(true)
    try {
      await browserApiClient.post(`/api/organizations/${orgId}/leaders`, { email })
      setEmail('')
      setNote({ ok: true, text: 'Added. They lead the organisation now.' })
      load()
    } catch (err) {
      setNote({ ok: false, text: apiMessage(err, 'Could not add them. Try again.') })
    } finally {
      setBusy(false)
    }
  }

  async function stepDown() {
    setNote(null)
    try {
      await browserApiClient.delete(`/api/organizations/${orgId}/leaders/me`)
      window.location.href = '/dashboard'
    } catch (err) {
      setNote({ ok: false, text: apiMessage(err, 'Could not step down. Try again.') })
    }
  }

  return (
    <section id="leaders" className="mt-8 rounded-[24px] border border-line bg-surface p-6 shadow-e1">
      <h2 className="text-xl font-extrabold text-ink">Leaders</h2>
      <ul className="mt-3 flex flex-col gap-2">
        {leaders.map((l) => (
          <li key={l.user_id} className="text-[15px]">
            <span className="font-extrabold text-ink">{l.name || l.email}{l.you ? ' (you)' : ''}</span>
            <span className="ml-2 text-muted">{l.email}</span>
          </li>
        ))}
      </ul>
      <form onSubmit={add} className="mt-5 flex flex-wrap items-end gap-3">
        <div className="flex min-w-[240px] flex-1 flex-col gap-1.5">
          <label htmlFor="leader-email" className="auth-label">Add a leader</label>
          <input
            id="leader-email"
            type="email"
            placeholder="The email their SPLAT account uses"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="auth-input"
          />
        </div>
        <button type="submit" disabled={!email.trim() || busy} className="btn btn-accent">Add leader</button>
      </form>
      {note && (
        <p role={note.ok ? 'status' : 'alert'} className={`mt-3 text-sm font-semibold ${note.ok ? 'text-[var(--color-success-deep)]' : 'text-[var(--color-danger)]'}`}>
          {note.text}
        </p>
      )}
      {leaders.length > 1 && (
        <button type="button" onClick={stepDown} className="btn btn-danger mt-5">Step down as leader</button>
      )}
    </section>
  )
}

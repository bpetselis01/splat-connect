'use client'

import { useState } from 'react'
import type { ToyTransactionDetail } from '@splat-connect/types'

export function ToyTransactionThread({
  transaction,
  viewerId,
  onSendMessage,
  onAccept,
  onReject,
  onWithdraw,
  onConfirm,
}: {
  transaction: ToyTransactionDetail
  viewerId: string
  onSendMessage: (body: string) => Promise<void>
  onAccept: () => Promise<void>
  onReject: () => Promise<void>
  onWithdraw: () => Promise<void>
  onConfirm: (code: string) => Promise<void>
}) {
  const [draft, setDraft] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const tx = transaction
  const isOwner = viewerId === tx.owner_id
  const nameFor = (senderId: string) => (senderId === tx.owner_id ? tx.owner_name : tx.requester_name)

  async function run(fn: () => Promise<void>) {
    setBusy(true)
    setError(null)
    try {
      await fn()
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  async function send() {
    if (!draft.trim()) return
    const body = draft
    setDraft('')
    await run(() => onSendMessage(body))
  }

  const open = tx.status === 'requested' || tx.status === 'accepted'
  const canConfirm = tx.status === 'accepted' && (tx.type === 'exchange' || isOwner)
  const alreadyConfirmed = isOwner ? tx.owner_confirmed_at !== null : tx.requester_confirmed_at !== null
  const myCode = isOwner ? tx.owner_code : tx.requester_code
  const showMyCode = tx.status === 'accepted' && (tx.type === 'exchange' || !isOwner)

  return (
    <div className="flex flex-col gap-6">
      {error && (
        <p role="alert" className="alert alert-danger">
          {error}
        </p>
      )}

      <ul className="flex flex-col gap-2">
        {tx.messages.map((m) => (
          <li key={m.id} className={`card-flat px-4 py-3 text-sm ${m.kind === 'system' ? 'italic text-muted' : ''}`}>
            {m.kind === 'user' && (
              <p className="font-semibold text-ink">{m.sender_id === viewerId ? 'You' : nameFor(m.sender_id)}</p>
            )}
            <p>{m.body}</p>
          </li>
        ))}
      </ul>

      {open && (
        <div className="flex gap-2">
          <label htmlFor="message" className="sr-only">
            Message
          </label>
          <textarea id="message" className="field flex-1" rows={2} value={draft} onChange={(e) => setDraft(e.target.value)} />
          <button type="button" disabled={busy || !draft.trim()} onClick={send} className="btn btn-accent">
            Send
          </button>
        </div>
      )}

      {tx.status === 'requested' && isOwner && (
        <div className="flex gap-2">
          <button type="button" disabled={busy} onClick={() => run(onAccept)} className="btn btn-accent">
            Accept
          </button>
          <button type="button" disabled={busy} onClick={() => run(onReject)} className="btn btn-quiet">
            Reject
          </button>
        </div>
      )}

      {open && (
        <button type="button" disabled={busy} onClick={() => run(onWithdraw)} className="btn btn-quiet">
          Withdraw
        </button>
      )}

      {tx.status === 'accepted' && (tx.pickup_line1 || tx.pickup_suburb) && (
        <div className="card-flat px-4 py-3 text-sm">
          <p className="font-semibold text-ink">Pickup location</p>
          <p>{[tx.pickup_line1, tx.pickup_suburb, tx.pickup_state, tx.pickup_postcode].filter(Boolean).join(', ')}</p>
        </div>
      )}

      {showMyCode && myCode && (
        <p className="text-sm text-muted">
          Your handoff code: <span className="font-bold text-ink">{myCode}</span>
        </p>
      )}

      {canConfirm && !alreadyConfirmed && (
        <div className="flex gap-2">
          <label htmlFor="handoff-code" className="sr-only">
            Enter the other party&apos;s code
          </label>
          <input
            id="handoff-code"
            className="field"
            placeholder="Enter their code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          <button type="button" disabled={busy || !code.trim()} onClick={() => run(() => onConfirm(code))} className="btn btn-accent">
            Confirm handoff
          </button>
        </div>
      )}

      {tx.status === 'completed' && <p className="font-semibold text-mint-deep">Handoff complete.</p>}
      {tx.status === 'rejected' && <p className="text-sm text-muted">This request was declined.</p>}
      {tx.status === 'withdrawn' && <p className="text-sm text-muted">This request was withdrawn.</p>}
    </div>
  )
}

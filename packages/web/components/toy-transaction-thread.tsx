/**
 * An exchange thread: the conversation, and the controls that move the
 * transaction through its lifecycle.
 *
 * Layout is a two-column grid — conversation left, a sticky sidebar right —
 * collapsing to one column under 900px with the sidebar on top. The messages
 * used to sit above a flat stack of six unrelated controls, which left the
 * conversation with no boundary and the actions with no home; the sidebar is
 * that home. See .exchange-grid in app/globals.css for why the sidebar leads in
 * the DOM.
 *
 * The donation/exchange asymmetry is the reason `showMyCode` and `canConfirm`
 * are separate expressions rather than one "can act" flag: a donation is a
 * one-way handoff (the requester holds a code, the owner types it in) while an
 * exchange is mutual, so on a donation each party sees exactly one of the two.
 */
'use client'

import { useState } from 'react'
import type { PickupAddress, ToyTransactionDetail } from '@splat-connect/types'
import { AcceptPickupDialog } from '@/components/accept-pickup-dialog'
import { ExchangeChat } from '@/components/exchange-chat'
import { ExchangeStatusBadge } from '@/components/exchange-status-badge'

export const BLOCKED_ACCEPT_HINT =
  'You need to either complete the current transaction or withdraw from it.'

export function ToyTransactionThread({
  transaction,
  viewerId,
  viewerDefaultAddress = null,
  onSendMessage,
  onAccept,
  onReject,
  onWithdraw,
  onConfirm,
}: {
  transaction: ToyTransactionDetail
  viewerId: string
  /** The viewer's saved profile address, seeded into the accept dialog. */
  viewerDefaultAddress?: PickupAddress | null
  onSendMessage: (body: string) => Promise<void>
  onAccept: (address: PickupAddress) => Promise<void>
  onReject: () => Promise<void>
  onWithdraw: () => Promise<void>
  onConfirm: (code: string) => Promise<void>
}) {
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [acceptOpen, setAcceptOpen] = useState(false)

  const tx = transaction
  const isOwner = viewerId === tx.owner_id
  const nameFor = (senderId: string) => (senderId === tx.owner_id ? tx.owner_name : tx.requester_name)
  const otherPartyName = isOwner ? tx.requester_name : tx.owner_name

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

  const open = tx.status === 'requested' || tx.status === 'accepted'
  const canConfirm = tx.status === 'accepted' && (tx.type === 'exchange' || isOwner)
  const alreadyConfirmed = isOwner ? tx.owner_confirmed_at !== null : tx.requester_confirmed_at !== null
  const myCode = isOwner ? tx.owner_code : tx.requester_code
  const showMyCode = tx.status === 'accepted' && (tx.type === 'exchange' || !isOwner)
  const pickup = [tx.pickup_line1, tx.pickup_suburb, tx.pickup_state, tx.pickup_postcode]
    .filter(Boolean)
    .join(', ')

  return (
    <div className="exchange-grid">
      <aside className="exchange-side">
        {error && (
          <p role="alert" className="alert alert-danger">
            {error}
          </p>
        )}

        <div className="card flex flex-col gap-3 p-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-bold text-ink">Details</h2>
            <ExchangeStatusBadge status={tx.status} />
          </div>

          <dl className="flex flex-col text-sm">
            <div className="flex justify-between gap-3 border-b border-line py-1.5">
              <dt className="font-bold text-muted">Type</dt>
              <dd className="font-bold text-ink">{tx.type === 'donation' ? 'Donation' : 'Exchange'}</dd>
            </div>
            <div className="flex justify-between gap-3 border-b border-line py-1.5">
              <dt className="font-bold text-muted">With</dt>
              <dd className="text-right font-bold text-ink">{otherPartyName}</dd>
            </div>
            {/* The requester is always the one offering, so the label turns
                around depending on which side of it you are. */}
            {tx.type === 'exchange' && tx.offered_toy_name && (
              <div className="flex justify-between gap-3 border-b border-line py-1.5">
                <dt className="font-bold text-muted">{isOwner ? 'They offered' : 'You offered'}</dt>
                <dd className="text-right font-bold text-ink">{tx.offered_toy_name}</dd>
              </div>
            )}
            {tx.status === 'accepted' && pickup && (
              <div className="flex justify-between gap-3 py-1.5">
                <dt className="font-bold text-muted">Pickup</dt>
                <dd className="text-right font-bold text-ink">{pickup}</dd>
              </div>
            )}
          </dl>
        </div>

        {tx.status === 'requested' && isOwner && (
          <div className="card flex flex-col gap-3 p-4">
            <h2 className="text-base font-bold text-ink">
              {otherPartyName} wants this toy
            </h2>
            <p className="text-sm leading-relaxed text-muted">
              Accepting shares your pickup address and gives you both a handoff code.
            </p>
            <div className="flex flex-wrap gap-2">
              {/* Reject stays live while blocked: declining a request the owner
                  does not want is harmless mid-handoff on another one. */}
              <button
                type="button"
                disabled={busy || tx.blocked_by_rival_accept}
                title={tx.blocked_by_rival_accept ? BLOCKED_ACCEPT_HINT : undefined}
                onClick={() => setAcceptOpen(true)}
                className="btn btn-accent"
              >
                Accept
              </button>
              <button type="button" disabled={busy} onClick={() => run(onReject)} className="btn btn-quiet">
                Reject
              </button>
            </div>
            {tx.blocked_by_rival_accept && <p className="text-sm text-muted">{BLOCKED_ACCEPT_HINT}</p>}
            {acceptOpen && (
              <AcceptPickupDialog
                defaultAddress={viewerDefaultAddress}
                busy={busy}
                onCancel={() => setAcceptOpen(false)}
                onSubmit={async (address) => {
                  setAcceptOpen(false)
                  await run(() => onAccept(address))
                }}
              />
            )}
          </div>
        )}

        {tx.status === 'accepted' && (
          <div className="card flex flex-col gap-3 p-4">
            <h2 className="text-base font-bold text-ink">Handoff</h2>

            {showMyCode && myCode && (
              <div>
                {/* Label and digits stay in one node: the e2e reads this
                    element's textContent and pulls the code out with /\d{6}/,
                    so splitting them would hide the code from the test that
                    proves the handoff works. */}
                <p className="text-sm font-bold text-muted">
                  Your handoff code: <span className="handoff-code">{myCode}</span>
                </p>
                <p className="mt-1 text-sm leading-relaxed text-muted">
                  Read this to {otherPartyName} at pickup.
                </p>
              </div>
            )}

            {canConfirm && !alreadyConfirmed && (
              <div className="flex flex-col gap-2">
                <label htmlFor="handoff-code" className="field-label">
                  Enter the other party&apos;s code
                </label>
                <input
                  id="handoff-code"
                  className="field"
                  inputMode="numeric"
                  placeholder="Enter their code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                />
                <button
                  type="button"
                  disabled={busy || !code.trim()}
                  onClick={() => run(() => onConfirm(code))}
                  className="btn btn-accent"
                >
                  Confirm handoff
                </button>
              </div>
            )}

            {/* Without this, confirming made the input disappear and put nothing
                in its place, which reads as a click that failed. */}
            {canConfirm && alreadyConfirmed && (
              <p className="text-sm leading-relaxed text-muted">
                You have confirmed the handoff — waiting on {otherPartyName}.
              </p>
            )}
          </div>
        )}

        {/* self-start so it stays a button: stretched to the sidebar's full
            width it reads as another white card. */}
        {open && (
          <button
            type="button"
            disabled={busy}
            onClick={() => run(onWithdraw)}
            className="btn btn-quiet self-start"
          >
            Withdraw
          </button>
        )}

        {tx.status === 'completed' && (
          <p className="card p-4 font-bold text-mint-deep">Handoff complete.</p>
        )}
        {tx.status === 'rejected' && (
          <p className="card p-4 text-sm text-muted">This request was declined.</p>
        )}
        {tx.status === 'withdrawn' && (
          <p className="card p-4 text-sm text-muted">This request was withdrawn.</p>
        )}
      </aside>

      <div className="exchange-conversation">
        <ExchangeChat
          messages={tx.messages}
          viewerId={viewerId}
          otherPartyName={otherPartyName}
          nameFor={nameFor}
          canSend={open}
          busy={busy}
          onSend={(body) => run(() => onSendMessage(body))}
        />
      </div>
    </div>
  )
}

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

import { useState, type ReactNode } from 'react'
import Link from 'next/link'
import { isOwnerSide } from '@splat-connect/types'
import type { PickupAddress, ToyTransactionDetail } from '@splat-connect/types'
import { AcceptPickupDialog } from '@/components/accept-pickup-dialog'
import { ExchangeChat } from '@/components/exchange-chat'
import { Badge } from '@/components/badge'

export const BLOCKED_ACCEPT_HINT =
  'You need to either complete the current transaction or withdraw from it.'

export function ToyTransactionThread({
  transaction,
  viewerId,
  ledOrgIds = [],
  viewerDefaultAddress = null,
  onSendMessage,
  onAccept,
  onReject,
  onWithdraw,
  onConfirm,
  asideTop,
}: {
  transaction: ToyTransactionDetail
  viewerId: string
  /** The orgs the viewer leads. An org handoff has no owner_id, so without
   *  these a leader reads as the requester: wrong code, wrong buttons, wrong
   *  side of every label on this screen. */
  ledOrgIds?: readonly string[]
  /** The viewer's saved profile address, seeded into the accept dialog. */
  viewerDefaultAddress?: PickupAddress | null
  onSendMessage: (body: string) => Promise<void>
  /** Null when an organisation is accepting — its address is not the leader's
   *  to choose, and the server reads it from the org record. */
  onAccept: (address: PickupAddress | null) => Promise<void>
  /** The reason is required on a print job: "declining needs a reason" is the
   *  artboard's rule, and the API refuses one without it. */
  onReject: (reason?: string) => Promise<void>
  onWithdraw: () => Promise<void>
  onConfirm: (code: string) => Promise<void>
  /** The tinted next-step card the canonical layout puts first in the sidebar.
   *  A build's is about its extra stage, which only the build page knows. */
  asideTop?: ReactNode
}) {
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [acceptOpen, setAcceptOpen] = useState(false)
  const [declineReason, setDeclineReason] = useState<string | null>(null)

  const tx = transaction
  const isOwner = isOwnerSide(tx, viewerId, ledOrgIds)
  // Keyed off the requester rather than the owner: an org handoff has no
  // owner_id, so every message a leader sent would otherwise be attributed to
  // the family. owner_name is the organisation's name in that case.
  const nameFor = (senderId: string) =>
    senderId === tx.requester_id ? tx.requester_name : tx.owner_name
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
  const isBuild = tx.type === 'build'
  /*
   * A build's handover is mutual like an exchange's: the family is receiving
   * something made for them, and their confirmation is the only record that it
   * arrived. It is also gated on the working shot being approved — confirming
   * before that would close a build the family has never seen (057).
   */
  const canConfirm =
    tx.status === 'accepted' &&
    (tx.type !== 'donation' || isOwner) &&
    (!isBuild || tx.work_approved_at !== null) &&
    // Nothing is collected before it exists. 058's constraint says the same.
    (tx.type !== 'print' || tx.ready_at !== null)
  const alreadyConfirmed = isOwner ? tx.owner_confirmed_at !== null : tx.requester_confirmed_at !== null
  const myCode = isOwner ? tx.owner_code : tx.requester_code
  const showMyCode = tx.status === 'accepted' && (tx.type !== 'donation' || !isOwner)

  return (
    <div className="exchange-grid">
      <aside className="exchange-side">
        {error && (
          <p role="alert" className="alert alert-danger">
            {error}
          </p>
        )}

        {/* First in the sidebar, per the canonical detail layout: what to do
            next comes before the supporting panels and the quiet links. */}
        {asideTop}

        <div className="card flex flex-col gap-3 p-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-bold text-ink">Details</h2>
            <Badge status={tx.status} />
          </div>

          <dl className="flex flex-col text-sm">
            <div className="flex justify-between gap-3 border-b border-line py-1.5">
              <dt className="font-bold text-muted">Type</dt>
              <dd className="font-bold text-ink">
                {
                  { donation: 'Donation', exchange: 'Exchange', build: 'Build', print: 'Print' }[
                    tx.type
                  ]
                }
              </dd>
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
            {/* Pickup used to sit here. It moved to the stage-facts panel under
                the rail, where it belongs: it is a fact about the handover
                stage, and that panel shows it beside when, the viewer's code
                and who has confirmed. Rendering it in both places put the same
                address on screen twice, which is how the duplication was
                found — a strict locator matched two elements. */}
          </dl>
        </div>

        {tx.status === 'requested' && isOwner && (
          <div className="card flex flex-col gap-3 p-4">
            <h2 className="text-base font-bold text-ink">
              {isBuild
                ? `${otherPartyName} is asking for a build`
                : tx.type === 'print'
                  ? `${otherPartyName} is asking for a print`
                  : `${otherPartyName} wants this toy`}
            </h2>
            <p className="text-sm leading-relaxed text-muted">
              {tx.owner_org_id
                ? "Accepting shares your organisation's pickup address and gives you both a handoff code."
                : 'Accepting shares your pickup address and gives you both a handoff code.'}
            </p>
            <div className="flex flex-wrap gap-2">
              {/* Reject stays live while blocked: declining a request the owner
                  does not want is harmless mid-handoff on another one. */}
              <button
                type="button"
                disabled={busy || tx.blocked_by_rival_accept}
                title={tx.blocked_by_rival_accept ? BLOCKED_ACCEPT_HINT : undefined}
                // No dialog for an organisation: its address is fixed and the
                // server ignores anything sent here, so asking would be a form
                // whose answer is discarded.
                onClick={() =>
                  tx.owner_org_id ? run(() => onAccept(null)) : setAcceptOpen(true)
                }
                className="btn btn-accent"
              >
                Accept
              </button>
              {/* A print job's decline opens for a reason first. Everything
                  else declines outright, because nothing asks for one. */}
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  tx.type === 'print' ? setDeclineReason('') : run(() => onReject())
                }
                className="btn btn-quiet"
              >
                {tx.type === 'print' ? 'Decline' : 'Reject'}
              </button>
            </div>
            {declineReason !== null && (
              <form
                className="flex flex-col gap-2"
                onSubmit={async (e) => {
                  e.preventDefault()
                  const reason = declineReason.trim()
                  if (!reason) return
                  setDeclineReason(null)
                  await run(() => onReject(reason))
                }}
              >
                <label htmlFor="decline-reason" className="field-label">
                  Why you cannot take it
                </label>
                <textarea
                  id="decline-reason"
                  className="field"
                  rows={3}
                  maxLength={500}
                  value={declineReason}
                  onChange={(e) => setDeclineReason(e.target.value)}
                  placeholder="Bed is too small for the base plate."
                />
                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="btn btn-quiet"
                    disabled={busy || !declineReason.trim()}
                  >
                    Send the decline
                  </button>
                  <button
                    type="button"
                    className="btn btn-quiet"
                    onClick={() => setDeclineReason(null)}
                    disabled={busy}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}

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

        {/* A build's handover cannot start until the family has approved the
            working shot, so its code and its confirm box do not appear before
            then — showing a code for a meeting that cannot be arranged yet is
            the same class of mistake as a dead control. */}
        {tx.status === 'accepted' &&
          (!isBuild || tx.work_approved_at) &&
          (tx.type !== 'print' || tx.ready_at) && (
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

        {/* The offer to list lives here rather than in the thread, because the
            sidebar is per-viewer and the thread is not: on a donation only one
            party received anything, and a system message asking "want to list
            this?" would be read by the person it does not apply to.

            Through the toy's edit screen rather than a one-click publish —
            listing needs an offer_type (donation/exchange/both), which a yes/no
            button cannot answer and which nobody should have defaulted for
            them. Declining is not clicking: the toy stays a draft they own. */}
        {tx.status === 'completed' && (
          <div className="card flex flex-col gap-3 p-4">
            <p className="font-bold text-ink">Handoff complete.</p>
            {tx.received_toy?.status === 'draft' && (
              <>
                <p className="text-sm leading-relaxed text-muted">
                  {tx.received_toy.name} is yours now. Add it to the toy library if you would
                  like others to be able to request it.
                </p>
                <Link
                  href={`/dashboard/toys/${tx.received_toy.id}`}
                  className="btn btn-accent self-start"
                >
                  Add to toy library
                </Link>
              </>
            )}
          </div>
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

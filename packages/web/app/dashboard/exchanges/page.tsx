import Link from 'next/link'
import type { Route } from 'next'
import {
  ArrowBendDownRight,
  ArrowsLeftRight,
  BellRinging,
  ChatCircleDots,
  Gift,
  Hammer as HammerIcon,
  LockSimple,
  Handshake,
} from '@phosphor-icons/react/dist/ssr'
import { requireCapabilities } from '@/lib/require-capabilities'
import { apiClient } from '@/lib/api-client'
import { Badge } from '@/components/badge'
import { RecordCard } from '@/components/record-card'
import { exchangeStages } from '@/lib/exchange-stages'
import { buildStages } from '@/lib/build-stages'
import { BoundaryLink } from '@/components/boundary-link'
import { MarkNotificationsRead } from '@/components/mark-notifications-read'
import { needsAction, actionLabel, isOwnerSide, subjectName } from '@splat-connect/types'
import type { ToyTransactionSummary, ToyTransactionStatus } from '@splat-connect/types'

function TransactionRow({
  tx,
  viewerId,
  ledOrgIds,
}: {
  tx: ToyTransactionSummary
  viewerId: string
  ledOrgIds: string[]
}) {
  /*
   * The meta line is "kind with counterparty · when". A leader's personal
   * handoffs and their organisation's arrive in one list and nothing else tells
   * them apart — which of the two they are answering as changes who the toy
   * belongs to — so the organisation gets the board's own "On behalf of" line.
   */
  const kind = tx.type === 'donation' ? 'Donation' : tx.type === 'build' ? 'Build' : 'Exchange'
  const isBuild = tx.type === 'build'
  // A build lives on its own route: same layout, build vocabulary (057).
  const href = (
    isBuild ? `/dashboard/exchanges/build/${tx.id}` : `/dashboard/exchanges/${tx.id}`
  ) as Route
  const isOwner = isOwnerSide(tx, viewerId, ledOrgIds)
  const meta = [
    `${kind} with ${tx.other_party_name}`,
    new Date(tx.created_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }),
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <li>
      <RecordCard
        icon={
          tx.type === 'donation' ? (
            <Gift size={22} weight="duotone" />
          ) : isBuild ? (
            <HammerIcon size={22} weight="duotone" />
          ) : (
            <ArrowsLeftRight size={22} weight="duotone" />
          )
        }
        tint={
          tx.type === 'donation'
            ? 'var(--tmint)'
            : isBuild
              ? 'var(--tamber)'
              : 'var(--tviolet)'
        }
        title={subjectName(tx)}
        meta={meta}
        sub={tx.acting_for_org_name ? `On behalf of ${tx.acting_for_org_name}` : undefined}
        pill={<Badge status={tx.status} />}
        // Derived from this row's own status and confirmations. A build has a
        // vocabulary of its own — five steps, one of them the working shot —
        // so it gets its own derivation rather than exchange words over build
        // data. See lib/build-stages.ts and lib/exchange-stages.ts.
        stages={isBuild ? buildStages(tx) : exchangeStages(tx)}
        note={
          tx.last_message
              ? `${
                  tx.last_message.sender_id === viewerId && tx.last_message.kind === 'user'
                    ? 'You: '
                    : ''
                }${tx.last_message.body}`
              : undefined
        }
        // Exactly one filled primary, and on a conversation record it is Thread.
        primary={
          <Link href={href} className="btn btn-primary no-underline">
            <ChatCircleDots size={18} weight="fill" aria-hidden="true" />
            Thread
          </Link>
        }
        /*
         * The stage-specific action, right-aligned past the spacer. It is a link
         * to the thread rather than a control that acts from here: accepting or
         * confirming a handoff is a decision you make with the conversation in
         * front of you, and the brief's "no dead controls" cuts both ways — a
         * button that acts without that context is worse than a link that takes
         * you to it.
         */
        stageAction={
          tx.blocked_by_rival_accept ? (
            <span className="inline-flex items-center gap-2 text-[13px] font-bold text-muted">
              <LockSimple weight="fill" aria-hidden="true" />
              Locked — another request accepted
            </span>
          ) : needsAction(tx, viewerId, ledOrgIds) ? (
            <Link href={href} className="stage-pill gap-2 px-[13px] py-1.5 text-[13px] no-underline" style={{ background: 'var(--tmint)', color: 'var(--tink)' }}>
              <ArrowBendDownRight weight="fill" aria-hidden="true" />
              {actionLabel(tx, isOwner)}
            </Link>
          ) : undefined
        }
      />
    </li>
  )
}

export default async function ExchangesPage() {
  const caps = await requireCapabilities()

  const viewerId = caps.profile.id
  // Without these, an org request waiting on a leader is never marked "waiting
  // on you" — the row is visible but reads as somebody else's problem.
  const ledOrgIds = caps.ledOrgs.map((org) => org.id)
  const transactions = await apiClient.get<ToyTransactionSummary[]>('/api/toy-transactions')

  /*
   * Two lists, one fetch. "Exchange history" is named on the My SPLAT card, and
   * until now this page rendered every status in one pile — a handoff you
   * confirmed last March sat between two requests waiting on you today.
   *
   * Active is the pair that can still change: a request you have not answered,
   * and an acceptance nobody has confirmed. Everything else is settled.
   */
  const ACTIVE: ToyTransactionStatus[] = ['requested', 'accepted']
  const active = transactions.filter((tx) => ACTIVE.includes(tx.status))
  const history = transactions.filter((tx) => !ACTIVE.includes(tx.status))
  const waiting = active.filter((tx) => needsAction(tx, viewerId, ledOrgIds)).length

  return (
    <div className="max-w-[880px]">
      <MarkNotificationsRead bucket="exchanges" />

      <div className="flex flex-wrap items-start justify-between gap-5">
        <div className="min-w-0">
          <h1 className="title-hub">My exchanges</h1>
          <p className="mt-2 max-w-[62ch] text-[15px] text-muted">
            Toys you have asked for, toys people have asked you for, and builds you have asked a
            maker for. Each one is a conversation until the handoff is confirmed by both sides.
          </p>
        </div>
        {waiting > 0 && (
          <span
            className="inline-flex items-center gap-2 whitespace-nowrap rounded-pill px-4 py-[9px] text-sm font-extrabold"
            style={{ background: 'var(--tmint)', color: 'var(--tink)' }}
          >
            <BellRinging size={17} weight="fill" aria-hidden="true" />
            {waiting} waiting on you
          </span>
        )}
      </div>

      {transactions.length === 0 ? (
        <div className="flex flex-col items-center px-6 py-14 text-center">
          <span aria-hidden="true" className="empty-badge text-brand-dark">
            <Handshake className="h-8 w-8" weight="bold" aria-hidden="true" />
          </span>
          <p className="mt-[18px] text-[17px] font-extrabold text-ink">
            No donation or exchange requests yet.
          </p>
          <p className="mt-1.5 max-w-[36ch] text-sm leading-relaxed text-muted">
            Ask for a toy from the library, list one of yours, or claim a build on Makers wanted —
            the conversation starts here.
          </p>
          <BoundaryLink href="/toy-library" className="btn btn-coral mt-6">
            Browse the toy library
          </BoundaryLink>
        </div>
      ) : (
        <>
          {active.length > 0 && (
            <section>
              <h2 className="mb-3.5 mt-[30px] font-display text-xl font-extrabold text-ink">Active</h2>
              <ul className="flex flex-col gap-3.5">
                {active.map((tx) => (
                  <TransactionRow key={tx.id} tx={tx} viewerId={viewerId} ledOrgIds={ledOrgIds} />
                ))}
              </ul>
            </section>
          )}

          {history.length > 0 && (
            <section>
              <h2 className="mb-3.5 mt-9 font-display text-xl font-extrabold text-ink">History</h2>
              <ul className="flex flex-col gap-3">
                {history.map((tx) => (
                  <TransactionRow key={tx.id} tx={tx} viewerId={viewerId} ledOrgIds={ledOrgIds} />
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  )
}

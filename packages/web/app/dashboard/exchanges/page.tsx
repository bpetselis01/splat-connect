import Link from 'next/link'
import type { Route } from 'next'
import { ChatCircle, Gift, ArrowsLeftRight, Hammer as HammerIcon } from '@phosphor-icons/react/dist/ssr'
import { requireCapabilities } from '@/lib/require-capabilities'
import { apiClient } from '@/lib/api-client'
import { Badge } from '@/components/badge'
import { Handshake } from '@/components/icons'
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
   * The meta line is "kind · counterparty · when", in that order, and one line
   * only. A leader's personal handoffs and their organisation's arrive in one
   * list and nothing else tells them apart — which of the two they are
   * answering as changes who the toy belongs to — so the organisation goes here
   * rather than on a second line the artboard does not draw.
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
    tx.acting_for_org_name ? `for ${tx.acting_for_org_name}` : null,
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
        pill={<Badge status={tx.status} />}
        // Derived from this row's own status and confirmations. A build has a
        // vocabulary of its own — five steps, one of them the working shot —
        // so it gets its own derivation rather than exchange words over build
        // data. See lib/build-stages.ts and lib/exchange-stages.ts.
        stages={isBuild ? buildStages(tx) : exchangeStages(tx)}
        note={
          tx.blocked_by_rival_accept
            ? 'Locked — another request accepted'
            : tx.last_message
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
            <ChatCircle size={18} weight="fill" aria-hidden="true" />
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
          needsAction(tx, viewerId, ledOrgIds) ? (
            <Link href={href} className="btn btn-quiet no-underline">
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

  return (
    <div>
      <MarkNotificationsRead bucket="exchanges" />

      <div className="mb-6">
        <h1 className="title-hub">My exchanges</h1>
        <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted">
          Toys and builds you have asked for, and the ones people have asked you for.
        </p>
      </div>

      {transactions.length === 0 ? (
        <div className="flex flex-col items-center px-6 py-12 text-center">
          <span aria-hidden="true" className="empty-badge text-brand-dark">
            <Handshake className="h-8 w-8" />
          </span>
          <p className="mt-4 font-bold text-ink">Nothing has been asked for yet.</p>
          <p className="mt-1 max-w-xs text-sm leading-relaxed text-muted">
            Ask for a toy from the library, ask a maker for a build, or list one of your own — the
            conversation starts here.
          </p>
          <BoundaryLink href="/toy-library" className="btn btn-primary mt-6">
            Browse the toy library
          </BoundaryLink>
        </div>
      ) : (
        <>
          {active.length > 0 && (
            <section>
              <h2 className="title-section mb-3">Active</h2>
              <ul className="flex flex-col gap-3">
                {active.map((tx) => (
                  <TransactionRow key={tx.id} tx={tx} viewerId={viewerId} ledOrgIds={ledOrgIds} />
                ))}
              </ul>
            </section>
          )}

          {history.length > 0 && (
            <section className={active.length > 0 ? 'mt-10' : undefined}>
              <h2 className="title-section mb-3">History</h2>
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

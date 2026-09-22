/**
 * A build, on the canonical detail layout.
 *
 * Same shape as `/dashboard/exchanges/[id]` — header, cost panel, joined rail
 * and facts, thread with a sticky sidebar — because a build IS a toy
 * transaction (057). What differs is the vocabulary (`lib/build-stages.ts`),
 * the extra stage in the sidebar (`components/build-next-step.tsx`) and the
 * collapsed Build details disclosure the brief names.
 *
 * It is a separate route rather than a branch inside the exchange page because
 * the artboard gives it its own URL and because every panel below asks a
 * different question of the row; a page that answered both would be a ternary
 * per line.
 *
 * Related files:
 * - app/dashboard/exchanges/[id]/page.tsx: the exchange this mirrors
 * - lib/build-stages.ts: the rail and the facts under it
 * - supabase/migrations/057_build_requests.sql: the columns all of it reads
 */
import { notFound, redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import Link from 'next/link'
import { BookOpen, Hammer, Info } from '@phosphor-icons/react/dist/ssr'
import { requireCapabilities } from '@/lib/require-capabilities'
import { apiClient } from '@/lib/api-client'
import { isOwnerSide } from '@splat-connect/types'
import type { PickupAddress, Profile, ToyTransactionDetail } from '@splat-connect/types'
import { Badge } from '@/components/badge'
import { Disclosure } from '@/components/disclosure'
import { CostPanel, type CostLine, type Settlement } from '@/components/cost-panel'
import { StageRailCard } from '@/components/stage-rail-card'
import { BuildNextStep } from '@/components/build-next-step'
import { LiveTransaction } from '@/components/live-transaction'
import { ToyTransactionThread } from '@/components/toy-transaction-thread'
import { ChatHead } from '@/components/exchange-chat'
import { buildStages, buildStageFacts } from '@/lib/build-stages'

function defaultAddress(profile: Profile): PickupAddress | null {
  const { pickup_line1, pickup_suburb, pickup_state, pickup_postcode } = profile
  if (!pickup_line1 || !pickup_suburb || !pickup_state || !pickup_postcode) return null
  return { pickup_line1, pickup_suburb, pickup_state, pickup_postcode }
}

export default async function BuildDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const caps = await requireCapabilities()

  let tx: ToyTransactionDetail
  try {
    tx = await apiClient.get<ToyTransactionDetail>(`/api/toy-transactions/${id}`)
  } catch (err) {
    if (err instanceof Error && /status 404/.test(err.message)) notFound()
    throw err
  }

  // A donation or an exchange opened at this URL belongs on the other page, and
  // sending it there is better than rendering build vocabulary over a toy.
  if (tx.type !== 'build') redirect(`/dashboard/exchanges/${id}`)

  async function sendMessage(body: string) {
    'use server'
    await apiClient.post(`/api/toy-transactions/${id}/messages`, { body })
    revalidatePath(`/dashboard/exchanges/build/${id}`)
  }
  async function accept(address: PickupAddress | null) {
    'use server'
    await apiClient.post(`/api/toy-transactions/${id}/accept`, address ?? {})
    revalidatePath(`/dashboard/exchanges/build/${id}`)
  }
  async function reject() {
    'use server'
    await apiClient.post(`/api/toy-transactions/${id}/reject`, {})
    revalidatePath(`/dashboard/exchanges/build/${id}`)
  }
  async function withdraw() {
    'use server'
    await apiClient.post(`/api/toy-transactions/${id}/withdraw`, {})
    revalidatePath(`/dashboard/exchanges/build/${id}`)
  }
  async function confirm(code: string) {
    'use server'
    await apiClient.post(`/api/toy-transactions/${id}/confirm`, { code })
    revalidatePath(`/dashboard/exchanges/build/${id}`)
  }

  const ledOrgIds = caps.ledOrgs.map((org) => org.id)
  // On a build the giving side is the maker: they hand over the thing they made.
  const viewerIsMaker = isOwnerSide(tx, caps.profile.id, ledOrgIds)
  const otherPartyName = viewerIsMaker ? tx.requester_name : tx.owner_name

  let costs: { lines: CostLine[]; settlement: Settlement | null } | null = null
  try {
    costs = await apiClient.get(`/api/exchange-costs/${id}`)
  } catch {
    costs = null
  }

  // Withheld where the write would not land: a cost line names two profiles and
  // an organisation-held build has none on the giving side (SUPABASE.md, F8).
  const canEditCosts =
    tx.owner_id !== null &&
    (tx.owner_id === caps.profile.id || tx.requester_id === caps.profile.id) &&
    tx.status !== 'rejected' &&
    tx.status !== 'withdrawn'

  // Computed after the row is loaded and after the viewer's side is known.
  const stages = buildStages(tx)
  const facts = buildStageFacts(tx, viewerIsMaker)
  const address = [tx.pickup_line1, tx.pickup_suburb, tx.pickup_state, tx.pickup_postcode]
    .filter(Boolean)
    .join(', ')

  return (
    <div className="max-w-[1180px]">
      <LiveTransaction transactionId={id} />

      <div className="flex flex-wrap items-start justify-between gap-5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge status={tx.status} />
            <Badge status="assistive_tech" label="Build" />
            <span className="text-[13px] font-bold text-muted">
              Asked{' '}
              {new Date(tx.created_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'long' })}
            </span>
          </div>
          <h1 className="mt-2 font-display text-[clamp(28px,3.2vw,40px)] font-extrabold leading-[1.08] tracking-[-0.02em] text-ink">
            {tx.tutorial_title ?? 'A build'}
          </h1>
          <p className="mt-1.5 text-[15px] font-semibold text-muted">
            {/* Tense follows the record. "Tom is building this for you" over a
                closed build reads as work still going on. */}
            {tx.status === 'completed'
              ? viewerIsMaker
                ? `You built this for ${otherPartyName}`
                : `${otherPartyName} built this for you`
              : tx.status === 'rejected' || tx.status === 'withdrawn'
                ? 'Nothing was built'
                : tx.status === 'requested'
                  ? viewerIsMaker
                    ? `${otherPartyName} is asking you to build this`
                    : otherPartyName
                      ? `Waiting for ${otherPartyName} to answer`
                      : 'Waiting for a maker to claim it'
                  : viewerIsMaker
                    ? `You are building this for ${otherPartyName}`
                    : `${otherPartyName} is building this for you`}
          </p>
        </div>
        {tx.tutorial_id && (
          <Link href={`/tutorials/${tx.tutorial_id}`} className="btn btn-quiet no-underline">
            <BookOpen size={18} weight="bold" aria-hidden="true" />
            Open the guide
          </Link>
        )}
      </div>

      <div className="my-[22px]">
        <StageRailCard stages={stages} facts={facts} />
      </div>

      <ToyTransactionThread
        transaction={tx}
        viewerId={caps.profile.id}
        ledOrgIds={ledOrgIds}
        viewerDefaultAddress={defaultAddress(caps.profile)}
        onSendMessage={sendMessage}
        onAccept={accept}
        onReject={reject}
        onWithdraw={withdraw}
        onConfirm={confirm}
        variant="board"
        // An open request nobody has claimed has nobody to name yet.
        chatHead={
          otherPartyName && <ChatHead
            name={otherPartyName}
            sub={viewerIsMaker ? 'Family' : 'Maker'}
            badge={
              viewerIsMaker ? undefined : (
                <span className="stage-pill uppercase tracking-[0.04em]" style={{ background: 'var(--tamber)', color: 'var(--tink)' }}>
                  <Hammer weight="fill" aria-hidden="true" />
                  Maker
                </span>
              )
            }
          />
        }
        asideTop={
          <>
            <BuildNextStep tx={tx} viewerIsMaker={viewerIsMaker} />

            {/* The board keeps a build's costs in the aside, under the next
                step: parts are bought as the build goes, so the number sits
                beside the conversation about them. */}
            {costs && (
              <CostPanel
                lines={costs.lines}
                settlement={costs.settlement}
                noteByName={otherPartyName}
                viewerName={caps.profile.name}
                // The family pays for parts, so they are the ones who owe.
                viewerOwes={!viewerIsMaker}
                transactionId={id}
                viewerId={caps.profile.id}
                canEdit={canEditCosts}
                heading="What this build costs you"
                intro={`${otherPartyName} gives the time and the tools free — these are the parts they bought.`}
              />
            )}

            {/* The working shot itself, where it can be looked at rather than
                described. Served through /files because 057's bucket is
                private and signs per click. */}
            {tx.working_photo_url && (
              <a
                href={`/files/build-shots/${tx.working_photo_url}`}
                className="card flex items-center gap-3 p-4 no-underline"
              >
                <span aria-hidden="true" className="empty-badge text-brand-deep">
                  <Hammer size={22} weight="duotone" />
                </span>
                <span className="min-w-0">
                  <span className="block font-bold text-ink">The working shot</span>
                  <span className="block text-sm text-muted">
                    {tx.work_approved_at ? 'Approved by the family' : 'Open the photo'}
                  </span>
                </span>
              </a>
            )}

            {/* The guide, and the brief behind a caret: keep the decision
                visible and hide the evidence once it has been read. */}
            <div className="xthread-card overflow-hidden">
              <div className="flex items-center gap-3.5 px-5 py-[18px]">
                <span
                  aria-hidden="true"
                  className="grid h-16 w-16 flex-none place-items-center rounded-[var(--radius-inset)]"
                  style={{ background: 'var(--b100)', color: 'var(--tink)' }}
                >
                  <BookOpen size={32} weight="duotone" opacity={0.75} />
                </span>
                <span className="min-w-0 font-display text-[17px] font-extrabold text-ink">
                  {tx.tutorial_title ?? 'A build'}
                </span>
              </div>
              <div className="border-t border-line">
                <Disclosure summary="Build details">
                  <dl className="grid grid-cols-[auto_1fr] items-baseline gap-x-3.5 gap-y-2.5 text-sm">
                    <dt className="font-bold text-muted">Maker</dt>
                    <dd className="font-extrabold text-ink">{viewerIsMaker ? 'You' : tx.owner_name}</dd>
                    <dt className="font-bold text-muted">Parts</dt>
                    <dd className="font-extrabold text-ink">The family covers them</dd>
                    {tx.travel_km !== null && (
                      <>
                        <dt className="font-bold text-muted">Travel</dt>
                        <dd className="font-extrabold text-ink">
                          Up to {tx.travel_km} km
                          {tx.requester_suburb ? ` from ${tx.requester_suburb}` : ''}
                        </dd>
                      </>
                    )}
                    <dt className="font-bold text-muted">Pickup</dt>
                    <dd className="font-extrabold text-ink">
                      {address || 'Agreed after the working shot'}
                    </dd>
                  </dl>
                  {tx.build_brief && (
                    <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-ink">
                      {tx.build_brief}
                    </p>
                  )}
                  <p className="mt-3 flex gap-1.5 text-[13px] leading-normal text-muted">
                    <Info size={16} weight="fill" aria-hidden="true" className="mt-0.5 flex-none text-brand-dark" />
                    Meet somewhere public. Bring the child&apos;s switch so the fit is checked first.
                  </p>
                </Disclosure>
              </div>
            </div>
          </>
        }
      />
    </div>
  )
}

'use client'

/**
 * A print request waiting on one of the viewer's machines, answerable from the
 * list: the board puts Accept and Decline on the card itself, beside the note
 * the family wrote, so the common case is one tap rather than a page visit.
 *
 * The decision still reads the same endpoints the print job page does, and
 * "Open the request" is there for anything a chip cannot say — the job page
 * takes a free-text decline reason.
 *
 * A request can go to up to three printers (074), so the card says how many
 * others were asked, and a race lost to one of them reads as the API's own
 * sentence rather than "check your connection". An organisation with more than
 * one machine picks the bench on accept, fit-checked against the guide's parts
 * and preselected to the best one — the board's "Accept on <printer>".
 */
import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowsOut,
  ChatCircleDots,
  ChatCircleText,
  Check,
  Clock,
  Cube,
  HourglassHigh,
  HourglassMedium,
  Lightning,
  MoonStars,
  Palette,
  Printer as PrinterIcon,
  Scales,
} from '@phosphor-icons/react/dist/ssr'
import type { PickupAddress, PrinterWithOwner, ToyTransactionSummary } from '@splat-connect/types'
import { browserApiClient } from '@/lib/browser-api-client'
import { apiErrorDetail, isApiError } from '@/lib/api-core'
import { othersAskedLabel, rankMachines } from '@/lib/print-groups'
import { AcceptPickupDialog } from '@/components/accept-pickup-dialog'
import { filamentLabel, printFilesLine, printTimeLabel } from '@/lib/print-settings'

const REASONS = [
  { label: 'No PETG on hand', Icon: Cube },
  { label: 'Too big for my bed', Icon: ArrowsOut },
  { label: 'Away for a while', Icon: MoonStars },
  { label: 'Too many jobs already', Icon: HourglassHigh },
]

function askedAgo(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  if (days <= 0) return 'Asked today'
  if (days === 1) return 'Asked yesterday'
  return `Asked ${days} days ago`
}

export function IncomingPrintCard({
  tx,
  defaultAddress,
  machines = [],
}: {
  /** `print_group_size` when the page looked it up: how many printers were asked. */
  tx: ToyTransactionSummary & { print_group_size?: number | null }
  /** The viewer's saved pickup address, seeded into the accept dialog. */
  defaultAddress: PickupAddress | null
  /** An organisation's machines. With more than one, accept asks which. */
  machines?: PrinterWithOwner[]
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [acceptOpen, setAcceptOpen] = useState(false)
  const [declineOpen, setDeclineOpen] = useState(false)
  const files = tx.print_files ?? []
  const ranked = tx.owner_org_id && machines.length > 1 ? rankMachines(machines, files) : []
  const [benchId, setBenchId] = useState(ranked[0]?.printer.id ?? null)
  const bench = ranked.find((m) => m.printer.id === benchId) ?? null
  const others = othersAskedLabel(tx.print_group_size)

  function run(path: string, body: object) {
    setError(null)
    startTransition(async () => {
      try {
        await browserApiClient.post(`/api/toy-transactions/${tx.id}/${path}`, body)
        router.refresh()
      } catch (err) {
        // A 409 is a sentence meant for the person: another printer took it,
        // or the chosen machine filled up. Anything else is the connection.
        setError(
          (isApiError(err) && err.status === 409 && apiErrorDetail(err)) ||
            'That did not go through. Check your connection and try again.'
        )
      }
    })
  }

  // An organisation's machine accepts outright: its pickup address is fixed,
  // and the server reads it from the org record.
  const accept = () =>
    tx.owner_org_id
      ? run('accept', bench ? { printer_id: bench.printer.id } : {})
      : setAcceptOpen(true)

  return (
    <li className="flex flex-col gap-4 rounded-[24px] border border-line bg-surface p-[22px] shadow-[var(--shadow-e2),var(--shadow-hi)]">
      <div className="flex items-start gap-4">
        <span
          aria-hidden="true"
          className="grid h-16 w-16 shrink-0 place-items-center rounded-[18px] bg-[var(--tviolet)] text-[var(--tink)]"
        >
          <Cube size={34} weight="duotone" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-[var(--tamber)] px-3 py-1 text-[13px] font-extrabold text-[var(--tink)]">
              <HourglassMedium size={14} weight="fill" aria-hidden="true" />
              {askedAgo(tx.created_at)}
            </span>
            {tx.print_colour && (
              <span className="inline-flex items-center gap-1 rounded-full bg-[var(--surface2)] px-3 py-1 text-[13px] font-extrabold text-ink">
                <Palette size={14} weight="bold" aria-hidden="true" />
                {tx.print_colour}
              </span>
            )}
            {tx.print_delivery === 'post' && (
              <span className="rounded-full bg-[var(--surface2)] px-3 py-1 text-[13px] font-extrabold text-ink">
                Posted
              </span>
            )}
            {tx.part_sets ? (
              <span className="rounded-full bg-[var(--surface2)] px-3 py-1 text-[13px] font-extrabold text-ink">
                {tx.part_sets} set{tx.part_sets === 1 ? '' : 's'}
              </span>
            ) : null}
          </div>
          <h2 className="font-display text-2xl font-extrabold text-ink">
            {tx.tutorial_title ?? 'A print job'}
          </h2>
          {files.length > 0 && (
            <p className="mt-1 font-mono text-[13px] font-semibold text-muted [overflow-wrap:anywhere]">
              {printFilesLine(files)}
            </p>
          )}
        </div>
      </div>

      {/* What the parts add up to, from the guide's own settings (068). */}
      {files.length > 0 && (
        <p className="flex flex-wrap gap-2 text-[13px] font-bold text-muted">
          {[
            [Clock, printTimeLabel(files)],
            [Scales, filamentLabel(files)],
          ].map(([Icon, label]) => (
            <span
              key={label as string}
              className="inline-flex items-center gap-1.5 rounded-full bg-[var(--surface2)] px-[11px] py-1"
            >
              <Icon size={14} weight="bold" aria-hidden="true" className="text-brand-dark" />
              {label as string}
            </span>
          ))}
        </p>
      )}

      {(tx.print_note || tx.requester_suburb) && (
        <div className="flex items-start gap-3.5 rounded-[18px] bg-[var(--b100)] px-4 py-3.5 text-[var(--tink)]">
          <ChatCircleText
            size={26}
            weight="duotone"
            aria-hidden="true"
            className="shrink-0 text-brand-dark"
          />
          <div>
            {/* Suburb only: it is the whole of what a printer is told about the
                family (058). */}
            <p className="text-sm font-extrabold">
              {tx.requester_suburb ? `A family in ${tx.requester_suburb}` : 'A family'}
            </p>
            {tx.print_note && (
              <p className="mt-1 text-sm leading-normal">&ldquo;{tx.print_note}&rdquo;</p>
            )}
          </div>
        </div>
      )}

      {others && (
        <p className="flex items-center gap-2 text-sm font-bold text-muted">
          <Lightning size={18} weight="fill" aria-hidden="true" className="flex-none text-honey" />
          {others}
        </p>
      )}

      {ranked.length > 0 && (
        <div className="flex flex-col gap-2.5">
          <p className="text-xs font-extrabold uppercase tracking-[0.1em] text-muted">Print on</p>
          <div
            role="radiogroup"
            aria-label="Which printer takes this job"
            className="grid gap-2.5 sm:grid-cols-2"
          >
            {ranked.map(({ printer, ok, why }) => {
              const on = printer.id === benchId
              return (
                <button
                  key={printer.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setBenchId(printer.id)}
                  className={`flex items-start gap-3 rounded-[18px] border-2 p-3.5 text-left ${
                    on ? 'border-brand bg-[var(--b100)]' : 'border-line bg-surface'
                  }`}
                >
                  <PrinterIcon size={24} weight="duotone" aria-hidden="true" className="flex-none text-brand-dark" />
                  <span className="flex min-w-0 flex-col gap-1">
                    <span className="text-[15px] font-extrabold text-ink">{printer.name}</span>
                    <span className="text-[13px] text-muted">
                      {printer.materials.join(' · ')} · {printer.open_jobs} of {printer.capacity}{' '}
                      used
                    </span>
                    <span
                      className="self-start rounded-full px-[9px] py-[3px] text-xs font-extrabold text-[var(--tink)]"
                      style={{ background: ok ? 'var(--tok)' : 'var(--tamber)' }}
                    >
                      {ok ? 'Fits' : `Needs a change · ${why.join(' · ')}`}
                    </span>
                  </span>
                </button>
              )
            })}
          </div>
          <p className="text-[13px] text-muted">
            {bench?.ok
              ? 'Job lands in this machine’s queue. Other leaders see which bench it is on.'
              : 'This machine is missing something the guide asks for — swap filament or wait for the slot before starting.'}
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2.5">
        <button
          type="button"
          className="btn btn-primary px-6"
          disabled={pending || tx.blocked_by_rival_accept}
          onClick={accept}
        >
          <Check size={18} weight="bold" aria-hidden="true" />
          {bench ? `${bench.ok ? 'Accept' : 'Accept anyway'} on ${bench.printer.name}` : 'Accept'}
        </button>
        <button
          type="button"
          className="btn btn-quiet btn-lg shadow-none"
          aria-expanded={declineOpen}
          disabled={pending}
          onClick={() => setDeclineOpen((open) => !open)}
        >
          Decline…
        </button>
        <Link
          href={`/dashboard/print-requests/${tx.id}`}
          className="btn btn-quiet btn-lg shadow-none no-underline"
        >
          <ChatCircleDots size={18} weight="bold" aria-hidden="true" />
          Open the request
        </Link>
      </div>

      {declineOpen && (
        <div className="flex flex-col gap-2.5 rounded-[18px] bg-[var(--surface2)] p-4">
          <p className="text-sm font-extrabold text-ink">Why? The requester sees the reason.</p>
          <div className="flex flex-wrap gap-2">
            {REASONS.map(({ label, Icon }) => (
              <button
                key={label}
                type="button"
                className="btn btn-quiet shadow-none"
                disabled={pending}
                onClick={() => run('reject', { reason: label })}
              >
                <Icon size={16} weight="bold" aria-hidden="true" className="text-brand-dark" />
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}

      {acceptOpen && (
        <AcceptPickupDialog
          defaultAddress={defaultAddress}
          busy={pending}
          onCancel={() => setAcceptOpen(false)}
          onSubmit={(address) => {
            setAcceptOpen(false)
            run('accept', address)
          }}
        />
      )}
    </li>
  )
}

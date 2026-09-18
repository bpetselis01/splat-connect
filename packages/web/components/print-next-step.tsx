'use client'

/**
 * The tinted next-step card on a print job, and the two controls that move it
 * through the middle an exchange does not have.
 *
 * Both halves of that middle are the printer's: start it, then say it is ready
 * with a photo. The requester's only move is to collect, and that is the
 * handover card the thread already owns — so this component renders a card for
 * them and no button, which is the honest shape rather than a disabled one.
 *
 * Sibling of `build-next-step.tsx`; the two are deliberately not one generic
 * component parameterised by vocabulary, because every branch in them is
 * different copy and the shared part is a `<div>` with a tint.
 */
import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Camera, CheckCircle, Cube, HourglassMedium, Printer as PrinterIcon } from '@phosphor-icons/react/dist/ssr'
import type { ToyTransactionDetail } from '@splat-connect/types'
import { browserApiClient } from '@/lib/browser-api-client'

export function PrintNextStep({
  tx,
  viewerIsPrinter,
}: {
  tx: ToyTransactionDetail
  viewerIsPrinter: boolean
}) {
  const router = useRouter()
  const fileInput = useRef<HTMLInputElement>(null)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function run(work: () => Promise<void>, failure: string) {
    setError(null)
    startTransition(async () => {
      try {
        await work()
        router.refresh()
      } catch {
        setError(failure)
      }
    })
  }

  function start() {
    run(
      () => browserApiClient.post(`/api/toy-transactions/${tx.id}/print-started`, {}),
      'That did not save. Check your connection and try again.'
    )
  }

  function markReady(file: File) {
    const form = new FormData()
    form.append('file', file)
    run(
      () => browserApiClient.postFormData(`/api/toy-transactions/${tx.id}/print-ready`, form),
      'That photo did not upload. Check the file and try again.'
    )
  }

  const card = (() => {
    if (tx.status === 'requested') {
      return viewerIsPrinter
        ? {
            tone: 'bg-honey-soft',
            Icon: PrinterIcon,
            kicker: 'Needs you',
            title: 'Take the job, or decline',
            body: 'Check the parts fit the bed and the material is loaded. Declining needs a reason — the family sees it on their own screen.',
          }
        : {
            tone: 'bg-honey-soft',
            Icon: HourglassMedium,
            kicker: 'Waiting',
            title: 'Waiting on the printer',
            body: 'They will take it on or decline with a reason. Nothing to do yet.',
          }
    }

    if (tx.status === 'accepted' && !tx.printing_started_at) {
      return viewerIsPrinter
        ? {
            tone: 'bg-honey-soft',
            Icon: Cube,
            kicker: 'Your job',
            title: 'Start it when the bed is free',
            body: 'Marking it started tells the family it is under way. Record what the filament cost in the panel above.',
          }
        : {
            tone: 'bg-mint-soft',
            Icon: Cube,
            kicker: 'Accepted',
            title: 'They have taken it on',
            body: 'You will hear when it goes on the bed, and again with a photo when it comes off.',
          }
    }

    if (tx.status === 'accepted' && !tx.ready_at) {
      return viewerIsPrinter
        ? {
            tone: 'bg-honey-soft',
            Icon: Camera,
            kicker: 'On the bed',
            title: 'Post a photo when it comes off',
            body: 'The photo is what lets the family know there is something to collect before they travel for it.',
          }
        : {
            tone: 'bg-mint-soft',
            Icon: Cube,
            kicker: 'Printing',
            title: 'It is on the bed',
            body: 'You will get a photo when it comes off, and the pickup details with it.',
          }
    }

    if (tx.status === 'accepted') {
      return {
        tone: 'bg-honey-soft',
        Icon: CheckCircle,
        kicker: 'Ready',
        title: 'Arrange the pickup',
        body: 'Agree a time in the thread. Read your code out when the parts change hands — that is what closes the job.',
      }
    }

    if (tx.status === 'completed') {
      return {
        tone: 'bg-mint-soft',
        Icon: CheckCircle,
        kicker: 'Collected',
        title: 'Both of you confirmed',
        body: 'Closed and kept as a record.',
      }
    }

    return {
      tone: 'bg-sunken',
      Icon: HourglassMedium,
      kicker: tx.status === 'rejected' ? 'Declined' : 'Withdrawn',
      title: tx.status === 'rejected' ? 'This printer could not take it' : 'This job was withdrawn',
      // The reason, where there is one. It is the whole point of storing it.
      body:
        tx.status === 'rejected' && tx.decline_reason
          ? `${tx.decline_reason} — another printer may be able to.`
          : 'Nothing was printed. Another printer may be able to take it.',
    }
  })()

  const showStart = viewerIsPrinter && tx.status === 'accepted' && !tx.printing_started_at
  const showReady =
    viewerIsPrinter && tx.status === 'accepted' && Boolean(tx.printing_started_at) && !tx.ready_at

  return (
    <div className={`card flex flex-col gap-2 p-5 ${card.tone}`}>
      <p className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-widest text-muted">
        <card.Icon size={15} weight="fill" aria-hidden="true" />
        {card.kicker}
      </p>
      <p className="text-lg font-extrabold text-ink">{card.title}</p>
      <p className="text-sm leading-relaxed text-ink">{card.body}</p>

      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}

      {showStart && (
        <button type="button" className="btn btn-primary mt-2" disabled={pending} onClick={start}>
          <Cube size={18} weight="bold" aria-hidden="true" />
          It is on the bed
        </button>
      )}

      {showReady && (
        <>
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            className="sr-only"
            aria-label="Photo of the finished parts"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) markReady(file)
            }}
          />
          <button
            type="button"
            className="btn btn-primary mt-2"
            disabled={pending}
            onClick={() => fileInput.current?.click()}
          >
            <Camera size={18} weight="bold" aria-hidden="true" />
            Mark it ready with a photo
          </button>
        </>
      )}
    </div>
  )
}

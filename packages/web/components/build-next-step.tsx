'use client'

/**
 * The tinted next-step card, and the two controls that move a build through the
 * stage an exchange does not have.
 *
 * It is one component rather than a card and two buttons scattered down the
 * sidebar because the card's wording and the control under it are the same
 * decision: what this build is waiting for, and which of the two people it is
 * waiting on. Splitting them is how they drift out of agreement.
 *
 * Every state renders something. A build waiting on the other party has no
 * button, and says so — the brief's "no dead controls" rule read the other way:
 * a card with nothing to do is honest, a disabled button is not.
 */
import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Camera, CheckCircle, Hammer, HourglassMedium, SealCheck } from '@phosphor-icons/react/dist/ssr'
import type { ToyTransactionDetail } from '@splat-connect/types'
import { browserApiClient } from '@/lib/browser-api-client'

export function BuildNextStep({
  tx,
  viewerIsMaker,
}: {
  tx: ToyTransactionDetail
  viewerIsMaker: boolean
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

  function postShot(file: File) {
    const form = new FormData()
    form.append('file', file)
    run(
      () => browserApiClient.postFormData(`/api/toy-transactions/${tx.id}/working-shot`, form),
      'That photo did not upload. Check the file and try again.'
    )
  }

  function approve() {
    run(
      () => browserApiClient.post(`/api/toy-transactions/${tx.id}/approve-work`, {}),
      'That did not save. Check your connection and try again.'
    )
  }

  const card = (() => {
    if (tx.status === 'requested') {
      return viewerIsMaker
        ? {
            tone: 'var(--tamber)',
            Icon: Hammer,
            kicker: 'Needs you',
            title: 'Take it on, or decline',
            body: 'Read the brief below. Taking it on shares your pickup address and gives you both a handover code.',
          }
        : {
            tone: 'var(--tcoral)',
            Icon: HourglassMedium,
            kicker: 'Waiting',
            title: 'Waiting for an answer',
            body: 'You will hear here the moment they answer. Nothing to do yet.',
          }
    }

    if (tx.status === 'accepted' && !tx.working_photo_url) {
      return viewerIsMaker
        ? {
            tone: 'var(--tamber)',
            Icon: Camera,
            kicker: 'Your build',
            title: 'Build it, then post a working shot',
            body: 'The family approves the photo before anyone travels. Record what the parts cost in the panel below as you buy them.',
          }
        : {
            tone: 'var(--tamber)',
            Icon: Hammer,
            kicker: 'Live',
            title: 'They are building it',
            body: 'You will get a photo of it working before you arrange to collect it. Nothing to do yet.',
          }
    }

    if (tx.status === 'accepted' && !tx.work_approved_at) {
      return viewerIsMaker
        ? {
            tone: 'var(--tamber)',
            Icon: HourglassMedium,
            kicker: 'Waiting',
            title: 'Waiting for them to approve',
            body: 'They check the photo against the guide. If something looks off they can ask for a change here.',
          }
        : {
            tone: 'var(--tcoral)',
            Icon: Camera,
            kicker: 'Needs you',
            title: 'Check the working shot',
            body: 'Does it match the guide, and does the switch look like the right size? Approve it and agree a place to meet.',
          }
    }

    if (tx.status === 'accepted') {
      return {
        tone: 'var(--tcoral)',
        Icon: SealCheck,
        kicker: 'Approved',
        title: 'Arrange the handover',
        body: 'Agree a time and a public place in the thread. Read your code out when it changes hands — that is what closes the build.',
      }
    }

    if (tx.status === 'completed') {
      return {
        tone: 'var(--tok)',
        Icon: CheckCircle,
        kicker: 'Handed over',
        title: 'Both of you confirmed',
        body: 'Closed and kept as a record. Say thanks in the thread if you like.',
      }
    }

    return {
      tone: 'var(--surface2)',
      Icon: HourglassMedium,
      kicker: tx.status === 'rejected' ? 'Not taken on' : 'Withdrawn',
      title: tx.status === 'rejected' ? 'This one did not go ahead' : 'This request was withdrawn',
      body: 'Nothing was built. You can ask another maker, or the same one again.',
    }
  })()

  const showPostShot =
    viewerIsMaker && tx.status === 'accepted' && tx.work_approved_at === null
  const showApprove =
    !viewerIsMaker && tx.status === 'accepted' && Boolean(tx.working_photo_url) && !tx.work_approved_at

  return (
    // The board's next-step card: its own tint per stage, --e3, 22px in.
    <div className="xthread-next flex flex-col" style={{ background: card.tone }}>
      <p className="xthread-eyebrow">
        <card.Icon size={15} weight="fill" aria-hidden="true" />
        {card.kicker}
      </p>
      <p className="mb-3 font-display text-[19px] font-extrabold leading-snug">{card.title}</p>
      <p className="text-sm leading-normal">{card.body}</p>

      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}

      {showPostShot && (
        <>
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            className="sr-only"
            aria-label="Working shot"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) postShot(file)
            }}
          />
          <button
            type="button"
            className="btn btn-primary mt-3.5 w-full"
            disabled={pending}
            onClick={() => fileInput.current?.click()}
          >
            <Camera size={18} weight="bold" aria-hidden="true" />
            {tx.working_photo_url ? 'Replace the working shot' : 'Post the working shot'}
          </button>
        </>
      )}

      {showApprove && (
        <button type="button" className="btn btn-primary mt-3.5 w-full" disabled={pending} onClick={approve}>
          <CheckCircle size={18} weight="bold" aria-hidden="true" />
          Looks right — arrange the handover
        </button>
      )}
    </div>
  )
}

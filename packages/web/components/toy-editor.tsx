'use client'
/**
 * The board's toy listing editor: a header with the listing's stage and its
 * one action, a rail of sections, and a Status section that says where the
 * listing is, how it is offered, what is left before it can be listed, and its
 * history.
 *
 * Publishing used to be a sticky bar under every step and the offer choice a
 * row of buttons on a Review step. Both live on Status now, as the board has
 * them; Review is gone because Status says the same thing.
 */
import { useState } from 'react'
import Link from 'next/link'
import type { Route } from 'next'
import {
  ArrowSquareOut,
  ArrowsLeftRight,
  FlagBanner,
  FloppyDisk,
  Gift,
  HandHeart,
  Images,
  Info,
  Plus,
  Storefront,
} from '@phosphor-icons/react/dist/ssr'
import type { Toy, OfferType } from '@splat-connect/types'
import { Stepper } from '@/components/stepper'
import { ToyDetailsForm } from '@/components/toy-details-form'
import { ToyPhotosSection } from '@/components/toy-photos-section'
import { DeleteEntityButton } from '@/components/delete-entity-button'
import { ToastProvider } from '@/components/toast'
import {
  EditorChecklist,
  EditorHeader,
  EditorHistory,
  StatusCard,
  SubmitButton,
} from '@/components/editor-status'
import { browserApiClient } from '@/lib/browser-api-client'
import { formatRelativeTime } from '@/lib/relative-time'
import { computeToyStepStatuses, getMissingToyFields } from '@/lib/toy-steps'

const OFFERS: { value: OfferType; label: string; sub: string; tint: string; Icon: typeof Gift }[] = [
  { value: 'donation', label: 'Donation', sub: 'They keep it for good', tint: 'var(--tmint)', Icon: Gift },
  { value: 'exchange', label: 'Swap', sub: 'You want a toy back', tint: 'var(--tviolet)', Icon: ArrowsLeftRight },
  { value: 'both', label: 'Either', sub: 'Let the family decide', tint: 'var(--tamber)', Icon: HandHeart },
]

const OFFER_NOTE: Record<OfferType, string> = {
  donation: 'The recipient keeps this toy for good — no return expected.',
  exchange: "You'll swap this toy for another one with the recipient.",
  both: "Open to either a donation or a swap — you'll agree with the recipient on which.",
}

const OFFER_PILL: Record<OfferType, string> = { donation: 'Gift', exchange: 'Swap', both: 'Swap or gift' }

const fullDay = (iso: string) =>
  new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })

export function ToyEditor({ toy: initialToy }: { toy: Toy }) {
  const [toy, setToy] = useState<Toy>(initialToy)

  async function saveDetails(form: { name: string; description: string | null; condition: number }) {
    const updated = await browserApiClient.patch<Toy>(`/api/toys/${toy.id}`, form)
    setToy(updated)
  }

  async function savePhotos(form: {
    photo_urls?: string[]
    switch_photo_url?: string | null
    switch_adapted?: boolean
  }) {
    const updated = await browserApiClient.patch<Toy>(`/api/toys/${toy.id}`, form)
    setToy(updated)
  }

  async function saveOfferType(offerType: OfferType) {
    const updated = await browserApiClient.patch<Toy>(`/api/toys/${toy.id}`, { offer_type: offerType })
    setToy(updated)
  }

  // Throws on failure: SubmitButton owns the error state and needs the rejection.
  async function publish() {
    setToy(await browserApiClient.patch<Toy>(`/api/toys/${toy.id}/publish`, {}))
  }

  const statuses = computeToyStepStatuses(toy)
  const missing = getMissingToyFields(toy)
  const live = toy.status === 'published'
  const stage = live ? 'live' : 'hidden'
  const offer = toy.offer_type ? OFFERS.find((o) => o.value === toy.offer_type)! : null
  const libraryHref = `/toy-library/${toy.id}` as Route

  const primary = live ? (
    <Link href={libraryHref} className="btn btn-primary">
      <ArrowSquareOut size={16} weight="bold" aria-hidden="true" />
      Open the listing
    </Link>
  ) : (
    <SubmitButton
      label="List it in the library"
      busyLabel="Listing…"
      errorMessage="Could not publish this toy. Please try again."
      onSubmit={publish}
      disabled={missing.length > 0}
      icon={<Storefront size={16} weight="bold" aria-hidden="true" />}
    />
  )

  const status = (
    <div className="flex flex-col gap-5">
      <StatusCard
        stage={stage}
        head={live ? 'Families can ask for this' : 'Only you can see this'}
        body={
          live
            ? 'It is in the toy library and in search. Edits show to families straight away.'
            : 'Nothing is public and nobody can ask for it. There is no review for toys — the moment you list it, it is in the library.'
        }
      />

      <div>
        <h3 className="editor-h3">How is it offered?</h3>
        <p className="mb-3 max-w-[62ch] text-sm leading-normal text-muted">
          This decides what a family can ask for, and who confirms the handover.
        </p>
        <div role="radiogroup" aria-label="Offer this toy for" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {OFFERS.map((o) => (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={toy.offer_type === o.value}
              onClick={() => saveOfferType(o.value)}
              className="kind-card flex-col gap-2 p-4"
            >
              <span
                aria-hidden="true"
                className="grid h-[42px] w-[42px] place-items-center rounded-[14px] text-ink"
                style={{ background: o.tint }}
              >
                <o.Icon size={23} weight="duotone" />
              </span>
              <span className="font-display text-base font-extrabold">{o.label}</span>
              <span className="text-[13px] leading-[1.45] text-muted">{o.sub}</span>
            </button>
          ))}
        </div>
        <p className="mt-2.5 text-[13px] leading-normal text-muted">
          {toy.offer_type
            ? OFFER_NOTE[toy.offer_type]
            : 'Choose how this toy is offered — you can change it later.'}
        </p>
      </div>

      {!live && (
        <EditorChecklist
          title="Before you list it"
          sub="A photo and how it is offered are the two a family cannot ask for it without."
          rows={[
            { step: 'details', label: 'Details', note: 'Name, notes and condition', done: true },
            {
              step: 'photos',
              label: 'Photos',
              note: missing.filter((m) => m.step === 'photos').map((m) => m.label).join(', ') || 'Done',
              done: statuses.photos === 'done',
            },
            {
              step: 'status',
              label: 'How it is offered',
              note: offer ? OFFER_NOTE[offer.value] : 'Pick one above',
              done: !!offer,
            },
          ]}
        />
      )}

      <EditorHistory
        rows={[
          { icon: <Plus weight="bold" />, t: 'Created', d: fullDay(toy.created_at) },
          {
            icon: live ? <Storefront weight="bold" /> : <FloppyDisk weight="bold" />,
            t: live ? 'In the library' : 'Last saved',
            d: live ? `Last edited ${formatRelativeTime(toy.updated_at)}` : formatRelativeTime(toy.updated_at),
            now: true,
          },
        ]}
      />

      <div className="flex flex-wrap gap-2.5 border-t border-line pt-[18px]">
        {primary}
        <DeleteEntityButton
          endpoint={`/api/toys/${toy.id}`}
          redirectTo={'/dashboard/toys' as Route<string>}
          label="toy"
          className="btn btn-danger min-h-[52px]"
        />
      </div>
      <p className="text-[13px] leading-normal text-muted">
        <strong className="text-ink">{live ? 'This one is public.' : 'Nothing here is public.'}</strong>{' '}
        {live
          ? 'Families see the photos, the condition and how it is offered.'
          : 'It only appears in the toy library once you list it.'}
      </p>
    </div>
  )

  return (
    <ToastProvider>
      <EditorHeader
        stage={stage}
        extraPill={
          offer && (
            <span className="editor-head__pill" style={{ background: offer.tint }}>
              <offer.Icon weight="fill" aria-hidden="true" />
              {OFFER_PILL[offer.value]}
            </span>
          )
        }
        meta={live ? `In the library · saved ${formatRelativeTime(toy.updated_at)}` : `Draft · saved ${formatRelativeTime(toy.updated_at)}`}
        title={toy.name}
        actions={
          live ? (
            <Link href={libraryHref} className="btn btn-quiet min-h-12">
              <ArrowSquareOut size={16} aria-hidden="true" />
              Preview
            </Link>
          ) : (
            <SubmitButton
              label="List it in the library"
              busyLabel="Listing…"
              errorMessage="Could not publish this toy. Please try again."
              onSubmit={publish}
              disabled={missing.length > 0}
              icon={<Storefront size={16} weight="bold" aria-hidden="true" />}
              size="md"
            />
          )
        }
      />
      <Stepper
        label="Listing sections"
        layout="rail"
        railFoot={
          live
            ? 'Live in the library. Edits show to families straight away — there is no review for toys.'
            : missing.length === 0
              ? 'Ready to list.'
              : `${missing.length} ${missing.length === 1 ? 'thing' : 'things'} before it can be listed: ${missing.map((m) => m.label.toLowerCase()).join(', ')}.`
        }
        steps={[
          {
            id: 'status',
            label: 'Status',
            status: 'neutral',
            icon: <FlagBanner size={19} weight="duotone" aria-hidden="true" />,
            hint: 'Where this listing is, and what you can do about it right now.',
            content: status,
          },
          {
            id: 'details',
            label: 'Details',
            status: statuses.details,
            icon: <Info size={19} weight="duotone" aria-hidden="true" />,
            hint: 'What it is and what a family needs to know before they ask for it.',
            content: (
              <div className="panel pt-5">
                <ToyDetailsForm toy={toy} onSave={saveDetails} />
              </div>
            ),
          },
          {
            id: 'photos',
            label: 'Photos',
            status: statuses.photos,
            icon: <Images size={19} weight="duotone" aria-hidden="true" />,
            hint: 'Up to five. These do more work than anything else on the listing.',
            content: (
              <div className="panel pt-5">
                <ToyPhotosSection
                  toyId={toy.id}
                  photoUrls={toy.photo_urls}
                  switchAdapted={toy.switch_adapted}
                  switchPhotoUrl={toy.switch_photo_url}
                  onSave={savePhotos}
                />
              </div>
            ),
          },
        ]}
      />
    </ToastProvider>
  )
}

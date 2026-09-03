'use client'
import { useState } from 'react'
import type { Route } from 'next'
import type { Toy, OfferType } from '@splat-connect/types'
import { Stepper } from '@/components/stepper'
import { ToyDetailsForm } from '@/components/toy-details-form'
import { ToyPhotosSection } from '@/components/toy-photos-section'
import { ToySummary } from '@/components/toy-summary'
import { ToyPhotoGrid } from '@/components/toy-photo-viewer'
import { DeleteEntityButton } from '@/components/delete-entity-button'
import { ToastProvider } from '@/components/toast'
import { PanelActions } from '@/components/panel-actions'
import { browserApiClient } from '@/lib/browser-api-client'
import { computeToyStepStatuses, getMissingToyFields } from '@/lib/toy-steps'

const OFFER_TYPE_COPY: Record<OfferType, string> = {
  donation: 'The recipient keeps this toy for good — no return expected.',
  exchange: "You'll swap this toy for another one with the recipient.",
  both: "Open to either a donation or a swap — you'll agree with the recipient on which.",
}

/**
 * The Review step: what is about to be published, and how it is offered.
 *
 * Publishing itself moved to the Stepper on 2026-08-29. The bar lived here,
 * which meant it only existed on this step — so Details and Photos never said
 * how far the toy was from being publishable. Same gap the tutorial editor
 * had, same fix.
 */
function ToyReviewPanel({ toy, onSaveOfferType }: { toy: Toy; onSaveOfferType: (offerType: OfferType) => Promise<void> }) {
  return (
    <>
      <div className="panel pt-5">
        <div className="flex flex-col gap-4 px-5 pb-5">
          <ToySummary
            toy={toy}
            photos={
              <ToyPhotoGrid
                urls={toy.photo_urls}
                switchUrl={toy.switch_adapted ? toy.switch_photo_url : null}
              />
            }
          />

          <div className="flex flex-col gap-2">
            <p className="field-label">Offer this toy for</p>
            <div className="flex gap-2">
              {(['donation', 'exchange', 'both'] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  aria-pressed={toy.offer_type === option}
                  onClick={() => onSaveOfferType(option)}
                  className={`btn ${toy.offer_type === option ? 'btn-accent' : 'btn-quiet'}`}
                >
                  {option === 'donation' ? 'Donation' : option === 'exchange' ? 'Exchange' : 'Both'}
                </button>
              ))}
            </div>
            <p className="text-xs leading-relaxed text-muted">
              {toy.offer_type
                ? OFFER_TYPE_COPY[toy.offer_type]
                : 'Choose how this toy is offered — you can change it later.'}
            </p>
          </div>

          {/* Empty here — Review is the last step. Present so the panel keeps
              the same shape as every other one. */}
          <PanelActions />

        </div>
      </div>
    </>
  )
}

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

  // Throws on failure rather than swallowing: FinishBar owns the error state
  // now, and it needs the rejection to show it.
  async function publish() {
    setToy(await browserApiClient.patch<Toy>(`/api/toys/${toy.id}/publish`, {}))
  }

  const statuses = computeToyStepStatuses(toy)

  return (
    <ToastProvider>
      <Stepper
        label="Toy sections"
        steps={[
          {
            id: 'details',
            label: 'Details',
            status: statuses.details,
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
          {
            id: 'review',
            label: 'Review',
            status: statuses.review,
            content: <ToyReviewPanel toy={toy} onSaveOfferType={saveOfferType} />,
          },
        ]}
        finish={{
          missing: getMissingToyFields(toy),
          submitLabel: 'Publish',
          busyLabel: 'Publishing…',
          errorMessage: 'Could not publish this toy. Please try again.',
          endLabel: 'Review and publish',
          onSubmit: publish,
          done:
            toy.status === 'published' ? (
              <span className="text-sm font-semibold text-mint-deep">Published</span>
            ) : undefined,
        }}
        trailing={
          <DeleteEntityButton
            endpoint={`/api/toys/${toy.id}`}
            redirectTo={'/dashboard/toys' as Route<string>}
            label="toy"
            className="step-pill step-pill-danger"
          />
        }
      />
    </ToastProvider>
  )
}

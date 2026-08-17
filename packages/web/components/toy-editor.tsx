'use client'
import { useState } from 'react'
import type { Route } from 'next'
import type { Toy, OfferType } from '@splat-connect/types'
import { ToyEditStepper } from '@/components/toy-edit-stepper'
import { ToyDetailsForm } from '@/components/toy-details-form'
import { ToyPhotosSection } from '@/components/toy-photos-section'
import { ToySummary } from '@/components/toy-summary'
import { DeleteEntityButton } from '@/components/delete-entity-button'
import { ToastProvider } from '@/components/toast'
import { browserApiClient } from '@/lib/browser-api-client'
import { computeToyStepStatuses, getMissingToyFields } from '@/lib/toy-steps'

const OFFER_TYPE_COPY: Record<OfferType, string> = {
  donation: 'The recipient keeps this toy for good — no return expected.',
  exchange: "You'll swap this toy for another one with the recipient.",
  both: "Open to either a donation or a swap — you'll agree with the recipient on which.",
}

function ToyReviewPanel({ toy, onPublished, onSaveOfferType }: { toy: Toy; onPublished: (t: Toy) => void; onSaveOfferType: (offerType: OfferType) => Promise<void> }) {
  const [publishing, setPublishing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const missingFields = getMissingToyFields(toy)

  async function publish() {
    setPublishing(true)
    setError(null)
    try {
      const updated = await browserApiClient.patch<Toy>(`/api/toys/${toy.id}/publish`, {})
      onPublished(updated)
    } catch {
      setError('Could not publish this toy. Please try again.')
    } finally {
      setPublishing(false)
    }
  }

  // The panel wraps only the summary: `.panel` sets overflow:hidden, which
  // would kill the sticky bar's positioning if it lived inside. Same layering
  // as the edit-tutorial page, where the submit bar is a sibling of the panel.
  return (
    <>
      <div className="panel pt-5">
        <div className="flex flex-col gap-4 px-5 pb-5">
          <ToySummary toy={toy} />

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

          {error && (
            <p role="alert" className="alert alert-danger">
              {error}
            </p>
          )}
        </div>
      </div>

      {toy.status === 'published' ? (
        <div className="sticky-submit-bar sticky-submit-bar-quiet">
          <span className="text-sm font-semibold text-mint-deep">Published</span>
        </div>
      ) : (
        <div className="sticky-submit-bar">
          <span className="sticky-submit-note">
            {missingFields.length > 0
              ? `Add ${missingFields.join(', ')} to publish`
              : 'Ready to publish'}
          </span>
          <button
            type="button"
            disabled={missingFields.length > 0 || publishing}
            onClick={publish}
            className="btn btn-accent"
          >
            {publishing ? 'Publishing…' : 'Publish'}
          </button>
        </div>
      )}
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
    cover_photo_url: string | null
    switch_adapted: boolean
    switch_photo_urls: string[]
  }) {
    const updated = await browserApiClient.patch<Toy>(`/api/toys/${toy.id}`, form)
    setToy(updated)
  }

  async function saveOfferType(offerType: OfferType) {
    const updated = await browserApiClient.patch<Toy>(`/api/toys/${toy.id}`, { offer_type: offerType })
    setToy(updated)
  }

  const statuses = computeToyStepStatuses(toy)

  return (
    <ToastProvider>
      <ToyEditStepper
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
                  coverPhotoUrl={toy.cover_photo_url}
                  switchAdapted={toy.switch_adapted}
                  switchPhotoUrls={toy.switch_photo_urls}
                  onSave={savePhotos}
                />
              </div>
            ),
          },
          {
            id: 'review',
            label: 'Review',
            status: statuses.review,
            content: <ToyReviewPanel toy={toy} onPublished={setToy} onSaveOfferType={saveOfferType} />,
          },
        ]}
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

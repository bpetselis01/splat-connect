'use client'
import { useState } from 'react'
import type { Route } from 'next'
import type { Toy } from '@splat-connect/types'
import { ToyEditStepper } from '@/components/toy-edit-stepper'
import { ToyDetailsForm } from '@/components/toy-details-form'
import { ToyPhotosSection } from '@/components/toy-photos-section'
import { DeleteEntityButton } from '@/components/delete-entity-button'
import { ToastProvider } from '@/components/toast'
import { browserApiClient } from '@/lib/browser-api-client'
import { computeToyStepStatuses, getMissingToyFields } from '@/lib/toy-steps'

function ToyReviewPanel({ toy, onPublished }: { toy: Toy; onPublished: (t: Toy) => void }) {
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

  return (
    <div className="flex flex-col gap-4 px-5 pb-5">
      <dl className="flex flex-col gap-2 text-sm">
        <div>
          <dt className="font-semibold text-ink">Name</dt>
          <dd>{toy.name}</dd>
        </div>
        <div>
          <dt className="font-semibold text-ink">Condition</dt>
          <dd>{toy.condition} / 10</dd>
        </div>
        <div>
          <dt className="font-semibold text-ink">Description</dt>
          <dd>{toy.description || '—'}</dd>
        </div>
        <div>
          <dt className="font-semibold text-ink">Switch-adapted</dt>
          <dd>{toy.switch_adapted ? 'Yes' : 'No'}</dd>
        </div>
      </dl>

      {error && (
        <p role="alert" className="alert alert-danger">
          {error}
        </p>
      )}

      {toy.status === 'published' ? (
        <p className="text-sm font-semibold text-mint-deep">Published</p>
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
    </div>
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

  async function removeSwitchPhoto(url: string) {
    const updated = await browserApiClient.patch<Toy>(`/api/toys/${toy.id}`, {
      switch_photo_urls: toy.switch_photo_urls.filter((u) => u !== url),
    })
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
            status: statuses.details.status,
            content: <ToyDetailsForm toy={toy} onSave={saveDetails} />,
          },
          {
            id: 'photos',
            label: 'Photos',
            status: statuses.photos.status,
            content: (
              <ToyPhotosSection
                toyId={toy.id}
                coverPhotoUrl={toy.cover_photo_url}
                switchAdapted={toy.switch_adapted}
                switchPhotoUrls={toy.switch_photo_urls}
                onSave={savePhotos}
                onRemoveSwitchPhoto={removeSwitchPhoto}
              />
            ),
          },
          {
            id: 'review',
            label: 'Review',
            status: statuses.review.status,
            content: <ToyReviewPanel toy={toy} onPublished={setToy} />,
          },
        ]}
      />
      <DeleteEntityButton
        endpoint={`/api/toys/${toy.id}`}
        redirectTo={'/dashboard/toys' as Route<string>}
        label="toy"
      />
    </ToastProvider>
  )
}

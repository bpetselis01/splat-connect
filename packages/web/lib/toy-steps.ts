import type { Toy, OfferType } from '@splat-connect/types'
import type { Gap, Step, StepStatus } from '@/lib/steps'

export type ToyStepId = 'details' | 'photos' | 'review'
export type ToyStep = Step<ToyStepId>

/**
 * Every gap still open, each paired with the step that closes it and the words
 * to show instead of the column name.
 *
 * Offer type belongs to Review rather than Photos: it is chosen in
 * ToyReviewPanel, which is the same reason computeToyStepStatuses below keeps
 * it out of the Photos dot.
 */
export function getMissingToyFields(toy: {
  cover_photo_url: string | null
  switch_adapted: boolean
  switch_photo_urls: string[]
  offer_type: OfferType | null
}): Gap<ToyStepId>[] {
  const missing: Gap<ToyStepId>[] = []
  if (!toy.cover_photo_url) missing.push({ step: 'photos', label: 'A cover photo' })
  if (toy.switch_adapted && toy.switch_photo_urls.length === 0)
    missing.push({ step: 'photos', label: 'A switch photo' })
  if (!toy.offer_type) missing.push({ step: 'review', label: 'How it is offered' })
  return missing
}

export function computeToyStepStatuses(toy: Toy): Record<ToyStepId, StepStatus> {
  // Photos status stays scoped to photo fields — offer_type belongs to the
  // Review step, so an unset offer_type shouldn't flag Photos for attention.
  const photosMissing =
    !toy.cover_photo_url || (toy.switch_adapted && toy.switch_photo_urls.length === 0)
  return {
    details: 'done',
    photos: photosMissing ? 'attention' : 'done',
    review: toy.status === 'published' ? 'done' : 'neutral',
  }
}

import type { ReactNode } from 'react'
import type { Toy, OfferType } from '@splat-connect/types'

export type ToyStepId = 'details' | 'photos' | 'review'
export type ToyStepStatus = 'done' | 'attention' | 'neutral'

export interface ToyStep {
  id: ToyStepId
  label: string
  status: ToyStepStatus
  content: ReactNode
  /** Shown in the pill row but not reachable — the Add-a-toy page uses this so
   *  the whole journey is visible before the toy exists to hang photos off. */
  disabled?: boolean
}

export function getMissingToyFields(toy: {
  cover_photo_url: string | null
  switch_adapted: boolean
  switch_photo_urls: string[]
  offer_type: OfferType | null
}): string[] {
  const missing: string[] = []
  if (!toy.cover_photo_url) missing.push('Cover photo')
  if (toy.switch_adapted && toy.switch_photo_urls.length === 0) missing.push('Switch photo')
  if (!toy.offer_type) missing.push('Offer type')
  return missing
}

export function computeToyStepStatuses(toy: Toy): Record<ToyStepId, ToyStepStatus> {
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

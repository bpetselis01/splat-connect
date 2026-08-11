import type { ReactNode } from 'react'
import type { Toy } from '@splat-connect/types'

export type ToyStepId = 'details' | 'photos' | 'review'
export type ToyStepStatus = 'done' | 'attention' | 'neutral'

export interface ToyStep {
  id: ToyStepId
  label: string
  status: ToyStepStatus
  content: ReactNode
}

export function getMissingToyFields(toy: {
  cover_photo_url: string | null
  switch_adapted: boolean
  switch_photo_urls: string[]
}): string[] {
  const missing: string[] = []
  if (!toy.cover_photo_url) missing.push('Cover photo')
  if (toy.switch_adapted && toy.switch_photo_urls.length === 0) missing.push('Switch photo')
  return missing
}

export function computeToyStepStatuses(toy: Toy): Record<ToyStepId, ToyStepStatus> {
  const missing = getMissingToyFields(toy)
  return {
    details: 'done',
    photos: missing.length > 0 ? 'attention' : 'done',
    review: toy.status === 'published' ? 'done' : 'neutral',
  }
}

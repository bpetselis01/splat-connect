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

export interface ToyStepStatusResult {
  status: ToyStepStatus
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

export function computeToyStepStatuses(toy: Toy): Record<ToyStepId, ToyStepStatusResult> {
  const missing = getMissingToyFields(toy)
  return {
    details: { status: 'done' },
    photos: missing.length > 0 ? { status: 'attention' } : { status: 'done' },
    review: toy.status === 'published' ? { status: 'done' } : { status: 'neutral' },
  }
}

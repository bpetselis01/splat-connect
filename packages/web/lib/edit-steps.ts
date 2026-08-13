/**
 * Step manifest and status rules for the edit-tutorial stepper. Status
 * mirrors getMissingFields() in lib/validation.ts exactly — that function
 * stays the single source of truth for what's required to submit; this
 * module only groups its output per step and adds the purely-optional
 * sections (STL, Backing, Collaborators) that getMissingFields() never
 * covers because they're not required.
 */
import type { ReactNode } from 'react'
import type { TutorialWithDetails, TutorialOrg } from '@splat-connect/types'
import { getMissingFields } from '@/lib/validation'

export type EditStepId =
  | 'details'
  | 'files'
  | 'parts'
  | 'tools'
  | 'stl'
  | 'backing'
  | 'collaborators'
  | 'review'
export type EditStepStatus = 'done' | 'attention' | 'neutral'

export interface EditStep {
  id: EditStepId
  label: string
  status: EditStepStatus
  content: ReactNode
}

const DETAILS_FIELDS = ['Title', 'Difficulty']
const FILES_FIELDS = ['Tutorial PDF', 'Toy photo']
const PARTS_FIELDS = ['At least one part']
const TOOLS_FIELDS = ['At least one tool']

function fieldStatus(missing: string[], fields: string[]): EditStepStatus {
  return missing.some((f) => fields.includes(f)) ? 'attention' : 'done'
}

export function computeStepStatuses(
  tutorial: TutorialWithDetails,
  backing: TutorialOrg[]
): Record<EditStepId, EditStepStatus> {
  const missing = getMissingFields(tutorial)
  return {
    details: fieldStatus(missing, DETAILS_FIELDS),
    files: fieldStatus(missing, FILES_FIELDS),
    parts: fieldStatus(missing, PARTS_FIELDS),
    tools: fieldStatus(missing, TOOLS_FIELDS),
    stl: tutorial.stl_files.length > 0 ? 'done' : 'neutral',
    backing: backing.length > 0 ? 'done' : 'neutral',
    collaborators: tutorial.tutorial_contributors.length > 1 ? 'done' : 'neutral',
    // Mirrors the toy Review pill: neutral while the tutorial is still the
    // contributor's to finish, done once it has been handed over for review.
    review: tutorial.status === 'draft' ? 'neutral' : 'done',
  }
}

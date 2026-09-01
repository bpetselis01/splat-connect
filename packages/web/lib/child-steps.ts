/**
 * Status rules for the child-profile editor stepper. Unlike lib/toy-steps.ts,
 * no step is ever locked — every child-profile field is a plain column with no
 * upload/id dependency, so any pill can be the one that creates the profile.
 *
 * No gaps either: a child profile is never submitted or published, so there is
 * nothing to gate and nothing to be missing.
 */
import type { ChildProfile } from '@splat-connect/types'
import type { Step, StepStatus } from '@/lib/steps'

export type ChildStepId = 'survey' | 'ability' | 'everyday-needs' | 'customization'
export type ChildStep = Step<ChildStepId>

function hasSurveyData(c: ChildProfile): boolean {
  // Specifically whether the survey produced the current values — a MACS/BFMF
  // set manually via the Ability pill doesn't count, so the hazard mark
  // correctly nudges "you haven't tried this" rather than lying that it's done.
  return c.macs_source === 'estimated' && c.bfmf_source === 'estimated'
}

function hasAbilityData(c: ChildProfile): boolean {
  return Boolean(
    c.name ||
      c.age != null ||
      c.macs_level ||
      c.bfmf_score ||
      c.hand_involvement ||
      c.assist_hand
  )
}

function hasEverydayNeedsData(c: ChildProfile): boolean {
  return Boolean(
    c.challenges.length > 0 || c.challenge_other || c.grip_type || c.env_context
  )
}

function hasCustomizationData(c: ChildProfile): boolean {
  return Boolean(
    c.palm_width_mm != null ||
      c.wrist_circ_mm != null ||
      c.forearm_length_mm != null ||
      c.hand_dominance ||
      c.needs_arm_attachment ||
      c.sensory_preferences.length > 0
  )
}

// null before the first save: a blank slate has nothing to flag as a hazard.
export function computeChildStepStatuses(
  child: ChildProfile | null
): Record<ChildStepId, StepStatus> {
  if (!child) {
    return { survey: 'neutral', ability: 'neutral', 'everyday-needs': 'neutral', customization: 'neutral' }
  }
  return {
    survey: hasSurveyData(child) ? 'done' : 'attention',
    ability: hasAbilityData(child) ? 'done' : 'attention',
    'everyday-needs': hasEverydayNeedsData(child) ? 'done' : 'attention',
    customization: hasCustomizationData(child) ? 'done' : 'attention',
  }
}

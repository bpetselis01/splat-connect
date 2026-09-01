// INTENDED PURPOSE (regulatory — do not remove without legal review):
// This module maps a parent's plain-language answers to an internal fit score used to
// rank suggested guides and devices. It is NOT a clinical assessment instrument, is not
// intended for use in clinical practice, and its output must never be presented to a
// user as a diagnosis, a clinical score, or a treatment recommendation. Presenting
// MACS/BFMF levels to end users risks bringing SPLAT Connect within the definition of a
// medical device under the Therapeutic Goods Act 1989 (Cth).
//
// ponytail: PLACEHOLDER clinical mapping, NOT a validated instrument. The
// question set and the answer→MACS/BFMF lookup are a naive linear bucketing
// stand-in and MUST be revised by someone with real MACS/BFMF domain
// expertise before this is trusted for assistive-device decisions.
//
// Lives here rather than in packages/mobile/lib because both mobile's
// ability-screen.tsx and web's child-survey-form.tsx run it, and a second
// copy would drift the moment the mapping above is revised. Pure logic, no
// React Native import — see the docstring in child-survey-form.tsx for why
// the UI around it is still re-implemented per platform.

export type MacsLevel = 'I' | 'II' | 'III' | 'IV' | 'V'
export type BfmfLevel = '1' | '2' | '3' | '4' | '5'

export type AbilityQuestion = { prompt: string; options: string[] }

// Each option index (0..3) contributes its own value to a 0..12 total.
export const QUESTIONS: AbilityQuestion[] = [
  {
    prompt: 'How does your child usually pick up small objects (a coin or bead)?',
    options: ['Easily, with either hand', 'With effort or only one hand', 'With difficulty, needs positioning help', 'Cannot pick up small objects'],
  },
  {
    prompt: 'How does your child handle larger objects (a cup or toy)?',
    options: ['Independently with both hands', 'Manages most, some are hard', 'Needs help with many objects', 'Needs help with most objects'],
  },
  {
    prompt: 'During two-handed play, how much does your child use their weaker hand?',
    options: ['Uses it well as a helper', 'Uses it a little to stabilise', 'Rarely uses it', 'Does not use it'],
  },
  {
    prompt: 'How much assistance does your child need for daily hand tasks (eating, dressing)?',
    options: ['None', 'A little', 'Moderate', 'A lot'],
  },
]

const MACS_BY_TOTAL: MacsLevel[] = ['I', 'I', 'II', 'II', 'II', 'III', 'III', 'III', 'IV', 'IV', 'IV', 'V', 'V']
const BFMF_BY_TOTAL: BfmfLevel[] = ['1', '1', '2', '2', '2', '3', '3', '3', '4', '4', '4', '5', '5']

export function deriveFitProfile(answers: number[]): { macsInternal: MacsLevel; bfmfInternal: BfmfLevel } {
  if (answers.length !== QUESTIONS.length) {
    throw new Error(`deriveFitProfile expects ${QUESTIONS.length} answers, got ${answers.length}`)
  }
  const total = answers.reduce((sum, a) => sum + a, 0) // 0..12
  return { macsInternal: MACS_BY_TOTAL[total], bfmfInternal: BFMF_BY_TOTAL[total] }
}

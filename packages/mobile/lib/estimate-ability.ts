// ponytail: PLACEHOLDER clinical mapping, NOT a validated instrument. The
// question set and the answer→MACS/BFMF lookup are a naive linear bucketing
// stand-in and MUST be revised by someone with real MACS/BFMF domain
// expertise before this is trusted for assistive-device decisions.

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

export function estimateAbility(answers: number[]): { macs: MacsLevel; bfmf: BfmfLevel } {
  if (answers.length !== QUESTIONS.length) {
    throw new Error(`estimateAbility expects ${QUESTIONS.length} answers, got ${answers.length}`)
  }
  const total = answers.reduce((sum, a) => sum + a, 0) // 0..12
  return { macs: MACS_BY_TOTAL[total], bfmf: BFMF_BY_TOTAL[total] }
}

/**
 * A toy's condition as the word a parent wants, never a number to interpret.
 * The board's GRADE() over 021's 1–10 `condition` column. One list for web and
 * mobile, so a card's pill and the filter that found it never say different
 * words.
 */
export type GradeKey = 'like-new' | 'good' | 'well-loved' | 'needs-fix'

export interface Grade {
  key: GradeKey
  label: string
  /** The lowest condition that earns this grade. */
  min: number
}

const NEEDS_FIX: Grade = { key: 'needs-fix', label: 'Needs a fix', min: 0 }

/** Best first, so the first match is the grade. */
export const GRADES: readonly Grade[] = [
  { key: 'like-new', label: 'Like new', min: 9 },
  { key: 'good', label: 'Good', min: 7 },
  { key: 'well-loved', label: 'Well-loved', min: 5 },
  NEEDS_FIX,
]

export function gradeOf(condition: number): Grade {
  return GRADES.find((g) => condition >= g.min) ?? NEEDS_FIX
}

/**
 * A toy's condition as the word a parent wants, not a number to interpret.
 *
 * The board's four grades over the 1–10 condition column (021_toys.sql): its
 * GRADE() takes the same 10-point scale. One list for the card's pill and the
 * toy library's condition filter, so the pill on a card and the filter that
 * found it can never say different words.
 */
export type GradeKey = 'like-new' | 'good' | 'well-loved' | 'needs-fix'

export interface Grade {
  key: GradeKey
  label: string
  /** The lowest condition that earns this grade. */
  min: number
  tint: string
}

/** Best first, so the first match is the grade. */
export const GRADES: Grade[] = [
  { key: 'like-new', label: 'Like new', min: 9, tint: 'var(--tok)' },
  { key: 'good', label: 'Good', min: 7, tint: 'var(--tmint)' },
  { key: 'well-loved', label: 'Well-loved', min: 5, tint: 'var(--tamber)' },
  { key: 'needs-fix', label: 'Needs a fix', min: 0, tint: 'var(--tcoral)' },
]

export function gradeOf(condition: number): Grade {
  return GRADES.find((g) => condition >= g.min) ?? GRADES[GRADES.length - 1]
}

/**
 * The grade (packages/types/src/toy-grade.ts) with web's tint for its pill.
 * The words and cut points live in types so mobile says the same thing.
 */
import { gradeOf as baseGrade, type Grade as BaseGrade, type GradeKey } from '@splat-connect/types'

export type { GradeKey }

export interface Grade extends BaseGrade {
  tint: string
}

const TINT: Record<GradeKey, string> = {
  'like-new': 'var(--tok)',
  good: 'var(--tmint)',
  'well-loved': 'var(--tamber)',
  'needs-fix': 'var(--tcoral)',
}

export function gradeOf(condition: number): Grade {
  const g = baseGrade(condition)
  return { ...g, tint: TINT[g.key] }
}

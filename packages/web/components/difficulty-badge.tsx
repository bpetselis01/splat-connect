// Palette shared with packages/mobile/lib/theme.ts.
import type { Difficulty } from '@splat-connect/types'

const styles: Record<Difficulty, string> = {
  easy: 'bg-mint-soft text-mint-deep',
  medium: 'bg-honey-soft text-honey-deep',
  hard: 'bg-apricot-soft text-apricot-deep',
}

export function DifficultyBadge({ difficulty }: { difficulty: Difficulty }) {
  return <span className={`badge ${styles[difficulty]}`}>{difficulty.toUpperCase()}</span>
}

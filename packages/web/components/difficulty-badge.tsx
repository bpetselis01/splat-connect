/**
 * Difficulty Level Badge Component
 * 
 * Displays a colored badge showing tutorial difficulty level.
 * Used throughout the web app to give visual feedback at a glance.
 * 
 * Prop:
 * - difficulty: 'easy' | 'medium' | 'hard'
 * 
 * Styling:
 * - easy: Green background (low effort)
 * - medium: Yellow background (moderate effort)
 * - hard: Red background (high effort)
 * 
 * Used in:
 * - TutorialCard: Shows difficulty in tutorial preview
 * - Tutorial detail page: Shows difficulty prominently
 * - Library listings: Quick difficulty reference
 * 
 * Related files:
 * - components/tutorial-card.tsx: Uses DifficultyBadge
 * - types/index.ts: Difficulty type definition
 */
import type { Difficulty } from '@splat-connect/types'

const styles: Record<Difficulty, string> = {
  easy: 'bg-green-100 text-green-800',
  medium: 'bg-yellow-100 text-yellow-800',
  hard: 'bg-red-100 text-red-800',
}

export function DifficultyBadge({ difficulty }: { difficulty: Difficulty }) {
  return (
    <span
      className={`inline-block text-xs font-bold px-2 py-0.5 rounded ${styles[difficulty]}`}
    >
      {difficulty.toUpperCase()}
    </span>
  )
}

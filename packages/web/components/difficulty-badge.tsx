/**
 * Difficulty Level Badge Component
 * 
 * Displays a colored badge showing tutorial difficulty level.
 * Used throughout the web app to give visual feedback at a glance.
 * 
 * Prop:
 * - difficulty: 'easy' | 'medium' | 'hard'
 * 
 * Styling (palette shared with packages/mobile/lib/theme.ts — the previous
 * values were Tailwind's green/yellow/red, from a different colour system):
 * - easy: Mint (low effort)
 * - medium: Honey (moderate effort)
 * - hard: Apricot (high effort)
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
  easy: 'bg-mint-soft text-mint-deep',
  medium: 'bg-honey-soft text-honey-deep',
  hard: 'bg-apricot-soft text-apricot-deep',
}

export function DifficultyBadge({ difficulty }: { difficulty: Difficulty }) {
  return <span className={`badge ${styles[difficulty]}`}>{difficulty.toUpperCase()}</span>
}

import type { Difficulty } from '@/lib/types'

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

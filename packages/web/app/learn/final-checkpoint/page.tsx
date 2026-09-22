/**
 * Final checkpoint.
 *
 * Questions come from lib/learn-content.json. Nothing is locked behind a
 * checkpoint — see components/learn-checkpoint.tsx for why.
 */
import { LearnShell } from '@/components/learn-shell'
import { LearnCheckpoint, type Question } from '@/components/learn-checkpoint'
import content from '@/lib/learn-content.json'

const SLUG = 'final-checkpoint'

export const metadata = {
  title: 'Final checkpoint — SPLAT Connect',
  description: 'Four questions across the whole course.',
}

export default function Page() {
  return (
    <LearnShell slug={SLUG} questions={content.quizzes[SLUG].length}>
      <LearnCheckpoint
        slug={SLUG}
        questions={content.quizzes[SLUG] as Question[]}
        final
      />
    </LearnShell>
  )
}

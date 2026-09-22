/**
 * Checkpoint: the basics.
 *
 * Questions come from lib/learn-content.json. Nothing is locked behind a
 * checkpoint — see components/learn-checkpoint.tsx for why.
 */
import { LearnShell } from '@/components/learn-shell'
import { LearnCheckpoint, type Question } from '@/components/learn-checkpoint'
import content from '@/lib/learn-content.json'

const SLUG = 'checkpoint-1'

export const metadata = {
  title: 'Checkpoint: the basics — SPLAT Connect',
  description: 'Three questions on the basics. Nothing is locked behind it.',
}

export default function Page() {
  return (
    <LearnShell slug={SLUG} questions={content.quizzes[SLUG].length}>
      <LearnCheckpoint
        slug={SLUG}
        questions={content.quizzes[SLUG] as Question[]}
      />
    </LearnShell>
  )
}

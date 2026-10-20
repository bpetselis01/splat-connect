/**
 * Checkpoint: the bench.
 *
 * Questions come from lib/learn-content.json. Nothing is locked behind a
 * checkpoint — see components/learn-checkpoint.tsx for why.
 */
import { LearnShell } from '@/components/learn-shell'
import { LearnCheckpoint, type Question } from '@/components/learn-checkpoint'
import content from '@/lib/learn-content.json'
import { LearnGate } from '@/components/learn-gate'

const SLUG = 'checkpoint-2'

export const metadata = {
  title: 'Checkpoint: the bench — SPLAT Connect',
  description: 'Three questions on tools and safety.',
}

function Page() {
  return (
    <LearnShell slug={SLUG} questions={content.quizzes[SLUG].length}>
      <LearnCheckpoint
        slug={SLUG}
        questions={content.quizzes[SLUG] as Question[]}
      />
    </LearnShell>
  )
}

/** Gated per page, not per layout: see components/learn-gate.tsx. */
export default function GatedPage() {
  return (
    <LearnGate path="/learn/checkpoint-2">
      <Page />
    </LearnGate>
  )
}

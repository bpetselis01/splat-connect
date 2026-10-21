/**
 * Final checkpoint.
 *
 * Questions come from lib/learn-content.json. Nothing is locked behind a
 * checkpoint — see components/learn-checkpoint.tsx for why.
 */
import { LearnShell } from '@/components/learn-shell'
import { LearnCheckpoint, type Question } from '@/components/learn-checkpoint'
import content from '@/lib/learn-content.json'
import { LearnGate } from '@/components/learn-gate'

const SLUG = 'final-checkpoint'

export const metadata = {
  title: 'Final checkpoint — SPLAT Connect',
  description: 'Four questions across the whole course.',
}

function Page() {
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

/** Gated per page, not per layout: see components/learn-gate.tsx. */
export default function GatedPage() {
  return (
    <LearnGate path="/learn/final-checkpoint">
      <Page />
    </LearnGate>
  )
}

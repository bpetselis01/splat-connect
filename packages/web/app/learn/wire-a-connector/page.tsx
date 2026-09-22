/**
 * Wire a 3.5 mm jack or socket.
 *
 * Content comes from lib/learn-content.json — the artboard's own lesson table,
 * which was written at a bench with a camera. The photographs are of the actual
 * toys; re-authoring the prose would have meant inventing the parts of a
 * procedure nobody had performed.
 */
import { LearnShell } from '@/components/learn-shell'
import { BuildLesson, type BuildLesson as Lesson } from '@/components/build-lesson'
import content from '@/lib/learn-content.json'

const SLUG = 'wire-a-connector'

export const metadata = {
  title: 'Wire a 3.5 mm jack or socket — SPLAT Connect',
  description: 'The connector every adaptation ends in. Nine photographed steps, identical for a jack and a socket.',
}

export default function Page() {
  return (
    <LearnShell slug={SLUG}>
      <BuildLesson
        lesson={content.builds[SLUG] as unknown as Lesson}
      />
    </LearnShell>
  )
}

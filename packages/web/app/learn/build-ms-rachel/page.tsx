/**
 * Build 3 · Ms Rachel Speak & Sing.
 *
 * Content comes from lib/learn-content.json — the artboard's own lesson table,
 * which was written at a bench with a camera. The photographs are of the actual
 * toys; re-authoring the prose would have meant inventing the parts of a
 * procedure nobody had performed.
 */
import { LearnShell } from '@/components/learn-shell'
import { BuildLesson, type BuildLesson as Lesson } from '@/components/build-lesson'
import content from '@/lib/learn-content.json'

const SLUG = 'build-ms-rachel'

export const metadata = {
  title: 'Build 3 · Ms Rachel Speak & Sing — SPLAT Connect',
  description: 'A plush doll with two functions, adapted with a splice instead of a circuit board.',
}

export default function Page() {
  return (
    <LearnShell slug={SLUG}>
      <BuildLesson
        lesson={content.builds[SLUG] as unknown as Lesson}
        title="Build 3 · Ms Rachel Speak & Sing"
      />
    </LearnShell>
  )
}

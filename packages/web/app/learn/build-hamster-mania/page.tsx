/**
 * Build 1 · Hamster Mania.
 *
 * Content comes from lib/learn-content.json — the artboard's own lesson table,
 * which was written at a bench with a camera. The photographs are of the actual
 * toys; re-authoring the prose would have meant inventing the parts of a
 * procedure nobody had performed.
 */
import { LearnShell } from '@/components/learn-shell'
import { BuildLesson, type BuildLesson as Lesson } from '@/components/build-lesson'
import content from '@/lib/learn-content.json'

const SLUG = 'build-hamster-mania'

export const metadata = {
  title: 'Build 1 · Hamster Mania — SPLAT Connect',
  description: 'A $15 plush hamster that sings and runs. Six triangular screws, one button, one socket.',
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

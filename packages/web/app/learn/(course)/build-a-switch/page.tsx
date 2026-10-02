/**
 * Build a 3D-printed switch.
 *
 * Content comes from lib/learn-content.json — the artboard's own lesson table,
 * which was written at a bench with a camera. The photographs are of the actual
 * toys; re-authoring the prose would have meant inventing the parts of a
 * procedure nobody had performed.
 */
import { LearnShell } from '@/components/learn-shell'
import { BuildLesson, type BuildLesson as Lesson } from '@/components/build-lesson'
import content from '@/lib/learn-content.json'
import { LearnGate } from '@/components/learn-gate'

const SLUG = 'build-a-switch'

export const metadata = {
  title: 'Build a 3D-printed switch — SPLAT Connect',
  description: 'Four printed parts and a limit switch, for a few dollars.',
}

function Page() {
  return (
    <LearnShell slug={SLUG}>
      <BuildLesson
        lesson={content.builds[SLUG] as unknown as Lesson}
      />
    </LearnShell>
  )
}

/** Gated per page, not per layout: see components/learn-gate.tsx. */
export default function GatedPage() {
  return (
    <LearnGate>
      <Page />
    </LearnGate>
  )
}

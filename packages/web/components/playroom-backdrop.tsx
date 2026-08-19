/**
 * The soft shapes behind a section's content.
 *
 * Pure decoration, and treated as such: `aria-hidden` so it is never announced,
 * `pointer-events-none` so it can never intercept a click or a focus ring, and
 * `overflow-hidden` on the container so a circle that runs off the edge does not
 * give the page a horizontal scrollbar.
 *
 * Sits behind content via a negative z-index rather than by being painted first,
 * because the sections it backs are not all in the same stacking context.
 */
import { toneClass, type Tone } from '@/lib/tone'

export function PlayroomBackdrop({ tone }: { tone: Tone }) {
  const { dot } = toneClass(tone)

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
    >
      <span className={`absolute -right-32 -top-40 h-80 w-80 rounded-full opacity-[0.18] ${dot}`} />
      <span className={`absolute -left-40 top-1/2 h-64 w-64 rounded-full opacity-[0.14] ${dot}`} />
      <span className="absolute -bottom-20 right-1/3 h-40 w-40 rounded-full bg-apricot opacity-[0.12]" />
    </div>
  )
}

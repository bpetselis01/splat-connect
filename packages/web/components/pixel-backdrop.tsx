/**
 * The shapes behind a section's content.
 *
 * Three soft circles in the pale end of the palette, sized roughly 1 : 0.68 :
 * 0.44 and hung off the edges of the page so none of them reads as a complete
 * object. That incompleteness is the point — a circle that fits entirely on
 * screen is a diagram, one that runs off the edge is atmosphere.
 *
 * Only the largest takes the section's own colour. The other two are a fixed
 * apricot and mint pair, so no page is ever entirely one hue and the warm half
 * of the palette gets spent on every route rather than only on the three
 * sections that happen to own a warm tone.
 *
 * Painted as pale tints at half opacity rather than as the section's ink at low
 * alpha. Saturated ink over the blue canvas drags every hue toward the ground —
 * honey came out olive, sunken came out grey — and four sections ended up the
 * same shade of mud.
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

export function PixelBackdrop({ tone }: { tone: Tone }) {
  const { surface } = toneClass(tone)

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
    >
      <span
        className={`absolute -top-24 right-[8%] h-[30rem] w-[30rem] rounded-full opacity-50 ${surface}`}
      />
      <span className="absolute -bottom-20 left-[4%] h-[20rem] w-[20rem] rounded-full bg-apricot-soft opacity-50" />
      <span className="absolute right-[3%] top-[46%] h-[13rem] w-[13rem] rounded-full bg-mint-soft opacity-50" />
    </div>
  )
}

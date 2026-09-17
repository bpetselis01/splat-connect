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
 * Painted as pale tints rather than as the section's ink at low alpha.
 * Saturated ink over the canvas drags every hue toward the ground — honey came
 * out olive, sunken came out grey — and four sections ended up the same shade
 * of mud.
 *
 * Soft-edged, not circles. These were `rounded-full` spans filled with a flat
 * tint at 50%, which draws a disc with a definite edge — three pale coins on
 * the page, and the largest of them sat right behind the homepage mascot. The
 * board has no discs: its colour comes from radial gradients that fade to
 * nothing well before their own bounds, so the eye reads light in the room
 * rather than a shape on the wall. Same positions, same tints, soft falloff.
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

/**
 * The falloff. A mask rather than a gradient background, so each wash keeps its
 * tint from the Tailwind class — the section tone is chosen at runtime and a
 * gradient would have to inline the colour to use it.
 */
const WASH = 'radial-gradient(circle at 50% 50%, rgba(0,0,0,0.55), transparent 68%)'

export function PixelBackdrop({ tone }: { tone: Tone }) {
  const { surface } = toneClass(tone)

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
    >
      <span
        className={`absolute -top-24 right-[8%] h-[34rem] w-[34rem] ${surface}`}
        style={{ maskImage: WASH, WebkitMaskImage: WASH }}
      />
      <span
        className="absolute -bottom-20 left-[4%] h-[24rem] w-[24rem] bg-apricot-soft"
        style={{ maskImage: WASH, WebkitMaskImage: WASH }}
      />
      <span
        className="absolute right-[3%] top-[46%] h-[16rem] w-[16rem] bg-mint-soft"
        style={{ maskImage: WASH, WebkitMaskImage: WASH }}
      />
    </div>
  )
}

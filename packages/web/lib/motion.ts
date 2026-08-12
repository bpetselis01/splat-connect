/**
 * The site's motion vocabulary.
 *
 * Three variants and one helper, deliberately not a catalogue. The tell of a
 * library-driven redesign is uniform motion — one identical entrance applied to
 * every section — so pages import named intent from here rather than writing
 * raw initial/animate props at each call site.
 *
 * Everything rides --ease-out-quart, the one named curve in globals.css. No
 * bounce, no elastic.
 *
 * Related files:
 * - components/reveal.tsx: the only consumer that arms these on scroll
 * - app/globals.css: --ease-out-quart, and the reduced-motion block
 */
import type { Transition, Variants } from 'motion/react'

/** globals.css's cubic-bezier(0.25, 1, 0.5, 1), restated for JS-driven motion. */
export const EASE_OUT_QUART: [number, number, number, number] = [0.25, 1, 0.5, 1]

const base: Transition = { duration: 0.32, ease: EASE_OUT_QUART }

/** Section content: a short lift as it settles. */
export const riseIn: Variants = {
  hidden: { opacity: 0, y: 12 },
  shown: { opacity: 1, y: 0, transition: base },
}

/** Media and cards: scale rather than travel, so nothing shifts its neighbours. */
export const settleIn: Variants = {
  hidden: { opacity: 0, scale: 0.98 },
  shown: { opacity: 1, scale: 1, transition: base },
}

/**
 * List children: opacity only, no geometry.
 *
 * WHY: Playwright's auto-waiting is asymmetric — actions (click, fill) wait for
 *      animation stability, but queries (boundingBox, evaluate) return
 *      immediately. tests/e2e/responsive/reflow.spec.ts reads two boundingBox
 *      values and asserts their y offsets match within 4px; a staggered grid
 *      mid-flight exceeds that tolerance and the test flakes.
 * HOW:  Fading without translating keeps boundingBox().y stable from first
 *       paint. playwright.config.ts also pins reducedMotion, but this holds for
 *       the visitors who do not have that preference set.
 */
export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  shown: { opacity: 1, transition: base },
}

const STAGGER_STEP = 0.045

/**
 * Past this many items the delay stops growing, so long grids do not cascade.
 * At 45ms a step, an uncapped 40-tutorial library grid would still be arriving
 * 1.8s after the first card — long after the visitor started scanning.
 */
const STAGGER_CAP = 8

/** Per-child delay for a list, capped so the tail arrives together. */
export function stagger(index: number): Transition {
  return { ...base, delay: Math.min(index, STAGGER_CAP) * STAGGER_STEP }
}

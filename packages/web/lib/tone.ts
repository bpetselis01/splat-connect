/**
 * Section colour, declared once.
 *
 * SPLAT provides three things — adaptation guides, a toy library, and 3D printed
 * parts. The site never said so: every section looked identical, and the warm half
 * of the palette (`apricot`, `mint`, `honey`) went almost entirely unspent. Tone
 * fixes both at once.
 *
 * The three pillars carry the three distinct accent families; the four supporting
 * sections stay in the blue family. That means rank is legible before a single
 * word is read, and it is why the tones are not simply "six nice colours".
 *
 * `hex` duplicates what the Tailwind classes resolve to so tests/unit/lib/tone.test.ts
 * can compute WCAG ratios without a browser. If you change a class here, change the
 * hex with it — the test is the guard, but only if the two stay in step.
 */
export type Tone = 'brand' | 'mint' | 'apricot' | 'honey' | 'sky' | 'sunken' | 'plain'

export interface ToneSpec {
  /** Card or panel background. */
  surface: string
  /** Text sitting on that surface — and on the canvas, which is why both are tested. */
  ink: string
  /** The nav marker and other small solid flecks. Decorative, so 3:1 is the bar. */
  dot: string
  /**
   * Stroke colour for the backdrop's rings. Separate from `dot` because a ring
   * is a flat line at full strength, not a filled disc at low alpha. That
   * distinction is the whole fix: *any* colour laid over the blue canvas at 15%
   * comes out as mud — honey went khaki, sunken went grey — because alpha
   * blending drags every hue toward the ground it sits on. Drawn as an opaque
   * tint from the same ramp, nothing blends and nothing muddies.
   */
  edge: string
  /** Raw values, for the contrast test. Keep in step with the classes above. */
  hex: { bg: string; fg: string }
}

export const TONES: Record<Tone, ToneSpec> = {
  // --- the three pillars: distinct accent families -------------------------
  brand: {
    surface: 'bg-brand-tint',
    ink: 'text-ink',
    dot: 'bg-brand',
    edge: 'border-brand-soft',
    hex: { bg: '#dcf0fb', fg: '#1c2530' },
  },
  mint: {
    surface: 'bg-mint-soft',
    ink: 'text-ink',
    dot: 'bg-mint',
    edge: 'border-mint-soft',
    hex: { bg: '#d9f4f1', fg: '#1c2530' },
  },
  apricot: {
    surface: 'bg-apricot-soft',
    ink: 'text-ink',
    dot: 'bg-apricot',
    edge: 'border-apricot-soft',
    hex: { bg: '#ffe9de', fg: '#1c2530' },
  },
  // --- the four supporting sections: the blue family ------------------------
  honey: {
    surface: 'bg-honey-soft',
    ink: 'text-ink',
    dot: 'bg-honey',
    edge: 'border-honey-soft',
    hex: { bg: '#fff0cc', fg: '#1c2530' },
  },
  sky: {
    surface: 'bg-brand-50',
    ink: 'text-ink',
    dot: 'bg-brand-dark',
    edge: 'border-brand-soft',
    hex: { bg: '#f0f9ff', fg: '#1c2530' },
  },
  sunken: {
    surface: 'bg-sunken',
    ink: 'text-ink',
    dot: 'bg-brand-deep',
    edge: 'border-brand-soft',
    hex: { bg: '#f3f1ed', fg: '#1c2530' },
  },
  plain: {
    surface: 'bg-surface',
    ink: 'text-ink',
    dot: 'bg-muted',
    edge: 'border-brand-soft',
    hex: { bg: '#ffffff', fg: '#1c2530' },
  },
}

export function toneClass(tone: Tone): ToneSpec {
  return TONES[tone]
}

// packages/mobile/lib/theme.ts
//
// The palette is anchored to the SPLAT light blue (#1998d5, ~OKLCH 0.63 0.13 231)
// and every other hue is derived from it: neutrals are tinted toward its hue
// rather than left pure gray, and the warm accents sit on its complement
// (~hue 45) so nothing reads as borrowed from another design system.
//
// Surface model: the canvas is blue-tinted and cards are white. This is the
// inverse of a white canvas with near-white cards, which left every card at
// ~1.02:1 against its background and therefore invisible.
export const theme = {
  colors: {
    // Brand
    primary: '#1998d5',
    primaryDark: '#0f6f9c',
    primaryDeep: '#0a4f70',
    primarySoft: '#bfe4f5',

    // Surfaces
    background: '#eaf4fa',
    surface: '#ffffff',
    surfaceSunken: '#dcedf6',
    accentLight: '#d8ecf7',
    accentLighter: '#ffffff',

    // Ink. `muted` was #6b7a82 — about 4.4:1 on white, under the 4.5:1 floor
    // while carrying 13px body copy. It now clears 4.5:1 on both surfaces.
    text: '#12283a',
    muted: '#4d6a7d',
    border: '#c6e0ed',

    // Warm complement of the brand blue. Reserved for delight and emphasis,
    // never used as decoration.
    apricot: '#ff8f5e',
    apricotSoft: '#ffe3d5',
    mint: '#2fbf9f',

    danger: '#a3301a',

    // Rebuilt from the palette above. The previous values were Tailwind's
    // green/yellow/red, which belong to a different color system entirely.
    difficulty: {
      easy: { bg: '#d4f2ea', text: '#0f5c4d' },
      medium: { bg: '#fdeecb', text: '#7a4e05' },
      hard: { bg: '#ffe0d6', text: '#8c3312' },
    },
  },
  fonts: {
    regular: 'Nunito_400Regular',
    semiBold: 'Nunito_600SemiBold',
    bold: 'Nunito_700Bold',
  },
  // Fixed scale at a ~1.2 ratio. Product UI is read at a consistent size on a
  // phone; fluid type buys nothing here and makes headings unpredictable.
  type: { display: 30, title: 24, heading: 19, body: 16, label: 14, caption: 13 },
  spacing: (n: number) => n * 4,
  radii: { sm: 10, md: 14, lg: 18, pill: 999 },
  // Shadows are tinted blue rather than near-black: a neutral shadow over a
  // blue canvas reads as dirt. `elevation` is not optional — Android ignores
  // the shadow* props entirely, so the old preset rendered flat there.
  shadow: {
    shadowColor: '#0a3550',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  elevation: {
    rest: {
      shadowColor: '#0a3550',
      shadowOpacity: 0.07,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 3 },
      elevation: 2,
    },
    lift: {
      shadowColor: '#0a3550',
      shadowOpacity: 0.14,
      shadowRadius: 20,
      shadowOffset: { width: 0, height: 8 },
      elevation: 7,
    },
  },
  motion: {
    pressScale: 0.96,
    duration: 180,
    fast: 140,
    base: 240,
    slow: 360,
    stagger: 55,
    // Low overshoot on purpose: a control that dips and settles feels tactile,
    // one that bounces feels like a toy.
    press: { damping: 20, stiffness: 320, mass: 0.85 },
    settle: { damping: 16, stiffness: 170, mass: 0.9 },
  },
} as const

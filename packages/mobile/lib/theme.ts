// Canvas is blue-tinted, cards are white — a white canvas with near-white
// cards left every card at ~1.02:1 against its background and invisible.
export const theme = {
  colors: {
    // Brand
    primary: '#1998d5',
    primaryDark: '#0f6f9c',
    primaryDeep: '#0a4f70',

    // Surfaces
    background: '#eaf4fa',
    surface: '#ffffff',
    surfaceSunken: '#dcedf6',
    accentLight: '#d8ecf7',

    // Ink. `muted` was #6b7a82 — about 4.4:1 on white, under the 4.5:1 floor
    // while carrying 13px body copy. It now clears 4.5:1 on both surfaces.
    text: '#12283a',
    muted: '#4d6a7d',
    border: '#c6e0ed',

    // Warm complement of the brand blue. Reserved for delight and emphasis,
    // never used as decoration.
    apricotSoft: '#ffe3d5',
    // Readable success text: mint itself is ~1.9:1 on the canvas. Matches the
    // web --color-mint-deep so "Saved" reads the same green on both surfaces.
    mintDeep: '#0f5c4d',

    danger: '#a3301a',

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
  type: { title: 24, heading: 19, body: 16, label: 14, caption: 13 },
  spacing: (n: number) => n * 4,
  radii: { sm: 10, md: 14, lg: 18, pill: 999 },
  // Shadows are tinted blue rather than near-black: a neutral shadow over a
  // blue canvas reads as dirt. `elevation` is not optional — Android ignores
  // the shadow* props entirely, so the old preset rendered flat there.
  elevation: {
    rest: {
      shadowColor: '#0a3550',
      shadowOpacity: 0.07,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 3 },
      elevation: 2,
    },
  },
  motion: {
    pressScale: 0.96,
    fast: 140,
    base: 240,
    stagger: 55,
    // Low overshoot on purpose: a control that dips and settles feels tactile,
    // one that bounces feels like a toy.
    press: { damping: 20, stiffness: 320, mass: 0.85 },
    settle: { damping: 16, stiffness: 170, mass: 0.9 },
  },
} as const
